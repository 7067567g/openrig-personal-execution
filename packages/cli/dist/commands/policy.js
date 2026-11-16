// B7 (0.5.2, RULING-rig-mode-rig-policy-naming) — `rig policy`: the top-level PERMISSION-POLICY
// verb, introduced after the context-mode verb took its natural name (`rig mode`).
//
// BINDING HONESTY PIN (carried VERBATIM from setup.ts, per the ruling; 0.6.7 states the per-launch team and
// kernel defaults from #820/#893): those defaults pass allow/ask lists per launch and save none; a selected
// Claude settings fragment can merge native settings, rules included; harness-native permissions are the control surface.
// `rig policy` TEACHES and RECORDS into RigSpec (`permission_policy: builtin:<name> | none`); it
// never enforces at runtime. OpenRig records posture into RigSpec, harness-native permissions
// enforce — never runtime enforcement.
//
// v1 scope per the ruling (read-heavy + one write path):
//   rig policy list [--spec]              — built-ins + the reserved deliberate-none + CUSTOM
//                                           policies visible in the given spec context
//   rig policy show <name-or-ref> [--spec]— one built-in OR a custom policy spec (validated)
//   rig policy current --spec <path>      — the effective recorded policy + WHAT WOULD APPLY,
//                                           through the AUTHORITATIVE validator/resolver
//   rig policy apply <name> --spec <path> — record the choice (same flow as `rig setup --policy`,
//                                           which STAYS as the setup-flow composition, not an alias)
//   rig policy apply <name> --seat <seat> — store the choice on an EXISTING seat (restore, resume and
//                                           launches that read the seat's stored state use it)
//
// AUTHORITATIVE SEMANTICS, NOT A PRIVATE CLASSIFIER (r2 HIGH-2): every ref this verb reports runs
// through validatePermissionPolicyRef + resolvePermissionPolicyAttachment — byte-equivalent CLI
// twins of the daemon's permission-policy modules (lib/permission-policy/*, lib/path-safety.ts;
// pinned by permission-policy-parity.test.ts). An invalid ref exits 1 with the authoritative error
// — this surface must never bless a spec defect the daemon's own validation refuses.
import { Command } from "commander";
import { parse as parseYaml } from "yaml";
import fs from "node:fs";
import path from "node:path";
import { defaultDeps, recordPermissionPolicyStep, resolveExistingSpecPath, POLICY_CHOICES, } from "./setup.js";
import { BUILTIN_POLICY_NAMES, builtinLaunchPosture, validatePermissionPolicyRef, resolvePermissionPolicyAttachment, } from "../lib/permission-policy/policy-ref.js";
import { parsePolicySpec, validatePolicySpec } from "../lib/permission-policy/policy-spec.js";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, daemonStatusGuard } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
const HONESTY_PIN = "The team and kernel launch defaults pass allow/ask lists per launch and save none; a selected Claude settings fragment can merge native settings, rules included; the harness-native permissions are the control surface. " +
    "OpenRig records posture into RigSpec; harness-native permissions enforce — never runtime enforcement.";
const BUILTIN_DESCRIPTIONS = {
    locked: "the most restrictive packaged posture — for seats that must not touch anything unattended",
    standard: "the packaged default posture for managed working seats",
    open: "a permissive packaged posture for trusted, high-autonomy seats",
    yolo: "the operator/no-guardrails posture — everything the harness allows (launch posture: full_bypass)",
    auto: "Claude runs with --permission-mode auto; Codex and Pi launch at the floor (launch posture: auto)",
    none: "the RESERVED deliberate-none choice: recorded as permission_policy: none — the floor, without the team launch default an absent policy gets; the choice is visible",
};
function refFor(name) {
    return name === "none" ? "none" : `builtin:${name}`;
}
const readFileDep = { readFile: (p) => fs.readFileSync(p, "utf-8") };
/** Collect every permission_policy declaration site in a parsed rig spec (rig level + members).
 *  Presence is keyed on the KEY existing, not on the value being a string. */
