// OPR.0.3.4.1 — rig start: one-command recovery orchestrator.
// Sequences existing primitives: daemon-start -> kernel auto-boot observe ->
// candidate listing (restore-usable snapshots) -> picker/flags ->
// per-rig restore (slice-02 /api/up) + reconcile (slice-03). Re-codes nothing.

import { Command } from "commander";
import { DaemonClient, DaemonConnectionError } from "../client.js";
import {
  getDaemonStatus,
  getDaemonUrl,
  startDaemon,
  waitForKernelReady,
  type LifecycleDeps,
} from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
import type { StatusDeps } from "./status.js";

const LONG_RUNNING_UP_TIMEOUT_MS = 120_000;
const KERNEL_WAIT_MS = 60_000;

interface RigSummary {
  id: string;
  name: string;
  nodeCount?: number;
  lifecycleState?: string;
  // Includes intentional stops for restore selection; absent on older daemons.
  restoreLifecycleState?: string;
}

interface PlanPreviewNode {
  logicalId: string;
  intendedAction: string;
  reason?: string;
  // OPR.0.4.3.20 FR-6 — per-seat token truth on the wire (rig start's picker
  // only aggregates intendedAction; `rig up --plan` renders these per seat).
  tokenState?: "present" | "missing" | "stale" | "unverified";
  provenance?: string | null;
  lastVerified?: string | null;
  freshRequired?: boolean;
  runtimePrompt?: string;
}

interface PlanPreviewResponse {
  status: string;
  mode: string;
  rigId: string;
  rigName: string;
  snapshot: { id: string; kind: string; createdAt: string } | null;
  wouldCaptureCurrentState: boolean;
  nodes: PlanPreviewNode[];
  mutated: boolean;
}

export interface StartCandidate {
  rigId: string;
  rigName: string;
  lifecycleState: string;
  nodeCount: number;
  lastActivity: string | null;
  preview: PlanPreviewResponse | null;
  /** What the seats say about the last stop; read only under `--last`, where `down` is kept down. */
  lastStop: LastStopState | null;
}

/**
 * `down`: at least one seat was launched and every launched seat carries the recorded stop
 * intent (`intentionallyStopped`, set by `rig down` and `rig seat stop`).
 * `was_running`: anything else, including a plain `exited` without the intent, a seat the boot
 * reconciler marked `detached` when tmux was lost, and a daemon that does not report the intent.
 * `unknown`: the seat statuses could not be read.
 */
export type LastStopState = "was_running" | "down" | "unknown";

export function lastStopState(nodes: unknown): LastStopState {
  if (!Array.isArray(nodes)) return "unknown";
  let launched = 0;
  let allStoppedOnPurpose = true;
  for (const node of nodes) {
    if (!node || typeof node !== "object" || !("sessionStatus" in node)) return "unknown";
    const { sessionStatus, intentionallyStopped } = node as { sessionStatus: unknown; intentionallyStopped?: unknown };
    if (sessionStatus !== null && typeof sessionStatus !== "string") return "unknown";
    if (intentionallyStopped !== undefined && typeof intentionallyStopped !== "boolean") return "unknown";
    if (sessionStatus === null) continue; // never launched: neutral
    launched++;
    if (intentionallyStopped !== true) allStoppedOnPurpose = false;
  }
  return launched > 0 && allStoppedOnPurpose ? "down" : "was_running";
}

/** Default interactive [y/N] prompt (same shape as up.ts, reused for the TTY path). */
async function defaultPromptYesNo(question: string): Promise<boolean> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/** Minimal spacebar multi-select picker for TTY (NET-NEW, lightweight). */
async function multiSelectPicker(items: Array<{ label: string; value: string; checked: boolean }>): Promise<string[]> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.close();

  const { createInterface } = readline;
  return new Promise<string[]>((resolve) => {
    const state = items.map((item) => ({ ...item }));
    let cursor = 0;

    const render = () => {
      process.stdout.write("\x1b[?25l");
      for (let i = 0; i < state.length; i++) {
        const prefix = i === cursor ? ">" : " ";
        const check = state[i]!.checked ? "[x]" : "[ ]";
        process.stdout.write(`\r${prefix} ${check} ${state[i]!.label}\n`);
      }
      process.stdout.write(`\r  (space=toggle, enter=confirm, a=all, n=none)\n`);
      process.stdout.write(`\x1b[${state.length + 1}A`);
    };

    render();

    if (!process.stdin.isTTY) {
      resolve(state.filter((s) => s.checked).map((s) => s.value));
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write(`\x1b[${state.length + 1}B\r`);
      process.stdout.write("\x1b[?25h");
    };

    const onData = (buf: Buffer) => {
      const key = buf.toString();
      if (key === " ") {
        state[cursor]!.checked = !state[cursor]!.checked;
        render();
      } else if (key === "\r" || key === "\n") {
        cleanup();
        resolve(state.filter((s) => s.checked).map((s) => s.value));
      } else if (key === "\x1b[A" || key === "k") {
        cursor = Math.max(0, cursor - 1);
        render();
      } else if (key === "\x1b[B" || key === "j") {
        cursor = Math.min(state.length - 1, cursor + 1);
        render();
      } else if (key === "a") {
        state.forEach((s) => { s.checked = true; });
        render();
      } else if (key === "n") {
        state.forEach((s) => { s.checked = false; });
        render();
      } else if (key === "\x03") {
        cleanup();
        process.exitCode = 130;
        resolve([]);
      }
    };
    process.stdin.on("data", onData);
  });
}

