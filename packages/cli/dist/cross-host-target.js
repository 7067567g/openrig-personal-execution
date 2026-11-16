import { loadHostRegistry, resolveHost } from "./host-registry.js";
import { loadHostBindings, describeBindingConflict } from "./host-bindings.js";
export function resolveCrossHostTarget(rawTarget, explicitHost, registryLoader, selfHostId, bindingsLoader) {
    const atCount = rawTarget.split("@").length - 1;
    if (atCount < 2) {
        return { ok: true, target: rawTarget, sugarHost: undefined, hint: undefined };
    }
    const lastAt = rawTarget.lastIndexOf("@");
    const base = rawTarget.slice(0, lastAt);
    const suffix = rawTarget.slice(lastAt + 1);
    const unregisteredHint = suffix.length > 0
        ? `no registered host '${suffix}' — if '${suffix}' was meant as a host, check \`rig host ls\``
        : undefined;
    if (suffix.length === 0 || base.length === 0) {
        return { ok: true, target: rawTarget, sugarHost: undefined, hint: unregisteredHint };
    }
    // 51-09 increment 3 (arch ruling 2e1b737f): a suffix EQUAL to the daemon's
    // LITERAL boot-reconciled self-host id routes HOME — the CLI-edge twin of the
    // daemon's resolvesToLocalHost. Local reply hints are bare since the 2026-08-27
    // root invariant, but a CROSS-HOST arrival's reply hint still carries the origin
    // triple — a reply to it from the origin's own host copies `member@rig@selfId`,
    // and without this strip that 3-part string would dead-letter as
    // unknown_destination_rig (the reverse dead-letter). C2: LITERAL, case-SENSITIVE self-id match ONLY — no
    // alias/prefix/registry fallback, never 'local' aliasing (matches
    // resolvesToLocalHost's self-id branch). Rider (a): a NON-self suffix is NOT
    // matched here and falls through to the registry lookup + loud unregistered
    // hint below — the sugar never becomes any-unknown-falls-through-to-local. C1
    // fail-open: when selfHostId is absent (daemon down / pre-reconcile / unknown),
    // this branch is skipped and the string passes through EXACTLY as today.
    if (typeof selfHostId === "string" && selfHostId.length > 0 && suffix === selfHostId) {
        if (explicitHost !== undefined && explicitHost !== suffix) {
            return {
                ok: false,
                error: `ambiguous host: --host ${explicitHost} conflicts with the target's host qualifier @${suffix} — name one host`,
            };
        }
        // Routes home: strip the self-suffix, no cross-host sugarHost (local send).
        return { ok: true, target: base, sugarHost: undefined, hint: undefined };
    }
    const loader = registryLoader ?? loadHostRegistry;
    const registry = loader();
    if (!registry.ok) {
        // No registry = no registered suffix can match; pass through unchanged
        // (the plain-target behavior must not gain a new failure mode).
        return { ok: true, target: rawTarget, sugarHost: undefined, hint: unregisteredHint };
    }
    // Sidecar-learned bindings join the match set: a suffix equal to a LEARNED self-id resolves the
    // alias it was learned for (fail-open — a missing/corrupt sidecar is just an empty set).
    const bindings = (bindingsLoader ?? loadHostBindings)().bindings;
    const resolved = resolveHost(registry.registry, suffix, bindings);
    if (!resolved.ok) {
        return { ok: true, target: rawTarget, sugarHost: undefined, hint: unregisteredHint };
    }
    // TWO SPELLINGS OF ONE HOST ARE NOT A CONFLICT. `--host remote-host` beside a target suffix of
    // `@host-84c37990` names the SAME machine once the suffix can match a join key — rejecting it
    // would punish an operator for pasting back the reply hint we printed them, which is the exact
    // workflow this slice exists to make work. Compare the RESOLVED entries, not the raw strings.
    // A genuinely different host, or an explicit host that resolves to nothing, still conflicts loudly.
    const explicitResolved = explicitHost !== undefined
        ? resolveHost(registry.registry, explicitHost, bindings)
        : undefined;
    const namesSameEntry = explicitResolved?.ok === true && explicitResolved.host.id === resolved.host.id;
    if (explicitHost !== undefined && explicitHost !== suffix && !namesSameEntry) {
        return {
            ok: false,
            error: `ambiguous host: --host ${explicitHost} conflicts with the target's host qualifier @${suffix} — name one host`,
        };
    }
    // NORMALIZE TO THE ALIAS. The suffix may have matched the entry's join key rather than its id
    // (a peer's reply hint carries that peer's self-id). Everything downstream treats sugarHost as a
    // registry id and compares it against `h.id`, so hand back the canonical alias, not what was typed.
    // A resolved entry whose learned binding carries a recorded contradiction warns loudly (never blocks).
    const binding = bindings[resolved.host.id];
    const warning = binding?.conflict ? describeBindingConflict(resolved.host.id, binding) : undefined;
    return { ok: true, target: base, sugarHost: resolved.host.id, hint: undefined, ...(warning ? { warning } : {}) };
}
//# sourceMappingURL=cross-host-target.js.map