function collectRefSites(doc) {
    const sites = [{
            site: "rig",
            ref: Object.prototype.hasOwnProperty.call(doc, "permission_policy") ? doc["permission_policy"] : undefined,
        }];
    const pods = Array.isArray(doc["pods"]) ? doc["pods"] : [];
    pods.forEach((pod, pi) => {
        const members = Array.isArray(pod["members"]) ? pod["members"] : [];
        members.forEach((member, mi) => {
            if (member && typeof member === "object" && Object.prototype.hasOwnProperty.call(member, "permission_policy")) {
                const id = [pod["id"], member["id"]].filter(Boolean).join(".");
                sites.push({ site: `pods[${pi}].members[${mi}]${id ? ` (${id})` : ""}`, ref: member["permission_policy"] });
            }
        });
    });
    return sites;
}
function loadSpec(specPath) {
    const resolved = resolveExistingSpecPath(defaultDeps(), specPath);
    if (!resolved) {
        return { error: `No rig spec found at ${specPath} (looked for a file, then rig.yaml/rig.yml/agent.yaml/agent.yml inside it).` };
    }
    try {
        const doc = (parseYaml(fs.readFileSync(resolved, "utf-8")) ?? {});
        return { resolved, doc };
    }
    catch (err) {
        return { error: `Could not parse ${resolved}: ${err.message}` };
    }
}
/** Render "what would apply" for one resolved attachment. */
function describeAttachment(a) {
    const parts = [
        `origin=${a.origin}`,
        a.builtinName ? `builtin=${a.builtinName}` : null,
        a.resolvedTarget ? `target=${a.resolvedTarget}` : null,
        a.surface ? `surface=${a.surface}` : null,
        `launch_posture=${a.launchPosture}`,
        `content_resolved=${a.contentResolved}`,
    ].filter(Boolean);
    const advisory = a.origin === "custom" && !a.contentResolved
        ? " — UNRESOLVED custom content: the advisory FLOOR applies until the policy spec reads + validates"
        : "";
    return parts.join(" · ") + advisory;
}
export function policyCommand(depsOverride) {
    const cmd = new Command("policy").description(`Teach and record the rig-level permission policy. ${HONESTY_PIN} (The context-mode verb formerly at this name is now: rig mode.)`);
    const getDeps = () => depsOverride ?? {
        lifecycleDeps: realDeps(),
        clientFactory: (url) => new DaemonClient(url),
    };
    const permissions = new Command("permissions").description("Native permission policy: list, show, current and apply. Work posture is separate; this does not relaunch seats.");
    registerPermissionCommands(permissions, getDeps);
    cmd.addCommand(permissions);
    // Compatibility aliases share the exact actions and output, including JSON and exit codes.
    registerPermissionCommands(cmd, getDeps);
    return cmd;
}
/** `apply --seat`: the daemon validates the ref like a spec member's and stores it on the seat. */
async function applyToSeat(getDeps, name, opts) {
    if (!POLICY_CHOICES.includes(name)) {
        const refusal = { ok: false, code: "invalid_policy", message: `Unknown policy choice '${name}'. Choose one of: ${POLICY_CHOICES.join(", ")}.` };
        if (opts.json)
            console.log(JSON.stringify(refusal));
        else
            console.error(refusal.message);
        process.exitCode = 1;
        return;
    }
    const deps = getDeps();
    const daemon = await getDaemonStatus(deps.lifecycleDeps);
    if (!daemonStatusGuard(daemon))
        return;
    const client = deps.clientFactory(getDaemonUrl(daemon));
    const ref = refFor(name);
    const res = await client.post(`/api/seat/set-policy/${encodeURIComponent(opts.seat)}`, {
        ref, reason: opts.reason ?? "", ...(opts.operator ? { operator: opts.operator } : {}),
    });
    if (opts.json)
        console.log(JSON.stringify(res.data));
    else if (res.status >= 400) {
        console.error(String(res.data["message"] ?? res.data["error"] ?? `Policy apply failed (HTTP ${res.status})`));
        if (typeof res.data["guidance"] === "string")
            console.error(res.data["guidance"]);
    }
    else {
        const unchanged = res.data["changed"] === false ? " (unchanged)" : "";
        const posture = `launch_posture=${String(res.data["launchPosture"])}`;
        console.log(name === "none"
            ? `Recorded permission_policy: none on seat ${opts.seat}: an explicit floor for this seat, not "no policy"; it does not inherit the rig's policy (${posture})${unchanged}.`
            : `Recorded permission_policy: ${ref} on seat ${opts.seat} (${posture})${unchanged}.`);
        console.log(String(res.data["effect"]));
    }
    if (res.status >= 400)
        process.exitCode = res.status >= 500 ? 2 : 1;
}
function registerPermissionCommands(cmd, getDeps) {
    cmd
        .command("list")
        .description(`List the built-in permission-policy templates, plus the custom policies visible in a spec context. ${HONESTY_PIN}`)
        .option("--spec <path>", "Rig spec (file or directory) defining the custom-policy context")
        .option("--json", "Machine-readable output")
        .action((opts) => {
        const builtins = POLICY_CHOICES.map((name) => ({ name, ref: refFor(name), origin: name === "none" ? "deliberate_none" : "builtin", description: BUILTIN_DESCRIPTIONS[name] ?? "" }));
        const custom = [];
        let specError = null;
        if (opts.spec) {
            const loaded = loadSpec(opts.spec);
            if ("error" in loaded) {
                specError = loaded.error;
            }
            else {
                const declaringDir = path.dirname(loaded.resolved);
                for (const { site, ref } of collectRefSites(loaded.doc)) {
                    if (ref === undefined)
                        continue; // truly absent
                    if (typeof ref === "string" && (ref === "none" || ref.startsWith("builtin:")))
                        continue;
                    const invalid = validatePermissionPolicyRef(ref, `${site}.permission_policy`);
                    if (invalid) {
                        custom.push({ site, ref, invalid });
                        continue;
                    }
                    const a = resolvePermissionPolicyAttachment(ref, declaringDir, readFileDep);
                    custom.push({ site, ref, resolvedTarget: a.resolvedTarget, surface: a.surface ?? null, launchPosture: a.launchPosture, contentResolved: a.contentResolved });
                }
            }
        }
        if (opts.json) {
            console.log(JSON.stringify({ policies: builtins, custom, ...(specError ? { specError } : {}), note: HONESTY_PIN }));
        }
        else {
            for (const r of builtins)
                console.log(`${r.name.padEnd(10)} ${r.ref.padEnd(18)} ${r.description}`);
            if (opts.spec && !specError) {
                console.log(custom.length > 0 ? "\nCustom policies in the spec set:" : "\n(no custom policies referenced in the spec set)");
                for (const c of custom) {
                    console.log(c.invalid
                        ? `  ${String(c.site).padEnd(28)} ${c.ref} — INVALID: ${c.invalid}`
                        : `  ${String(c.site).padEnd(28)} ${c.ref} → ${c.resolvedTarget} (surface=${c.surface ?? "?"}, launch_posture=${c.launchPosture}, content_resolved=${c.contentResolved})`);
                }
            }
            if (specError)
                console.error(specError);
            console.log(`\n${HONESTY_PIN}`);
        }
        if (specError)
            process.exitCode = 1;
    });
    cmd
        .command("show <nameOrRef>")
        .description("Show one built-in policy choice, or validate + open a CUSTOM policy spec by ref (relative to --spec's directory, else cwd).")
        .option("--spec <path>", "Rig spec (file or directory) whose directory anchors a custom ref")
        .option("--json", "Machine-readable output")
        .action((nameOrRef, opts) => {
        if (POLICY_CHOICES.includes(nameOrRef)) {
            const out = {
                name: nameOrRef,
                ref: refFor(nameOrRef),
                origin: nameOrRef === "none" ? "deliberate_none" : "builtin",
                description: BUILTIN_DESCRIPTIONS[nameOrRef] ?? "",
                recordedAs: `permission_policy: ${refFor(nameOrRef)}`,
                launchPosture: builtinLaunchPosture(nameOrRef),
                enforcement: HONESTY_PIN,
            };
            if (opts.json)
                console.log(JSON.stringify(out));
            else {
                console.log(`${out.name} — ${out.description}`);
                console.log(`Recorded as: ${out.recordedAs} (launch_posture: ${out.launchPosture})`);
                console.log(out.enforcement);
            }
            return;
        }
        // Custom ref path — AUTHORITATIVE validation first; an invalid ref is a loud refusal.
        const ref = nameOrRef.startsWith("builtin:") ? nameOrRef : nameOrRef;
        const invalid = validatePermissionPolicyRef(ref, "policy ref");
        if (invalid) {
            console.error(invalid);
            console.error(`Known built-ins: ${POLICY_CHOICES.join(", ")}.`);
            process.exitCode = 1;
            return;
        }
        let declaringDir = process.cwd();
        let anchor = "cwd";
        if (opts.spec) {
            const loaded = loadSpec(opts.spec);
            if ("error" in loaded) {
                console.error(loaded.error);
                process.exitCode = 1;
                return;
            }
            declaringDir = path.dirname(loaded.resolved);
            anchor = loaded.resolved;
        }
        const resolvedTarget = path.resolve(declaringDir, ref);
        let raw;
        try {
            raw = fs.readFileSync(resolvedTarget, "utf-8");
        }
        catch {
            console.error(`Custom policy '${ref}' does not resolve: ${resolvedTarget} is missing or unreadable (anchored at ${anchor}). The advisory FLOOR would apply.`);
            process.exitCode = 1;
            return;
        }
        const parsed = parsePolicySpec(raw);
        if ("error" in parsed) {
            console.error(`Custom policy '${ref}' at ${resolvedTarget} is INVALID: ${parsed.error}`);
            process.exitCode = 1;
            return;
        }
        const contract = validatePolicySpec(parsed.frontmatter);
        const attachment = resolvePermissionPolicyAttachment(ref, declaringDir, readFileDep);
        const out = {
            ref,
            origin: "custom",
            resolvedTarget,
            declaringDir,
            surface: attachment.surface ?? null,
            launchPosture: attachment.launchPosture,
            contentResolved: attachment.contentResolved,
            contractValid: contract.ok,
            contractErrors: contract.errors,
            enforcement: HONESTY_PIN,
        };
        if (opts.json)
            console.log(JSON.stringify(out));
        else {
            console.log(`${ref} → ${resolvedTarget}`);
            console.log(describeAttachment(attachment));
            if (!contract.ok)
                for (const e of contract.errors)
                    console.log(`  contract: ${e}`);
            console.log(HONESTY_PIN);
        }
        if (!contract.ok)
            process.exitCode = 1;
    });
    cmd
        .command("current")
        .description("Show the EFFECTIVE permission policy for a rig spec and what would apply, per site (rig + member overrides), through the authoritative validator/resolver.")
        .requiredOption("--spec <path>", "Rig spec file, or a directory containing rig.yaml/agent.yaml")
        .option("--json", "Machine-readable output")
        .action((opts) => {
        const loaded = loadSpec(opts.spec);
        if ("error" in loaded) {
            console.error(loaded.error);
            process.exitCode = 1;
            return;
        }
        const declaringDir = path.dirname(loaded.resolved);
        const sites = collectRefSites(loaded.doc);
        const rigRef = sites[0].ref;
        let anyInvalid = false;
        const report = sites.map(({ site, ref }) => {
            // member > rig precedence on PRESENCE (a present member value overrides, even an invalid one —
            // it must surface as ITS OWN defect, never silently disappear behind the rig ref).
            const effective = site === "rig" ? ref : (ref !== undefined ? ref : rigRef);
            if (effective === undefined) {
                return { site, ref: null, effective: null, applies: "absent — nothing recorded: eligible Claude Code and Codex seats get the team launch default (the kernel's own seats the kernel default) unless an explicit seat choice or a named Codex profile takes precedence; other seats the floor" };
            }
            const invalid = validatePermissionPolicyRef(effective, `${site}.permission_policy`);
            if (invalid) {
                anyInvalid = true;
                return { site, ref: ref ?? null, effective, invalid };
            }
            const a = resolvePermissionPolicyAttachment(effective, declaringDir, readFileDep);
            return { site, ref: ref ?? null, effective, applies: describeAttachment(a), attachment: a };
        });
        const out = { spec: loaded.resolved, sites: report, enforcement: HONESTY_PIN };
        if (opts.json)
            console.log(JSON.stringify(out));
        else {
            console.log(`Spec: ${loaded.resolved}`);
            for (const r of report) {
                if ("invalid" in r && r.invalid)
                    console.log(`${r.site}: ${r.effective} — INVALID: ${r.invalid}`);
                else
                    console.log(`${r.site}: ${r.effective ?? "(absent)"} — ${String(r.applies)}`);
            }
            console.log(HONESTY_PIN);
        }
        // An invalid ref is a spec DEFECT (the daemon's own validation refuses it) — never exit 0.
        if (anyInvalid)
            process.exitCode = 1;
    });
    cmd
        .command("apply <name>")
        .description(`Record a policy choice into an EXISTING rig spec (the same recording flow as \`rig setup --policy\`, which stays as the setup-step composition), or with --seat store it on an existing seat. Restore, resume and launches that read the seat's stored state use the stored policy, unless an explicit native selection (rig seat set-permissions) takes precedence; \`rig up <rig name>\` uses it, while a launch from a spec that declares a policy replaces it with the spec's policy, which later restores then use. ${HONESTY_PIN}`)
        .option("--spec <path>", "Rig spec file, or a directory containing rig.yaml/agent.yaml")
        .option("--seat <seat>", "An existing seat (canonical session name or logical seat ref). `none` is an explicit floor for that seat and does not inherit the rig's policy. The running process and the spec file are unchanged. Afterwards a `rig launch --retry-startup-from` file has to carry the new policy")
        .option("--reason <text>", "With --seat: the audit reason (required)")
        .option("--operator <address>", "With --seat: operator recorded on the audit event when no session identity is present")
        .option("--json", "Machine-readable output")
        .action(async (name, opts) => {
        if ((opts.spec === undefined) === (opts.seat === undefined)) {
            console.error("Pass exactly one of --spec <path> (record into a rig spec) or --seat <seat> (record on an existing seat).");
            process.exitCode = 1;
            return;
        }
        if (opts.seat !== undefined) {
            await applyToSeat(getDeps, name, { ...opts, seat: opts.seat });
            return;
        }
        const step = recordPermissionPolicyStep(defaultDeps(), name, opts.spec);
        if (opts.json)
            console.log(JSON.stringify(step));
        else {
            console.log(step.message);
            if (step.status === "fail") {
                if (step.reason)
                    console.log(step.reason);
                if (step.fixHint)
                    console.log(`Fix: ${step.fixHint}`);
            }
        }
        if (step.status === "fail")
            process.exitCode = 1;
    });
}
// Re-exported so the parity test can assert the twin surface without deep-importing.
export { BUILTIN_POLICY_NAMES };
//# sourceMappingURL=policy.js.map