export interface StartDeps extends StatusDeps {
  promptYesNo?: (question: string) => Promise<boolean>;
  /** Test seam (mirrors upCommand's): inject the preflight exec so auto-start tests
   *  never run real system commands. */
  preflightExec?: (cmd: string) => Promise<string>;
}

export function startCommand(depsOverride?: StartDeps): Command {
  const cmd = new Command("start")
    .description("Start the daemon, verify kernel, and restore rigs that were last running")
    .addHelpText("after", `
Examples:
  rig start                         Interactive: daemon + kernel + pick-and-restore
  rig start --last                  Headless: restore everything that was running, except rigs stopped on purpose
  rig start --all                   Headless: restore rigs that were last running, except rigs stopped on purpose
  rig start --all --allow-downed    Headless: also restore rigs stopped on purpose (explicit override)
  rig start --rigs prod-rig dev-rig Headless: restore only the named rigs
  rig start --plan            Read-only preview; requires a running daemon
`);
  const getDepsF = (): StartDeps =>
    depsOverride ?? { lifecycleDeps: realDeps(), clientFactory: (url: string) => new DaemonClient(url) };

  cmd
    .option("--last", "Headless: restore all rigs that were last running; a rig stopped on purpose (with rig down or rig seat stop) stays down (zero prompts)")
    .option("--all", "Headless: restore rigs with restore-usable snapshots, except rigs stopped on purpose (zero prompts)")
    .option("--rigs <names...>", "Headless: restore only the named rigs (zero prompts)")
    .option("--plan", "Preview restore candidates and planned actions without starting/restoring anything; requires a running daemon")
    .option("--allow-unknown-stop", "With --last or --all: allow restoring rigs whose seat stop intent could not be read (default: fail closed)")
    .option("--allow-downed", "With --all: also restore rigs stopped on purpose with rig down or rig seat stop (explicit override)")
    .option("--json", "JSON output for agents")
    .action(async (opts: { last?: boolean; all?: boolean; rigs?: string[]; plan?: boolean; allowUnknownStop?: boolean; allowDowned?: boolean; json?: boolean }) => {
      const deps = getDepsF();

      if (opts.allowDowned && !opts.all) {
        console.error("--allow-downed only applies to --all. Use --rigs <name> when you intentionally want one downed rig back.");
        process.exitCode = 1;
        return;
      }

      // ---- PHASE 1: ensure daemon is running ----
      let status = await getDaemonStatus(deps.lifecycleDeps);
      if (opts.plan && status.state !== "running") {
        console.error("--plan requires an already-running daemon; no daemon was started and nothing was restored.");
        console.error("Start it first with: rig daemon start");
        process.exitCode = 1;
        return;
      }
      if (status.state !== "running") {
        if (!opts.json) console.log("Starting daemon...");
        try {
          const { ConfigStore } = await import("../config-store.js");
          const configStore = new ConfigStore();
          const resolvedConfig = configStore.resolve();
          const hostResolution = configStore.resolveWithSource("daemon.host");
          const { SystemPreflight } = await import("../system-preflight.js");
          const { execSync } = await import("node:child_process");
          const { OPENRIG_DIR, resolveBindIntent } = await import("../daemon-lifecycle.js");
          // S20 (r2 repair): the SHARED dedicated-intent seam — an env-sourced
          // daemon.host (ENV_MAP ← OPENRIG_HOST, the injected routing channel) never
          // creates bind intent through auto-start; flag-less auto-start honors only a
          // FILE-sourced daemon.host or OPENRIG_BIND_HOST.
          const hostForDaemon = resolveBindIntent({
            flagHost: undefined,
            envBindHost: process.env["OPENRIG_BIND_HOST"],
            configSource: hostResolution.source,
            configHost: resolvedConfig.daemon.host,
          }).host;
          const preflight = new SystemPreflight({
            exec: depsOverride?.preflightExec ?? (async (cmd: string) =>
              execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })),
            configStore,
            getDaemonStatus: () => getDaemonStatus(deps.lifecycleDeps),
            openrigHome: OPENRIG_DIR,
          });
          const preflightResult = await preflight.run();
          if (!preflightResult.ready) {
            for (const check of preflightResult.checks.filter((c) => !c.ok)) {
              console.error(`  ${check.name}: ${check.error}`);
              if (check.fix) console.error(`    Fix: ${check.fix}`);
            }
            process.exitCode = 1;
            return;
          }
          await startDaemon({
            port: resolvedConfig.daemon.port,
            host: hostForDaemon,
            db: resolvedConfig.db.path,
            transcriptsEnabled: resolvedConfig.transcripts.enabled,
            transcriptsPath: resolvedConfig.transcripts.path,
            workspaceRoot: resolvedConfig.workspace.root,
            contextRoot: resolvedConfig.context.root,
            skillsRoot: resolvedConfig.skills.root,
            topologyRoot: resolvedConfig.topology.root,
          }, deps.lifecycleDeps);
          status = await getDaemonStatus(deps.lifecycleDeps);
        } catch (err) {
          console.error(`Daemon start failed: ${err instanceof Error ? err.message : String(err)}`);
          process.exitCode = 2;
          return;
        }
      }

      if (status.state !== "running" || status.healthy === false) {
        console.error("Daemon is not healthy. Check with: rig daemon status");
        process.exitCode = 1;
        return;
      }

      const baseUrl = getDaemonUrl(status);
      const client = deps.clientFactory(baseUrl);

      // ---- PHASE 2: kernel invariant — verify/await kernel readiness ----
      if (!opts.json) console.log("Waiting for kernel...");
      const kernelResult = await waitForKernelReady(baseUrl, KERNEL_WAIT_MS);
      if (!kernelResult.ok) {
        if (kernelResult.kernelState === "skipped") {
          // The daemon also skips its boot when a kernel rig already exists (kernel-boot.ts).
          // That rig need not be running, after a reboot it is not, and this command does not restore it.
          if (!opts.json) console.log(kernelResult.detail === "kernel rig already managed"
            ? "Kernel auto-boot skipped (kernel rig already managed). If its seats are not running, for example after a reboot, bring it back with: rig up kernel --existing"
            : "Kernel auto-boot skipped (--no-kernel or test mode), including the operator that helps you start a team. To start it later, run rig, set up or select kernel, then start its operator seat.");
        } else {
          const terminalFailure = ["auth_blocked", "spec_missing", "bootstrap_failed", "degraded"].includes(kernelResult.kernelState ?? "");
          console.error(`${terminalFailure ? "Kernel failed to start" : "Kernel did not report ready before the deadline"}: state=${kernelResult.kernelState ?? "unknown"}, detail=${kernelResult.detail ?? "none"}`);
          console.error("Cannot proceed to rig restore without a working kernel.");
          console.error("Fix: resolve the kernel issue, then rerun: rig start");
          process.exitCode = 1;
          return;
        }
      } else if (!opts.json) {
        console.log("Kernel ready.");
      }

      // Verify UI is actually serving before announcing the URL.
      let uiUrl: string | null = null;
      try {
        const healthRes = await fetch(`${baseUrl}/healthz`);
        if (healthRes.ok) {
          uiUrl = baseUrl;
        }
      } catch { /* UI not serving yet — degrade gracefully */ }
      if (uiUrl && !opts.json) {
        console.log(`UI: ${uiUrl}`);
      }

      // ---- PHASE 3: list last-running candidates ----
      let allSummaries: RigSummary[];
      try {
        const res = await client.get<RigSummary[]>("/api/rigs/summary");
        if (res.status !== 200) throw new Error(`Daemon returned HTTP ${res.status}`);
        allSummaries = res.data ?? [];
      } catch (err) {
        console.error(`Failed to list rigs: ${err instanceof Error ? err.message : String(err)}. Daemon may not be ready.`);
        process.exitCode = 1;
        return;
      }

      // Guard BLOCKING f359e3a3: use the id-based Explorer route for candidate
      // preview (POST /api/rigs/:id/up with plan:true) instead of the name-based
      // POST /api/up which 409s on same-name rigs and silently drops them.
      const candidates: StartCandidate[] = [];
      // Guard BLOCKING bfed4ce3: track preview errors so they are not collapsed
      // into a clean empty-candidate result.
      const previewErrors: Array<{ rigId: string; rigName: string; code: string; message: string }> = [];
      // Not errors: the run still succeeds. Only --last adds them (seat_status_unreadable).
      const warnings: Array<{ rigId: string; rigName: string; code: string; message: string }> = [];
      // --all wins over --last. Both intent-sensitive headless modes read the
      // seats; --plan reads them too so its preview can mark intentionally
      // stopped rigs. Explicit --rigs and the interactive picker stay explicit.
      const intentSensitive = Boolean(opts.all || opts.last);
      const inspectStopIntent = Boolean(opts.all || opts.last || opts.plan);
      for (const rig of allSummaries) {
        if (rig.name === "kernel") continue;
        const lifecycleState = rig.restoreLifecycleState ?? rig.lifecycleState;
        if (lifecycleState === "running") continue;

        try {
          const planRes = await client.post<Record<string, unknown>>(
            `/api/rigs/${encodeURIComponent(rig.id)}/up`,
            { plan: true },
          );
          if (planRes.status === 200 && planRes.data["status"] === "plan") {
            const preview = planRes.data as unknown as PlanPreviewResponse;

            let lastActivity: string | null = null;
            try {
              const rigDetail = await client.get<{ sessions?: Array<{ lastSeenAt?: string | null }> }>(`/api/rigs/${rig.id}`);
              const sessions = rigDetail.data?.sessions ?? [];
              const dates = sessions.map((s) => s.lastSeenAt).filter((d): d is string => !!d).sort();
              lastActivity = dates.length > 0 ? dates[dates.length - 1]! : null;
            } catch { /* degrade: lastActivity stays null */ }

            let lastStop: LastStopState | null = null;
            if (inspectStopIntent) {
              lastStop = "unknown";
              try {
                const nodesRes = await client.get<unknown>(`/api/rigs/${encodeURIComponent(rig.id)}/nodes`);
                if (nodesRes.status === 200) lastStop = lastStopState(nodesRes.data);
              } catch { /* lastStop stays unknown; --last restores only with --allow-unknown-stop */ }
            }

            candidates.push({
              rigId: rig.id,
              rigName: rig.name,
              lifecycleState: lifecycleState ?? "unknown",
              nodeCount: rig.nodeCount ?? 0,
              lastActivity,
              preview,
              lastStop,
            });
          } else if (planRes.status === 404) {
            // no_snapshot or not found — this rig is not a candidate (expected exclusion).
          } else {
            const code = String(planRes.data["code"] ?? `http_${planRes.status}`);
            const errorText = String(planRes.data["error"] ?? "preview failed");
            previewErrors.push({ rigId: rig.id, rigName: rig.name, code, message: errorText });
            if (!opts.json) console.error(`  ${rig.name}: candidate preview failed -- ${errorText} (${code})`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          previewErrors.push({ rigId: rig.id, rigName: rig.name, code: "transport_error", message: msg });
          if (!opts.json) console.error(`  ${rig.name}: candidate preview unavailable (transport error)`);
        }
      }

      if (candidates.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({
            status: previewErrors.length > 0 ? "started_with_errors" : "started",
            candidates: [],
            keptDown: intentSensitive ? [] : undefined,
            restoredRigs: [],
            previewErrors: previewErrors.length > 0 ? previewErrors : undefined,
          }));
        } else {
          if (previewErrors.length > 0) {
            console.error(`${previewErrors.length} rig(s) failed preview (see errors above). Some candidates may be missing.`);
          } else {
            console.log("Daemon and kernel are up. No rigs to restore.");
          }
        }
        if (previewErrors.length > 0) process.exitCode = 1;
        return;
      }

      // ---- PHASE 3b: --plan is a read-only preview; never restore ----
      if (opts.plan) {
        let previewCandidates = [...candidates];
        if (opts.rigs) {
          previewCandidates = previewCandidates.filter((c) => opts.rigs!.includes(c.rigName));
          const missing = opts.rigs.filter((n) => !candidates.some((c) => c.rigName === n));
          if (missing.length > 0) {
            console.error(`Rig(s) not found in candidate set: ${missing.join(", ")}`);
            process.exitCode = 1;
            return;
          }
        }
        const plan = previewCandidates.map((c) => ({
          rigId: c.rigId,
          rigName: c.rigName,
          lifecycleState: c.lifecycleState,
          status: c.lastStop === "down" ? "intentionally_stopped" : c.lastStop === "unknown" ? "unknown_stop_intent" : "candidate",
          intendedActions: (c.preview?.nodes ?? []).map((n) => ({
            logicalId: n.logicalId,
            intendedAction: n.intendedAction,
            reason: n.reason ?? null,
          })),
        }));
        const plannedKeptDown = opts.all && opts.allowDowned
          ? []
          : previewCandidates.filter((c) => c.lastStop === "down");
        if (opts.json) {
          console.log(JSON.stringify({
            status: "planned",
            command: "rig start --plan",
            candidates: plan,
            keptDown: plannedKeptDown.map(keptDownEntry),
            previewErrors: previewErrors.length > 0 ? previewErrors : undefined,
          }));
        } else {
          console.log(`\n${plan.length} rig(s) in restore plan (no restore performed):\n`);
          for (const p of plan) {
            console.log(`  ${p.rigName}  (${p.lifecycleState}, ${p.status})`);
            for (const a of p.intendedActions) console.log(`    ${a.logicalId}: ${a.intendedAction}${a.reason ? ` (${a.reason})` : ""}`);
          }
        }
        if (previewErrors.length > 0) process.exitCode = 1;
        return;
      }

      // ---- PHASE 4: selection (id-grounded, rev1 BLOCKING b4c6ada4) ----
      let selectedCandidates: StartCandidate[];
      // --all and --last keep down a rig whose every launched seat carries the
      // recorded stop intent. --all needs an explicit --allow-downed override;
      // --last names the command that brings it back. Explicit --rigs remains a
      // deliberate override. Unknown intent fails closed in both headless modes.
      const keptDown = intentSensitive
        ? candidates.filter((c) => c.lastStop === "down" && !(opts.all && opts.allowDowned))
        : [];
      const unknownStop = intentSensitive ? candidates.filter((c) => c.lastStop === "unknown") : [];
      if (unknownStop.length > 0 && !opts.allowUnknownStop) {
        const names = unknownStop.map((c) => c.rigName).join(", ");
        const modeLabel = opts.all ? "--all" : "--last";
        if (opts.json) {
          console.log(JSON.stringify({
            status: "blocked",
            code: "unknown_stop_intent",
            rigs: unknownStop.map((c) => c.rigName),
            nextAction: "Inspect with rig ps and rig start --plan; rerun with --allow-unknown-stop only if intentional.",
          }));
        } else {
          console.error(`  Refusing ${modeLabel}: cannot read stop intent for: ${names}`);
          console.error("  Nothing was restored. Inspect with: rig ps / rig start --plan");
          console.error("  If you intentionally want to restore them, rerun with --allow-unknown-stop.");
        }
        process.exitCode = 1;
        return;
      }
      for (const c of unknownStop) {
        const message = "restored because its seat statuses could not be read (--allow-unknown-stop)";
        warnings.push({ rigId: c.rigId, rigName: c.rigName, code: "seat_status_unreadable", message });
        if (!opts.json) console.error(`  ${c.rigName}: ${message}`);
      }
      if (opts.all) {
        selectedCandidates = candidates.filter((c) => c.lastStop !== "down" || opts.allowDowned);
        if (!opts.json) {
          for (const c of keptDown) {
            console.log(`  ${c.rigName}: stopped on purpose (with rig down or rig seat stop), so --all leaves it down. Bring it back: ${restoreCommand(c)} or rerun with --allow-downed`);
          }
        }
      } else if (opts.last) {
        selectedCandidates = candidates.filter((c) => c.lastStop !== "down");
        if (!opts.json) {
          for (const c of keptDown) console.log(`  ${c.rigName}: stopped on purpose (with rig down or rig seat stop), so --last leaves it down. Bring it back: ${restoreCommand(c)}`);
        }
      } else if (opts.rigs) {
        selectedCandidates = candidates.filter((c) => opts.rigs!.includes(c.rigName));
        const missing = opts.rigs.filter((n) => !candidates.some((c) => c.rigName === n));
        if (missing.length > 0) {
          console.error(`Rig(s) not found in candidate set: ${missing.join(", ")}`);
          console.error(`Available candidates: ${candidates.map((c) => c.rigName).join(", ")}`);
          process.exitCode = 1;
          return;
        }
      } else {
        // TTY interactive: offer fast default + picker
        const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
        if (!interactive) {
          console.error("No TTY available. Use --last, --all, or --rigs <names> for headless mode.");
          if (opts.json) {
            console.log(JSON.stringify({ status: "started", candidates: candidates.map((c) => ({ rigName: c.rigName, lifecycleState: c.lifecycleState })), restoredRigs: [] }));
          }
          process.exitCode = 1;
          return;
        }

        console.log(`\n${candidates.length} rig(s) were last running:\n`);
        for (const c of candidates) {
          const readiness = summarizeReadiness(c);
          const activity = c.lastActivity ? `last active ${c.lastActivity}` : "";
          console.log(`  ${c.rigName}  (${c.nodeCount} seats, ${c.lifecycleState}${activity ? ", " + activity : ""})  ${readiness}`);
        }
        console.log("");

        const ask = depsOverride?.promptYesNo ?? defaultPromptYesNo;
        const restoreAll = await ask(`Restore all ${candidates.length} rig(s)? [Y/pick] `);

        if (restoreAll) {
          selectedCandidates = [...candidates];
        } else {
          const pickedIds = await multiSelectPicker(
            candidates.map((c) => ({
              label: `${c.rigName}  (${c.nodeCount} seats, ${c.lifecycleState})  ${summarizeReadiness(c)}`,
              value: c.rigId,
              checked: true,
            })),
          );
          selectedCandidates = candidates.filter((c) => pickedIds.includes(c.rigId));
        }
      }

      if (selectedCandidates.length === 0) {
        if (!opts.json) console.log("No rigs selected for restore.");
        else if (intentSensitive) {
          console.log(JSON.stringify({
            status: previewErrors.length > 0 ? "started_with_errors" : "started",
            uiUrl,
            candidates: candidates.map((c) => ({ rigName: c.rigName, lifecycleState: c.lifecycleState })),
            keptDown: keptDown.map(keptDownEntry),
            restoredRigs: [],
            previewErrors: previewErrors.length > 0 ? previewErrors : undefined,
          }));
        }
        if (intentSensitive && previewErrors.length > 0) process.exitCode = 1;
        return;
      }

      // ---- PHASE 5: restore each selected rig via id-based route (compose slice-02 path) ----
      if (!opts.json) console.log(`\nRestoring ${selectedCandidates.length} rig(s)...\n`);

      const results: Array<{
        rigName: string;
        status: string;
        snapshotId?: string;
        snapshotKind?: string;
        preRestoreSnapshotId?: string | null;
        warnings?: string[];
        nodes: Array<{ logicalId: string; status: string; error?: string }>;
      }> = [];
      // Any non-2xx restore/fresh request is a failure even when its error code
      // is one this CLI did not know about when the set below was written.
      let restoreRequestFailed = false;

      for (const candidate of selectedCandidates) {
        const rigName = candidate.rigName;
        const rigId = candidate.rigId;

        // Check if the rig is already running (idempotent rerun: reconcile, don't relaunch).
        try {
          const freshSummary = await client.get<RigSummary[]>("/api/rigs/summary");
          const current = (freshSummary.data ?? []).find((r) => r.id === rigId);
          if ((current?.restoreLifecycleState ?? current?.lifecycleState) === "running") {
            if (!opts.json) console.log(`  ${rigName}: already running (skipping)`);
            results.push({ rigName, status: "already_running", nodes: [] });
            continue;
          }
        } catch { /* proceed with restore attempt */ }

        try {
          // Rev1 BLOCKING b4c6ada4: use id-based route for restore too (not
          // name-based /api/up which 409s on same-name rigs).
          const res = await client.post<Record<string, unknown>>(
            `/api/rigs/${encodeURIComponent(rigId)}/up`,
            { plan: false },
            { timeoutMs: LONG_RUNNING_UP_TIMEOUT_MS },
          );

          // Guard BLOCKING 25661f72: check HTTP status before treating the response
          // as a success. The daemon returns non-2xx JSON payloads (rig_not_stopped,
          // pre_restore_validation_failed, ambiguous_name) without throwing.
          if (res.status >= 400) {
            restoreRequestFailed = true;
            const code = res.data["code"] as string | undefined;
            const errorText = String(res.data["error"] ?? "restore failed");
            if (code === "pre_restore_validation_failed") {
              console.error(`  ${rigName}: restore blocked (pre-validation failed)`);
              const blockers = (res.data["blockers"] as Array<{ message: string; remediation: string }>) ?? [];
              for (const b of blockers) {
                console.error(`    ${b.message}`);
                console.error(`      fix: ${b.remediation}`);
              }
            } else {
              console.error(`  ${rigName}: ${errorText} (${code ?? `HTTP ${res.status}`})`);
            }
            results.push({ rigName, status: code ?? "error", nodes: [] });
            continue;
          }

          const resStatus = res.data["status"] as string;
          const nodes = (res.data["nodes"] as Array<{ logicalId: string; status: string; error?: string }>) ?? [];
          const rigResult = res.data["rigResult"] as string | undefined;
          let finalNodes = nodes;
          let finalStatus = rigResult ?? resStatus;
          let finalSnapshotId = typeof res.data["snapshotId"] === "string" ? res.data["snapshotId"] : undefined;
          let finalSnapshotKind = typeof res.data["snapshotKind"] === "string" ? res.data["snapshotKind"] : undefined;
          let finalPreRestoreSnapshotId = res.data["preRestoreSnapshotId"] === null
            ? null
            : typeof res.data["preRestoreSnapshotId"] === "string"
              ? res.data["preRestoreSnapshotId"]
              : undefined;
          let finalWarnings = Array.isArray(res.data["warnings"])
            ? (res.data["warnings"] as unknown[]).filter((warning): warning is string => typeof warning === "string")
            : [];

          if (!opts.json) {
            console.log(`  ${rigName}: ${rigResult ?? resStatus}`);
            for (const n of nodes) {
              if (n.status === "awaiting-decision" && n.error) {
                console.log(`    ${n.logicalId}: awaiting-decision -- ${n.error}`);
              } else {
                console.log(`    ${n.logicalId}: ${n.status}`);
              }
            }
          }

          // Handle the awaiting-decision ASK (compose the slice-02 TTY flow).
          const awaiting = nodes.filter((n) => n.status === "awaiting-decision");
          if (awaiting.length > 0) {
            const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) || Boolean(depsOverride?.promptYesNo);
            if (interactive) {
              const ask = depsOverride?.promptYesNo ?? defaultPromptYesNo;
              const accepted: string[] = [];
              for (const n of awaiting) {
                const reason = n.error ?? "original session unresumable";
                const yes = await ask(`    Couldn't resume ${n.logicalId} (reason: ${reason}). Fresh-prime? [y/N] `);
                if (yes) accepted.push(n.logicalId);
              }
              if (accepted.length > 0) {
                const freshWarnings: string[] = [];
                for (const logicalId of accepted) {
                  const awaitingNode = awaiting.find((node) => node.logicalId === logicalId);
                  const seatRef = `${logicalId}@${rigName}`;
                  // A whole-rig /up retry is refused as rig_not_stopped once a sibling
                  // became live. Fresh-prime exactly the held seats through the same
                  // per-seat route as `rig seat launch <seat> --fresh --reason`.
                  const reason = `rig start fresh-prime for ${logicalId} after awaiting-decision (${awaitingNode?.error ?? "original session unresumable"})`;
                  try {
                    const freshRes = await client.post<Record<string, unknown>>(
                      `/api/seat/launch/${encodeURIComponent(seatRef)}`,
                      { fresh: true, reason },
                      { timeoutMs: LONG_RUNNING_UP_TIMEOUT_MS },
                    );
                    const body = freshRes.data;
                    const daemonStatus = typeof body["status"] === "string" ? body["status"] : undefined;
                    if (Array.isArray(body["warnings"])) {
                      freshWarnings.push(...(body["warnings"] as unknown[]).filter((warning): warning is string => typeof warning === "string"));
                    }
                    if (freshRes.status >= 400 || body["ok"] !== true || daemonStatus === "attention_required" || daemonStatus === "failed") {
                      restoreRequestFailed = true;
                      const status = daemonStatus === "attention_required" ? "attention_required" : "failed";
                      const error = typeof body["message"] === "string"
                        ? body["message"]
                        : typeof body["error"] === "string"
                          ? body["error"]
                          : `fresh launch failed (HTTP ${freshRes.status})`;
                      finalNodes = mergeRestoreNodes(finalNodes, [{ logicalId, status, error }]);
                      if (!opts.json) console.error(`    ${logicalId}: ${status} -- ${error}`);
                      continue;
                    }
                    const launchedSeat = body["seat"] as { logicalId?: unknown } | undefined;
                    const outcomeLogicalId = typeof launchedSeat?.logicalId === "string" ? launchedSeat.logicalId : logicalId;
                    finalNodes = mergeRestoreNodes(finalNodes, [{ logicalId: outcomeLogicalId, status: "fresh-primed" }]);
                    if (!opts.json) console.log(`    ${outcomeLogicalId}: fresh-primed`);
                  } catch (err) {
                    restoreRequestFailed = true;
                    const error = err instanceof DaemonConnectionError
                      ? "fresh launch timed out; outcome unknown. Verify with: rig ps"
                      : err instanceof Error ? err.message : String(err);
                    finalNodes = mergeRestoreNodes(finalNodes, [{ logicalId, status: "failed", error }]);
                    if (!opts.json) console.error(`    ${logicalId}: fresh launch failed -- ${error}`);
                  }
                }
                if (freshWarnings.length > 0) {
                  finalWarnings = [...new Set([...finalWarnings, ...freshWarnings])];
                }
                // An operator-approved fresh-prime is a deliberate recovery, not
                // the original awaiting-decision failure. Clear the stale failure
                // status only when every final node is actually running.
                if (finalNodes.length > 0 && finalNodes.every((n) => CLEAN_RESTORE_NODE_STATUSES.has(n.status))) {
                  finalStatus = "fully_restored";
                }
              } else if (!opts.json) {
                console.log(`    No fresh sessions started for ${rigName}.`);
              }
            } else {
              // Headless: report honestly, no auto-substitute.
              for (const n of awaiting) {
                if (!opts.json) console.error(`    ${n.logicalId}: awaiting-decision -- to fresh-prime this seat: rig seat launch ${n.logicalId}@${rigName} --fresh --reason "..."`);
              }
            }
          }

          if (!opts.json) {
            if (finalSnapshotId) console.log(`    snapshot: ${finalSnapshotId} (${finalSnapshotKind ?? "unknown"})`);
            if (finalPreRestoreSnapshotId !== undefined) console.log(`    pre-restore snapshot: ${finalPreRestoreSnapshotId ?? "none"}`);
            for (const warning of finalWarnings) console.error(`    warning: ${warning}`);
          }
          results.push({
            rigName,
            status: finalStatus,
            snapshotId: finalSnapshotId,
            snapshotKind: finalSnapshotKind,
            preRestoreSnapshotId: finalPreRestoreSnapshotId,
            warnings: finalWarnings.length > 0 ? finalWarnings : undefined,
            nodes: finalNodes,
          });
        } catch (err) {
          if (err instanceof DaemonConnectionError) {
            console.error(`  ${rigName}: timed out; the daemon may still be processing. Verify with: rig ps`);
            results.push({ rigName, status: "timeout", nodes: [] });
          } else {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`  ${rigName}: ${msg}`);
            results.push({ rigName, status: "error", nodes: [] });
          }
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({
          status: previewErrors.length > 0 ? "started_with_errors" : "started",
          uiUrl,
          candidates: candidates.map((c) => ({ rigName: c.rigName, lifecycleState: c.lifecycleState })),
          keptDown: intentSensitive ? keptDown.map(keptDownEntry) : undefined,
          restoredRigs: results,
          previewErrors: previewErrors.length > 0 ? previewErrors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
        }));
      }

      // Exit code: 1 if any rig has a non-clean outcome. HTTP failures are
      // tracked independently so an unknown/new daemon error code cannot look
      // clean. Per-node truth owns the rest: anything outside the explicit
      // running/clean vocabulary is a failure, including attention_required.
      const NON_CLEAN_STATUSES = new Set([
        "timeout",
        "error",
        "skipped",
        "partially_restored",
        "failed",
        "not_attempted",
        "rig_not_stopped",
        "ambiguous_name",
        "pre_restore_validation_failed",
        "restore_in_progress",
        "service_boot_failed",
        "restore_error",
        "restore_failed",
        "attention_required",
        "startup_failed",
        "launch_failed",
        "provider_prerequisite",
        "no_snapshot",
        "snapshot_not_found",
        "snapshot_wrong_rig",
        "snapshot_unusable",
        "no_usable_snapshot",
        "rig_not_found",
        "operation_in_progress",
      ]);
      const hasFailure = previewErrors.length > 0 || restoreRequestFailed || results.some((r) =>
        NON_CLEAN_STATUSES.has(r.status) ||
        r.nodes.some((n) => !CLEAN_RESTORE_NODE_STATUSES.has(n.status)),
      );
      if (hasFailure) process.exitCode = 1;
    });

  return cmd;
}

