// OPR.0.4.6.PI1 FR-6 — Pi seat resume (mirrors codex-resume.ts).
//
// Resume is HONEST session-file continuation: relaunch the pi-runner with
// `--session <persisted sessionFile>` (exact file resume — NEVER `--resume`,
// which opens an interactive picker and is forbidden in managed paths). The
// seat never claims warm-process resume (BR-6 / architecture rule 15
// posture). A missing session file returns `retry_fresh`, which the restore
// orchestrator maps to the awaiting-decision stop-and-ask — never a silent
// fresh start.
import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { piTrust, yoloEnabled } from "./yolo-mode.js";
import { piSeatPaths, parsePiRunnerState, buildPiRunnerCommand, buildPendingRunnerState, } from "./pi-runner-protocol.js";
import { observePiResourceTrust, observeOmpApprovalMode } from "../domain/permission-drift.js";
export class PiResumeAdapter {
    tmux;
    fs;
    paths;
    options;
    runtime = "pi";
    /** Operator-facing name in resume messages; Pi keeps main's wording. */
    get label() { return this.runtime === "pi" ? "Pi" : "OMP"; }
    constructor(tmux, fs, paths, options = {}) {
        this.tmux = tmux;
        this.fs = fs;
        this.paths = paths;
        this.options = options;
    }
    canResume(resumeType, resumeToken) {
        return resumeType === `${this.runtime}_session_file` && !!resumeToken;
    }
    async resume(tmuxSessionName, resumeType, resumeToken, cwd, model, 
    // OPR.0.4.8.3 Seam B: persisted resolved posture (resource-trust wording for Pi).
    resolvedPosture) {
        if (!this.canResume(resumeType, resumeToken)) {
            return { ok: false, code: "no_resume", message: `${this.label} resume not available` };
        }
        const sessionFile = resumeToken;
        if (!this.fs.exists(sessionFile)) {
            // The honest zero-session outcome: the caller's retry_fresh mapping
            // realizes the awaiting-decision stop-and-ask (BR-6).
            return { ok: false, code: "retry_fresh", message: `${this.label} resume failed: the persisted session file no longer exists` };
        }
        const seat = piSeatPaths(this.paths.stateRoot, tmuxSessionName);
        this.fs.mkdirp(seat.agentDir);
        this.fs.mkdirp(seat.sessionsDir);
        // Launch-attempt scoping (guard fold): overwrite any stale sidecar from a
        // prior runner instance BEFORE typing the command; verifyResume trusts
        // only states stamped with THIS attempt's launchId. The prior record is
        // read FIRST so the durable catch-up cursor (lastEntryId, FR-5) survives.
        const launchId = (this.options.newLaunchId ?? (() => randomUUID()))();
        const prior = this.fs.exists(seat.runnerStatePath) ? parsePiRunnerState(this.readSafe(seat.runnerStatePath)) : null;
        this.fs.writeFile(seat.runnerStatePath, JSON.stringify(buildPendingRunnerState(launchId, new Date().toISOString(), prior)));
        const trust = this.runtime === "omp"
            ? (yoloEnabled(process.env, resolvedPosture) ? "approve" : "no-approve")
            : piTrust(this.options.trustPosture, process.env, resolvedPosture);
        const appliedLaunch = this.runtime === "omp"
            ? observeOmpApprovalMode(`--approval-mode ${trust === "approve" ? "yolo" : "always-ask"}`)
            : observePiResourceTrust(trust);
        const cmd = buildPiRunnerCommand({
            runtime: this.runtime,
            runnerEntryPath: this.paths.runnerEntryPath,
            sessionName: tmuxSessionName,
            stateRoot: this.paths.stateRoot,
            cwd,
            // The model declaration must survive resume: the runner's provider-key
            // allowlist keys off the declared provider (VM leg finding).
            model: model ?? undefined,
            // OPR.0.4.8.2: Pi RESOURCE TRUST (not a permission policy). Same decision as the launch path:
            // YOLO forces `approve` on every restored seat; otherwise the configured posture.
            trust,
            sessionFile,
            launchId,
            usageFacts: this.runtime === "pi" && (this.options.usageFactsEnabled?.() ?? false),
            openRouterCharge: this.runtime === "pi" && (this.options.openRouterChargeEnabled?.() ?? false),
        });
        const command = this.runtime === "pi" && this.options.seatLaunchEnvironment
            ? await this.options.seatLaunchEnvironment.command(tmuxSessionName, cmd, { runtime: this.runtime })
            : cmd;
        // Short commands retain the direct path; long commands exec from a private script.
        let textResult = await this.tmux.sendShellCommand(tmuxSessionName, command, undefined, { stageIfLong: true, execInScript: true });
        // This refusal precedes any input: retain the bare-command fallback when routing cannot fit.
        if (!textResult.ok && textResult.code === "launch_path_too_long" && command !== cmd) {
            textResult = await this.tmux.sendShellCommand(tmuxSessionName, cmd, undefined, { stageIfLong: true, execInScript: true });
        }
        if (!textResult.ok) {
            return { ok: false, code: "resume_failed", message: textResult.message };
        }
        const result = await this.verifyResume(tmuxSessionName, sessionFile, launchId);
        return result.ok ? { ...result, appliedLaunch } : result;
    }
    // Poll the runner's launch-scoped sidecar ONLY — never stale pane
    // scrollback (a prior instance's READY/ERROR markers survive in the pane,
    // and a prior resume of the SAME file would even match; guard fold,
    // code-review qitem-20260707011908). Resumed = THIS attempt's sidecar is
    // ready AND names exactly the requested session file.
    async verifyResume(tmuxSessionName, sessionFile, launchId) {
        const pollMs = this.options.pollMs ?? 250;
        const maxWaitMs = this.options.maxWaitMs ?? 15_000;
        const sleepFn = this.options.sleep ?? sleep;
        const attempts = Math.max(1, Math.floor(maxWaitMs / Math.max(pollMs, 1)) + 1);
        for (let attempt = 0; attempt < attempts; attempt++) {
            const { runnerStatePath } = piSeatPaths(this.paths.stateRoot, tmuxSessionName);
            const state = this.fs.exists(runnerStatePath) ? parsePiRunnerState(this.readSafe(runnerStatePath)) : null;
            if (state?.launchId === launchId) {
                if (state.exited) {
                    const paneContent = (await this.tmux.capturePaneContent(tmuxSessionName, 40)) ?? "";
                    return {
                        ok: false,
                        code: "resume_failed",
                        message: `${this.label} resume failed: the runner exited (code ${state.exited.code ?? "unknown"})`,
                        evidence: paneContent.split("\n").slice(-12).join("\n"),
                    };
                }
                if (state.ready) {
                    if (state.sessionFile !== sessionFile) {
                        return {
                            ok: false,
                            code: "resume_failed",
                            message: `${this.label} resume failed: the runner is ready but does not report the requested session file`,
                        };
                    }
                    return { ok: true };
                }
            }
            if (attempt < attempts - 1) {
                await sleepFn(pollMs);
            }
        }
        return {
            ok: false,
            code: "resume_failed",
            message: `${this.label} resume failed: timed out waiting for the runner to prove the requested session`,
        };
    }
    readSafe(path) {
        try {
            return this.fs.readFile(path);
        }
        catch {
            return "";
        }
    }
}
//# sourceMappingURL=pi-resume.js.map