const CLEAN_RESTORE_NODE_STATUSES = new Set(["resumed", "rebuilt", "fresh", "fresh-primed", "operator_recovered"]);

function mergeRestoreNodes(
  existing: Array<{ logicalId: string; status: string; error?: string }>,
  updates: Array<{ logicalId: string; status: string; error?: string }>,
): Array<{ logicalId: string; status: string; error?: string }> {
  const byLogicalId = new Map(existing.map((node) => [node.logicalId, node]));
  for (const update of updates) byLogicalId.set(update.logicalId, update);
  return [...byLogicalId.values()];
}

function restoreCommand(c: StartCandidate): string {
  return `rig start --rigs ${c.rigName}`;
}

function keptDownEntry(c: StartCandidate): { rigName: string; restoreCommand: string } {
  return { rigName: c.rigName, restoreCommand: restoreCommand(c) };
}

function summarizeReadiness(c: StartCandidate): string {
  if (!c.preview) return "";
  const actions = c.preview.nodes.map((n) => n.intendedAction);
  if (actions.every((a) => a === "resume-original")) return "[ready to resume]";
  if (actions.some((a) => a === "awaiting-decision")) return "[will ask before fresh]";
  if (actions.every((a) => a === "fresh-primed")) return "[fresh start]";
  return "[mixed]";
}
