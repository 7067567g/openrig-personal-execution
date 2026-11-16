import { createHash } from "node:crypto";
import fs from "node:fs";
import nodePath from "node:path";
import Database from "better-sqlite3";
import { isStagedSendScriptPath } from "../adapters/tmux.js";
import { codexCommandResumeToken, listNativeProcesses, processArgv, verifyCodexPaneProcess, } from "./native-process-lineage.js";
import { CodexThreadIdResolver, resolveCodexDbPaths } from "./codex-thread-id.js";
import { isShellForeground } from "./shell-classifier.js";
import { terminatePaneInPlace } from "./pane-cutover.js";
import { rebindAndVerifyPaneIdentity } from "./seat-attention-reconciler.js";
import { emittedEffortFromArgv } from "./seat-effort.js";
import { CODEX_NETWORK_DEFAULT_OVERRIDE } from "./codex-network-default.js";
const RESTART_STARTED = "seat.restart_in_place_started";
const RESTART_FINISHED = "seat.restart_in_place_finished";
const API_KEY_NAMES = ["OPENAI_API_KEY", "CODEX_API_KEY"];
const NOT_VERIFIED = [
    "Which account the restarted Codex actually uses: only `--verify` with --expect-account and a completed tool turn can confirm it.",
    "Whether Codex saved the conversation before it exited (TERM, then KILL after the timeout).",
];
export class CodexInPlaceRestart {
    deps;
    io;
    timing;
    listProcesses;
    now;
    daemonStartedAt;
    constructor(deps) {
        this.deps = deps;
        this.io = { ...defaultInPlaceRestartIo(), ...deps.io };
        this.timing = {
            pollMs: deps.timing?.pollMs ?? 100,
            timeoutMs: deps.timing?.timeoutMs ?? 3_000,
            sleep: deps.timing?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
        };
        this.listProcesses = deps.listProcesses ?? listNativeProcesses;
        this.now = deps.now ?? (() => new Date());
        this.daemonStartedAt = deps.daemonStartedAt ?? new Date(Date.now() - process.uptime() * 1000);
    }
    /** The newest started-event seq for a node; a request records it before waiting for the lifecycle lease. */
    latestStartedSeq(nodeId) {
        const row = this.deps.db.prepare("SELECT MAX(seq) AS seq FROM events WHERE node_id = ? AND type = ?")
            .get(nodeId, RESTART_STARTED);
        return row?.seq ?? 0;
    }
    /** Every gate, read-only. Returns the report a restart would start from, or the refusal it would give. */
    async plan(target) {
        const observed = await this.observe(target, null);
        if (!observed.ok)
            return observed;
        return { ...observed.report, message: "Preview only: nothing was stopped or restarted." };
    }
    async execute(target, input) {
        const observed = await this.observe(target, input.seenStartedSeq);
        if (!observed.ok)
            return observed;
        const { report } = observed;
        const { sessionName, seat } = target;
        this.persist({
            type: RESTART_STARTED, rigId: seat.rigId, nodeId: seat.nodeId, logicalId: seat.logicalId, sessionName,
            pane: report.pane, paneShape: report.paneShape, oldPid: observed.codexPid, oldStartedAt: observed.codexStartedAt,
            codexHome: report.codexHome, reason: input.reason.trim(), operator: input.operator,
        });
        // From here every exit records a result, including a throw: a started restart with no result would
        // otherwise refuse every later restart and preview of this seat.
        const progress = { stage: "stop", paneHeld: undefined };
        let result;
        try {
            result = await this.restart(target, observed, progress);
        }
        catch (error) {
            result = {
                ...report, outcome: "native_unknown", recoveryCommand: observed.relaunch.core,
                ...(progress.paneHeld ? { paneHeld: progress.paneHeld } : {}),
                couldNotSee: [`what happened after an error during ${progress.stage}: ${error instanceof Error ? error.message : String(error)}`],
                message: `The restart stopped with an error during ${progress.stage}; the seat's state was not observed afterwards.`,
            };
        }
        // The Account lines already in the pane when the restart finished. --verify counts only lines beyond
        // these, so text that was there before (anywhere in history or on screen) is never evidence.
        const accountLinesAtRestart = result.outcome === "restarted_account_unverified"
            ? accountLineCounts(await this.deps.tmux.capturePaneHistory(result.pane).catch(() => null))
            : null;
        this.persist({
            type: RESTART_FINISHED, rigId: seat.rigId, nodeId: seat.nodeId, logicalId: seat.logicalId, sessionName,
            outcome: result.outcome, newPid: result.newProcess?.pid ?? null, newStartedAt: result.newProcess?.startedAt ?? null,
            codexHome: result.codexHome, paneHeld: result.paneHeld ? true : false, accountLinesAtRestart, finishedAt: this.now().toISOString(),
        });
        return result;
    }
    /** The restart after its started event. Updates `progress` so a throw is reported at its stage. */
    async restart(target, observed, progress) {
        const { report, codexPid, codexStartedAt, panePid, relaunch, priorRemainOnExit, cwd, oldExe } = observed;
        const { sessionName } = target;
        const pane = report.pane;
        // What resumes the original by hand: the exact relaunch command, without the seat environment wrapper.
        const recoveryCommand = relaunch.core;
        let launch;
        if (report.paneShape === "shell_backed") {
            const stopped = await this.stopUnderShell(pane, panePid, codexPid, codexStartedAt);
            if (stopped === "running") {
                return { ...report, outcome: "not_started", recoveryCommand, message: "Codex did not exit after TERM and KILL; nothing was restarted and the original process is still running." };
            }
            if (stopped === "unknown") {
                return { ...report, outcome: "native_unknown", recoveryCommand, couldNotSee: ["whether the original Codex exited and the pane's shell is back in the foreground"],
                    message: "Signals were sent, but the pane could not be observed afterwards; no resume was attempted." };
            }
            // The shell is back: type the exact resume command the checks ran on, built from the running Codex's
            // choices, and prove the resume. Preparing the launch again here would decide those choices afresh.
            progress.stage = "resume";
            launch = await this.deps.codex.sendResumeCommand(sessionName, relaunch.command, report.conversationId);
            if (!launch.ok)
                return this.incomplete(report, launch, recoveryCommand);
            progress.stage = "identity check";
            return this.verifyReplacement(target, report, oldExe);
        }
        // Hold the pane before any signal: without remain-on-exit, Codex exiting would destroy the pane and
        // there would be nothing to respawn into. The hold counts only once tmux reads it back as on.
        progress.stage = "pane hold";
        const set = await this.deps.tmux.setRemainOnExit(pane, true);
        const readBack = await this.deps.tmux.getPaneLocalOption(pane, "remain-on-exit");
        if (readBack !== "on") {
            const undo = readBack !== priorRemainOnExit ? await this.deps.tmux.restorePaneOption(pane, "remain-on-exit", priorRemainOnExit) : { ok: true };
            const why = !set.ok ? set.message : readBack === undefined ? "the setting could not be read back" : `it reads back as ${readBack ?? "unset"}`;
            return { ...report, outcome: "not_started", recoveryCommand,
                ...(undo.ok ? {} : { warnings: [...report.warnings, `remain-on-exit could not be put back to ${priorRemainOnExit ?? "unset"}: ${undo.message}`] }),
                message: `Nothing was stopped: the pane could not be held with remain-on-exit (${why}), so the original Codex was not signalled and is still running.` };
        }
        const held = { option: "remain-on-exit", value: "on", previous: priorRemainOnExit,
            detail: "Left on so the pane survives for recovery; restored only after a verified live replacement." };
        progress.paneHeld = held;
        progress.stage = "stop";
        const terminated = await terminatePaneInPlace(this.deps.tmux, pane, this.timing, "Codex");
        if (!terminated.ok)
            return this.afterFailedStop(target, report, observed, held, recoveryCommand, terminated.message, progress);
        // Respawn the dead pane WITHOUT -k (scrollback stays) with the resume command as its own command.
        progress.stage = "respawn";
        const respawned = await this.deps.tmux.respawnPane(pane, relaunch.command, { cwd });
        if (!respawned.ok) {
            return this.afterFailedStop(target, report, observed, held, recoveryCommand, `the pane could not be respawned: ${respawned.message}`, progress);
        }
        if (respawned.warnings)
            report.warnings.push(...respawned.warnings);
        progress.stage = "resume";
        launch = await this.deps.codex.verifyResumeInPane(sessionName, report.conversationId);
        if (!launch.ok)
            return this.incomplete(report, launch, recoveryCommand, held);
        progress.stage = "identity check";
        const verified = await this.verifyReplacement(target, report, oldExe);
        if (verified.outcome !== "restarted_account_unverified")
            return { ...verified, paneHeld: held };
        progress.stage = "restoring remain-on-exit";
        const restored = await this.deps.tmux.restorePaneOption(pane, "remain-on-exit", priorRemainOnExit);
        if (!restored.ok) {
            return { ...verified, paneHeld: { ...held, detail: `The replacement is verified, but remain-on-exit could not be restored: ${restored.message}` } };
        }
        progress.paneHeld = undefined;
        return verified;
    }
    /**
     * `--verify`: after the operator has had the restarted seat complete a real tool-using turn (and, for
     * account evidence, shown Codex's /status), read what Codex recorded. `moved` needs BOTH a completed
     * tool call in this conversation since the restart, with no error event, AND an account line on the
     * pane that names the expected account. Nothing is typed into the seat.
     */
    async verify(target, input) {
        const rows = this.deps.db.prepare("SELECT type, payload FROM events WHERE node_id = ? AND type IN (?, ?) ORDER BY seq DESC LIMIT 1")
            .all(target.seat.nodeId, RESTART_STARTED, RESTART_FINISHED);
        const latest = rows[0];
        if (!latest)
            return { ok: false, code: "no_restart_recorded", message: "This seat has no recorded in-place restart to verify." };
        if (latest.type === RESTART_STARTED)
            return { ok: false, code: "restart_not_completed", message: "The latest in-place restart of this seat has not finished." };
        const finished = JSON.parse(latest.payload);
        if (finished.outcome !== "restarted_account_unverified") {
            return { ok: false, code: "restart_not_completed", message: `The latest in-place restart ended ${finished.outcome}; there is nothing to verify.` };
        }
        const current = await this.observeCodex(target.binding.tmuxPane, null);
        if (!current || current.process.pid !== finished.newPid || (current.process.startedAt ?? null) !== finished.newStartedAt) {
            return { ok: false, code: "seat_restarted_since", message: "The seat's Codex is no longer the process the restart started; verify the current occupant another way." };
        }
        const conversationId = readResumeToken(this.deps.db, target.sessionId);
        const toolTurn = this.readToolTurn(finished.codexHome, conversationId, finished.finishedAt);
        const accountEvidence = await this.readAccountLine(target.binding.tmuxPane, finished.accountLinesAtRestart ?? null, input.expectAccount ?? null);
        const moved = toolTurn.state === "observed" && toolTurn.completed > 0 && toolTurn.errors === 0 && accountEvidence.state === "matched";
        return {
            ok: true, seat: target.seat, outcome: moved ? "moved" : "restarted_account_unverified", toolTurn, accountEvidence,
            message: moved
                ? "Moved: a tool turn completed in the same conversation since the restart, and Codex's status names the expected account."
                : "Account unverified: moved needs a completed tool turn since the restart AND Codex's status naming the expected account (--expect-account).",
        };
    }
    // -- observation (shared by plan and execute) --
    async observe(target, seenStartedSeq) {
        const { binding, sessionName, seat } = target;
        const history = this.restartHistory(seat.nodeId, seenStartedSeq);
        if ("code" in history)
            return history;
        const pane = binding.tmuxPane;
        let panes;
        try {
            panes = await this.deps.tmux.listPanes(sessionName);
        }
        catch (error) {
            return { ok: false, code: "tmux_probe_failed", message: `tmux pane lookup failed: ${error.message}; nothing was stopped.` };
        }
        if (!pane || panes.length !== 1 || panes[0]?.id !== pane) {
            return { ok: false, code: "pane_unverified", message: `Session "${sessionName}" must have exactly the seat's bound pane ${pane ?? "(none)"}; observed ${panes.map((p) => p.id).join(", ") || "no panes"}. Nothing was stopped.` };
        }
        const token = readResumeToken(this.deps.db, target.sessionId);
        if (!token) {
            return { ok: false, code: "resume_binding_unverified", message: "The seat's session has no stored Codex conversation id, so there is nothing to resume in place.",
                guidance: "Record the conversation with: rig seat set-resume-token" };
        }
        const codex = await this.observeCodex(pane, token);
        if (!codex) {
            return { ok: false, code: "resume_binding_unverified", message: "No single Codex process in the seat's pane could be tied to the stored conversation (a running Codex that names another conversation is refused too). Nothing was stopped." };
        }
        const { process, panePid, rows } = codex;
        const startedAt = process.startedAt ?? null;
        const facts = await this.io.readProcess(process.pid);
        if (!facts)
            return { ok: false, code: "settings_unverified", message: "The running Codex's working directory and Codex home could not be read (this observer reads /proc on Linux). Nothing was stopped." };
        const codexHome = facts.env.CODEX_HOME ?? (facts.env.HOME ? nodePath.join(facts.env.HOME, ".codex") : null);
        if (!codexHome)
            return { ok: false, code: "settings_unverified", message: "The running Codex's home could not be determined (no CODEX_HOME or HOME). Nothing was stopped." };
        // The conversation the PROCESS is on: argv for a resumed Codex, its own native logs for a fresh one.
        const argvToken = codexCommandResumeToken(process.command);
        let conversationProof;
        if (argvToken === token)
            conversationProof = "argv";
        else if (argvToken === undefined && startedAt && (await this.io.readThreadId(process.pid, startedAt, codexHome)) === token)
            conversationProof = "native_logs";
        else
            return { ok: false, code: "resume_binding_unverified", message: "The running Codex could not be proven to be on the seat's stored conversation (checked: its argv, then its native logs). Nothing was stopped." };
        // Pane shape: the pane's root is Codex itself, or a shell whose child chain is Codex.
        const chain = codexChain(rows, process, panePid);
        const top = chain.at(-1);
        const root = rows.find((row) => row.pid === panePid);
        let paneShape;
        // OpenRig types a Codex launch (and this restart's relaunch) as `/bin/sh <staged script>`, so a managed
        // Codex runs one sh below the pane's shell. Only that script is accepted between them.
        const between = rows.find((row) => row.pid === top.ppid);
        const viaLaunchScript = !!between && between.ppid === panePid && isStagedLaunchScript(between);
        if (top.pid === panePid)
            paneShape = "direct_native";
        else if (root && (top.ppid === panePid || viaLaunchScript) && isShellForeground(executableBase(root)))
            paneShape = "shell_backed";
        else
            return { ok: false, code: "pane_shape_unknown", message: "The pane is neither a shell running Codex (directly or through OpenRig's own launch script) nor Codex itself; nothing was stopped." };
        // Where the relaunched Codex would run, and with which home.
        let cwd;
        let shellFacts = null;
        if (paneShape === "shell_backed") {
            shellFacts = await this.io.readProcess(panePid);
            if (!shellFacts?.cwd)
                return { ok: false, code: "settings_unverified", message: "The pane shell's working directory could not be read. Nothing was stopped." };
            cwd = shellFacts.cwd;
        }
        else {
            if (!facts.cwd)
                return { ok: false, code: "settings_unverified", message: "The running Codex's working directory could not be read. Nothing was stopped." };
            cwd = facts.cwd;
        }
        const relaunchBinding = { ...binding, cwd };
        // The probed and prepared launch choices come from the running Codex, so the relaunch keeps them and no
        // Codex process is started to decide them again.
        const runningArgv = processArgv(process.command);
        const relaunch = await this.deps.codex.buildResumeCommand(relaunchBinding, { name: sessionName, resumeToken: token, running: runningLaunch(runningArgv) });
        if (!relaunch.ok)
            return { ok: false, code: "relaunch_unavailable", message: `The resume command could not be built: ${relaunch.error}. Nothing was stopped.` };
        const relaunchHome = envAssignment(relaunch.command, "CODEX_HOME")
            ?? (paneShape === "shell_backed"
                ? shellFacts.env.CODEX_HOME ?? (shellFacts.env.HOME ? nodePath.join(shellFacts.env.HOME, ".codex") : null)
                : (await this.deps.tmux.getSessionEnv(sessionName, "CODEX_HOME")) ?? null);
        const effective = parseEffectiveSettings(runningArgv);
        const relaunched = parseEffectiveSettings(shellWords(relaunch.core));
        // The relaunch sends the seat's resolved effort. Only an explicit saved seat choice may change effort
        // in place; with none (never set, or cleared) an effort difference is drift, as for any setting.
        const runningEffort = emittedEffortFromArgv("codex", runningArgv);
        const relaunchEffort = emittedEffortFromArgv("codex", shellWords(relaunch.core));
        const effort = {
            running: runningEffort.flag === "present" ? runningEffort.value : null,
            relaunch: relaunchEffort.flag === "present" ? relaunchEffort.value : null,
            changes: false,
            source: target.saved.effortSource ?? (target.saved.effort ? "authored" : "runtime_default"),
        };
        effort.changes = effort.running !== effort.relaunch;
        const applyChoice = effort.changes && effort.source === "seat_choice";
        const drift = [
            ...settingsDrift(effective, relaunched).filter((key) => key !== "effort" || !applyChoice),
            ...(facts.cwd && facts.cwd !== cwd ? ["cwd"] : []),
            ...(relaunchHome !== codexHome ? ["codex home"] : []),
        ];
        if (drift.length > 0) {
            return { ok: false, code: "settings_drift", detail: { differs: drift },
                message: `Relaunching now would change ${drift.join(", ")} from what the running Codex uses, so this account-only restart refuses. Nothing was stopped.`,
                guidance: drift.includes("effort")
                    ? "This seat has no saved effort choice (never set, or cleared), so an account-only restart keeps the running effort and won't change it. Save one with rig seat set-effort to apply it here; otherwise the next ordinary managed launch or resume resolves effort. Run rig seat restart --plan to compare."
                    : "A saved model/profile choice applies at a managed launch that is meant to change settings, not here. Run rig seat restart --plan to compare." };
        }
        let priorRemainOnExit = null;
        if (paneShape === "direct_native") {
            const prior = await this.deps.tmux.getPaneLocalOption(pane, "remain-on-exit");
            if (prior === undefined)
                return { ok: false, code: "tmux_probe_failed", message: "The pane's remain-on-exit setting could not be read, so it could not be put back; nothing was stopped." };
            priorRemainOnExit = prior;
        }
        const report = {
            ok: true, planOnly: seenStartedSeq === null, message: "", seat, sessionName, pane, paneShape,
            conversationId: token, conversationProof,
            activity: this.activity(seat.nodeId),
            childProcesses: descendants(rows, process.pid, chain).map((row) => ({ pid: row.pid, name: executableBase(row) })),
            settings: { effective, saved: target.saved, effort,
                note: applyChoice
                    ? `The restart keeps the settings the running Codex uses (effective), except effort: it sends the seat's saved effort choice ${effort.relaunch} in place of ${effort.running ?? "no flag"}. Other saved choices are shown, not applied.`
                    : "The restart keeps the settings the running Codex uses (effective), effort included. Saved choices for the next managed launch are shown, not applied." },
            codexHome,
            billingRoute: { state: "unknown", apiKeyEnvNames: facts.apiKeyEnvNames,
                detail: "Which billing route Codex uses is not observable without reading credentials; API-key variable names alone don't establish it." },
            account: this.accountEvidence(codexHome, startedAt, null),
            peers: await this.peers(seat.nodeId, codexHome),
            oldProcess: { pid: process.pid, startedAt },
            ...history,
            warnings: [],
        };
        return { ok: true, report, codexPid: top.pid, codexStartedAt: top.startedAt ?? null, panePid, relaunch, priorRemainOnExit, cwd, oldExe: facts.exe };
    }
    /** Refuses while a restart of this seat is in flight under THIS daemon, or ran while the request waited.
     *  A started restart from before this daemon started can't still be running: it is reported, not refused. */
    restartHistory(nodeId, seenStartedSeq) {
        const rows = this.deps.db.prepare("SELECT seq, type, payload, created_at FROM events WHERE node_id = ? AND type IN (?, ?) ORDER BY seq DESC LIMIT 2")
            .all(nodeId, RESTART_STARTED, RESTART_FINISHED);
        const latest = rows[0];
        const lastFinished = rows.find((row) => row.type === RESTART_FINISHED);
        const lastRestart = lastFinished ? (() => {
            const payload = JSON.parse(lastFinished.payload);
            return { lastRestart: { outcome: payload.outcome, finishedAt: payload.finishedAt } };
        })() : {};
        if (seenStartedSeq !== null && this.latestStartedSeq(nodeId) > seenStartedSeq) {
            return { ok: false, code: "restart_in_progress", message: "Another in-place restart of this seat ran while this request waited; not restarting again. Inspect its result first (--plan shows it as lastRestart)." };
        }
        if (latest?.type !== RESTART_STARTED)
            return lastRestart;
        const startedAt = new Date(`${latest.created_at.replace(" ", "T")}Z`);
        const started = JSON.parse(latest.payload);
        if (!(startedAt.getTime() < this.daemonStartedAt.getTime())) {
            return { ok: false, code: "restart_in_progress", message: `An in-place restart of this seat started at ${startedAt.toISOString()} under this daemon and has not recorded a result yet; it is still running. --plan shows its result once it finishes.` };
        }
        return { ...lastRestart, staleRestart: {
                startedAt: startedAt.toISOString(), oldPid: started.oldPid ?? null, pane: started.pane ?? null,
                detail: `Started before this daemon did (${this.daemonStartedAt.toISOString()}) and never recorded a result, so it is not running. The seat's state above is observed now.`,
            } };
    }
    async observeCodex(pane, token) {
        const rows = await this.listProcesses();
        const panePid = await this.deps.tmux.getPanePid(pane);
        if (!panePid)
            return null;
        const observation = await verifyCodexPaneProcess({ target: pane, tmux: { getPanePid: async () => panePid },
            listProcesses: () => rows, ...(token ? { expectedToken: token } : {}) });
        return observation && observation.panePid === panePid ? { process: observation.process, panePid, rows } : null;
    }
    /** Shell-backed: TERM the Codex chain's top process (not the pane's shell), KILL after the timeout, then
     *  require the original process gone AND the shell back in the foreground. */
    async stopUnderShell(pane, panePid, pid, startedAt) {
        const gone = async () => {
            const rows = await this.listProcesses();
            if (rows.length === 0)
                return null;
            if (rows.some((row) => row.pid === pid && (row.startedAt ?? null) === startedAt))
                return false;
            const command = await this.deps.tmux.getPaneCommand(pane);
            const root = rows.find((row) => row.pid === panePid);
            return command !== null && isShellForeground(command) && !!root;
        };
        const wait = async () => {
            const polls = Math.max(1, Math.ceil(this.timing.timeoutMs / this.timing.pollMs));
            let last = null;
            for (let i = 0; i <= polls; i++) {
                last = await gone();
                if (last)
                    return true;
                if (i < polls)
                    await this.timing.sleep(this.timing.pollMs);
            }
            return last;
        };
        await this.deps.tmux.signalPid(pid, "TERM");
        if (await wait())
            return "stopped";
        await this.deps.tmux.signalPid(pid, "KILL");
        const last = await wait();
        return last ? "stopped" : last === null ? "unknown" : "running";
    }
    async verifyReplacement(target, report, oldExe) {
        // Screen readiness can precede native-process visibility. Repeat only the joined
        // observations, never the launch. The budget counts yields, not observation I/O.
        const polls = Math.max(1, Math.ceil(this.timing.timeoutMs / this.timing.pollMs));
        for (let attempt = 0;; attempt++) {
            const identity = await rebindAndVerifyPaneIdentity({
                db: this.deps.db, sessionRegistry: this.deps.sessionRegistry, tmux: this.deps.tmux,
                nodeId: target.seat.nodeId, sessionName: target.sessionName, runtime: "codex",
                expectedResumeToken: report.conversationId, requireExactResumeLineage: true, listProcesses: this.listProcesses,
                // The check repeats up to 31 times; only the final attempt, whose text the report shows, pays the extra read.
                explainFailure: attempt >= polls,
            });
            const now = await this.observeCodex(report.pane, report.conversationId);
            if (!identity.ok || !now) {
                if (attempt < polls) {
                    await this.timing.sleep(this.timing.pollMs);
                    continue;
                }
                return { ...report, outcome: "native_unknown", couldNotSee: [`the replacement Codex's identity: ${identity.ok ? "process not observed" : identity.detail}`],
                    message: "Codex reported a resumed conversation, but the process in the pane could not be proven to be that conversation." };
            }
            const after = await this.io.readProcess(now.process.pid);
            const before = report.oldProcess;
            const startedAt = now.process.startedAt ?? null;
            return {
                ...report, outcome: "restarted_account_unverified",
                newProcess: { pid: now.process.pid, startedAt, sameExecutable: after?.exe && oldExe ? after.exe === oldExe : null },
                account: this.accountEvidence(report.codexHome, before.startedAt, startedAt),
                message: "Restarted in place on the same conversation and pane. The account is not verified: run --verify after a real tool-using turn.",
            };
        }
    }
    /** A direct-native stop or respawn that failed: report what the pane and the original process are now,
     *  as observed, never an assumed state. A pane that is gone holds nothing. */
    async afterFailedStop(target, report, observed, held, recoveryCommand, failure, progress) {
        const seen = await this.observeAfterStop(target.sessionName, report.pane, observed.codexPid, observed.codexStartedAt);
        const observedAfterStop = { ...seen, detail: `pane ${seen.pane}, original Codex ${seen.process}` };
        const paneHeld = seen.pane === "gone" ? undefined : held;
        progress.paneHeld = paneHeld;
        const base = { ...report, recoveryCommand, observedAfterStop, ...(paneHeld ? { paneHeld } : {}) };
        if (seen.process === "running" && seen.pane === "present") {
            return { ...base, outcome: "not_started", message: `The original Codex is still running (observed): ${failure}` };
        }
        if (seen.process === "exited" && seen.pane === "gone") {
            return { ...base, outcome: "incomplete",
                remainingStep: "The seat's pane is gone and nothing replaced it. Resume the conversation in a new pane for this seat with the recovery command.",
                message: `The original Codex exited and its pane is gone (observed); nothing was resumed: ${failure}` };
        }
        if (seen.process === "exited") {
            return { ...base, outcome: "incomplete", remainingStep: "Resolve the pane, then resume with the recovery command. Nothing was retried.",
                message: `The original Codex exited (observed), but the resume was not started: ${failure}` };
        }
        return { ...base, outcome: "native_unknown", couldNotSee: [`the seat's state after the stop (${observedAfterStop.detail})`],
            message: `The stop did not complete as expected and the seat's state is not fully known: ${failure}` };
    }
    async observeAfterStop(sessionName, pane, pid, startedAt) {
        let paneState;
        try {
            paneState = (await this.deps.tmux.listPanes(sessionName)).some((candidate) => candidate.id === pane) ? "present" : "gone";
        }
        catch (error) {
            paneState = /can't find|not found|no such/i.test(error.message) ? "gone" : "unknown";
        }
        const rows = await (async () => this.listProcesses())().catch(() => []);
        const processState = rows.length === 0 ? "unknown"
            : rows.some((row) => row.pid === pid && (row.startedAt ?? null) === startedAt) ? "running" : "exited";
        return { pane: paneState, process: processState };
    }
    incomplete(report, launch, recoveryCommand, paneHeld) {
        const signIn = /sign in/i.test(launch.error);
        const missing = launch.recovery === "retry_fresh";
        return {
            ...report, outcome: "incomplete", recoveryCommand, ...(paneHeld ? { paneHeld } : {}),
            account: { ...report.account, startupGate: launch.recovery === "attention_required" ? launch.error : null },
            remainingStep: signIn
                ? `Whoever owns the sign-in signs in to Codex in ${report.codexHome}, then the conversation resumes with the recovery command.`
                : missing
                    ? `Codex in ${report.codexHome} has no saved session for this conversation; no fresh session was started. Find where it was saved before resuming.`
                    : "Resolve what Codex shows in the pane, then resume with the recovery command. Nothing was retried.",
            message: `The original Codex exited, but the resume was not proven: ${launch.error}`,
        };
    }
    activity(nodeId) {
        const state = this.deps.activity?.getSeatState(nodeId) ?? null;
        if (!state)
            return { state: "unknown", needsInput: null, detail: "No activity evidence for this seat." };
        const decided = state.decidedBy ? ` (decided by ${state.decidedBy})` : "";
        if (state.needsInput.count > 0)
            return { state: "needs_input", needsInput: state.needsInput.count, detail: `${state.needsInput.reason ?? "Waiting for input"}${decided}.` };
        if (state.activity === "working")
            return { state: "working", needsInput: state.needsInput.count, detail: `Mid-turn${decided}: restarting interrupts the turn.` };
        if (state.activity === "idle-at-prompt")
            return { state: "idle", needsInput: state.needsInput.count, detail: `Idle at the prompt${decided}.` };
        return { state: "unknown", needsInput: state.needsInput.count, detail: `Activity is "${state.activity}"${decided}.` };
    }
    accountEvidence(codexHome, oldStartedAt, newStartedAt) {
        const store = this.io.readCredentialStore(codexHome);
        const auth = this.io.statAuthFile(codexHome);
        const oldStart = oldStartedAt ? Date.parse(oldStartedAt) : NaN;
        const newStart = newStartedAt ? Date.parse(newStartedAt) : NaN;
        return {
            verdict: "unverified",
            credentialStore: store === undefined
                ? { value: null, state: "unreadable", detail: "config.toml could not be read; the credential backend in effect is unknown." }
                : store === null
                    ? { value: null, state: "unset", detail: "config.toml sets no cli_auth_credentials_store; Codex's default applies. Administrator requirements were not read." }
                    : { value: store, state: "read", detail: store === "file" ? "File-backed: a switched auth.json is what Codex reads." : `Backend "${store}": a copied auth.json may not change the account in use.` },
            authFile: !auth
                ? { changedBeforeRestart: null, detail: "No auth.json to stat in this home." }
                : Number.isNaN(newStart)
                    ? { changedBeforeRestart: Number.isNaN(oldStart) ? null : auth.mtimeMs > oldStart,
                        detail: "Whether auth.json changed after the running Codex started (stat only; never read). A change is not proof of which account." }
                    : { changedBeforeRestart: auth.mtimeMs < newStart, detail: "auth.json was last modified before the replacement started (stat only; never read)." },
            startupGate: null,
            notVerified: NOT_VERIFIED,
        };
    }
    async peers(nodeId, codexHome) {
        const rows = this.deps.db.prepare(`
      SELECT n.id, n.logical_id, b.tmux_session, b.tmux_pane FROM nodes n
      LEFT JOIN bindings b ON b.node_id = n.id
      WHERE n.runtime = 'codex' AND n.id != ? ORDER BY n.logical_id`).all(nodeId);
        const reports = [];
        for (const row of rows) {
            let home = "unknown";
            if (row.tmux_pane && row.tmux_session) {
                const observed = await this.observeCodex(row.tmux_pane, null).catch(() => null);
                const facts = observed ? await this.io.readProcess(observed.process.pid) : null;
                const peerHome = facts?.env.CODEX_HOME ?? (facts?.env.HOME ? nodePath.join(facts.env.HOME, ".codex") : null);
                if (peerHome)
                    home = peerHome === codexHome ? "same" : "different";
            }
            reports.push({ logicalId: row.logical_id, sessionName: row.tmux_session, home,
                effect: home === "same"
                    ? `Not restarted; account unverified. Shares home ${codexHome}, so it may take the new account at its next start or token refresh.`
                    : home === "different" ? "Not restarted; uses a different Codex home." : "Not restarted; account unverified; its Codex home could not be observed." });
        }
        return reports;
    }
    readToolTurn(codexHome, conversationId, since) {
        const unreadable = { completed: 0, errors: 0, since, state: "unreadable" };
        if (!conversationId)
            return unreadable;
        const path = this.io.findRollout(codexHome, conversationId);
        const text = path ? this.io.readRolloutTail(path) : null;
        if (text === null)
            return unreadable;
        const sinceMs = Date.parse(since);
        let completed = 0;
        let errors = 0;
        for (const line of text.split("\n")) {
            if (!line.trim())
                continue;
            let entry;
            try {
                entry = JSON.parse(line);
            }
            catch {
                continue;
            }
            if (!entry.timestamp || !(Date.parse(entry.timestamp) > sinceMs))
                continue;
            // Only the event kind and time are read; message and tool content are not.
            if (entry.type === "response_item" && /_call_output$/.test(entry.payload?.type ?? ""))
                completed += 1;
            if (entry.type === "event_msg" && entry.payload?.type === "error")
                errors += 1;
        }
        return { completed, errors, since, state: completed > 0 ? "observed" : "not_observed" };
    }
    /**
     * Account evidence counts only when the line was produced after the restart. A cursor position can't show
     * that (a TUI rewrites rows above and below the cursor), so this compares occurrences: every Account line
     * in the pane's whole text when the restart finished was counted, and a line is new only when the same
     * text now occurs more often than it did then. Text that moved, stayed or was redrawn never counts more
     * than once; anything that can't be compared is not observed.
     */
    async readAccountLine(pane, atRestart, expectAccount) {
        if (!expectAccount?.trim())
            return { state: "not_requested", detail: "No --expect-account given, so no account-specific evidence was checked." };
        if (atRestart === null)
            return { state: "not_observed", detail: "The pane's text at the restart was not recorded, so a line produced since can't be told apart from earlier text." };
        const text = await this.deps.tmux.capturePaneHistory(pane).catch(() => null);
        if (text === null)
            return { state: "not_observed", detail: "The pane's text could not be read." };
        const seen = new Map();
        let newest;
        for (const line of accountLines(text)) {
            const key = accountLineKey(line);
            const count = (seen.get(key) ?? 0) + 1;
            seen.set(key, count);
            if (count > (atRestart[key] ?? 0))
                newest = line;
        }
        if (!newest)
            return { state: "not_observed", detail: "No Codex status Account line was produced since the restart (lines already in the pane then don't count); show /status in the seat first." };
        return accountLineNames(newest, expectAccount)
            ? { state: "matched", detail: "An Account line produced since the restart names the expected account." }
            : { state: "not_matched", detail: "The newest Account line produced since the restart does not name the expected account (it may show only a plan)." };
    }
    persist(event) {
        let persisted = null;
        this.deps.db.transaction(() => {
            persisted = this.deps.eventBus.persistWithinTransaction(event);
        })();
        if (persisted)
            this.deps.eventBus.notifySubscribers(persisted);
    }
}
// -- helpers --
function readResumeToken(db, sessionId) {
    const row = db.prepare("SELECT resume_token, resume_type FROM sessions WHERE id = ?").get(sessionId);
    const token = row?.resume_token?.trim();
    return token && (row?.resume_type == null || row.resume_type === "codex_id") ? token : null;
}
function executableBase(row) {
    const name = row.executableName ?? processArgv(row.command)[0] ?? "";
    return (name.split("/").pop() ?? name).replace(/^-/, "");
}
/** The shells `/bin/sh` can run as. macOS's /bin/sh is a shim that runs bash (or dash or zsh, if so
 *  configured), so the OS names the staged script's process after that shell, not sh. */
const SH_RUNS_AS = new Set(["sh", "bash", "dash", "zsh"]);
/** `/bin/sh <path>` running a launch script that OpenRig's tmux adapter staged, and nothing else. */
function isStagedLaunchScript(row) {
    const argv = processArgv(row.command);
    return SH_RUNS_AS.has(executableBase(row)) && argv.length === 2 && /^(?:\/bin\/)?sh$/.test(argv[0]) && isStagedSendScriptPath(argv[1]);
}
/** The Codex process and its Codex launcher ancestors, deepest first, up to the pane root. */
function codexChain(rows, deepest, panePid) {
    const byPid = new Map(rows.map((row) => [row.pid, row]));
    const chain = [deepest];
    let current = deepest;
    while (current.pid !== panePid) {
        const parent = byPid.get(current.ppid);
        if (!parent)
            break;
        const name = executableBase(parent);
        // A Codex launcher above the native binary: codex itself, or node running Codex's launcher script.
        const launcher = /^codex/i.test(name) || (name === "node" && processArgv(parent.command).some((arg) => /codex/i.test(arg)));
        if (!launcher)
            break;
        chain.push(parent);
        current = parent;
    }
    return chain;
}
/** Processes under the Codex process, other than Codex itself. Reported, never refused. */
function descendants(rows, codexPid, chain) {
    const own = new Set(chain.map((row) => row.pid));
    const byParent = new Map();
    for (const row of rows) {
        const siblings = byParent.get(row.ppid);
        if (siblings)
            siblings.push(row);
        else
            byParent.set(row.ppid, [row]);
    }
    const found = [];
    const queue = [...(byParent.get(codexPid) ?? [])];
    const seen = new Set();
    while (queue.length > 0) {
        const row = queue.shift();
        if (seen.has(row.pid))
            continue;
        seen.add(row.pid);
        if (!own.has(row.pid))
            found.push(row);
        queue.push(...(byParent.get(row.pid) ?? []));
    }
    return found;
}
const VALUE_OPTIONS = {
    "-m": "model", "--model": "model", "-p": "profile", "--profile": "profile", "-s": "sandbox", "--sandbox": "sandbox",
    "-a": "approval", "--ask-for-approval": "approval", "-c": "config", "--config": "config",
    "-C": null, "--cd": null, "--add-dir": null, "-i": null, "--image": null,
};
/** The launch choices a running Codex's argv records, reused so the relaunch keeps them without probing. */
function runningLaunch(argv) {
    const addDirs = [];
    const configs = [];
    for (let index = 1; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--add-dir" && argv[index + 1] !== undefined)
            addDirs.push(argv[++index]);
        else if ((arg === "-c" || arg === "--config") && argv[index + 1] !== undefined)
            configs.push(argv[++index]);
        else if (arg.startsWith("--config="))
            configs.push(arg.slice("--config=".length));
    }
    return { networkOverride: configs.includes(CODEX_NETWORK_DEFAULT_OVERRIDE), daemonOptOut: argv.includes("--no-daemon"), addDirs };
}
/** The settings a Codex command line runs with. cwd, add-dirs, images and the resume target are not settings. */
export function parseEffectiveSettings(argv) {
    const settings = { model: null, profile: null, sandbox: null, approval: null, bypass: false, config: [] };
    for (let index = 1; index < argv.length; index += 1) {
        let arg = argv[index];
        let value;
        const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
        if (eq > 0) {
            value = arg.slice(eq + 1);
            arg = arg.slice(0, eq);
        }
        if (arg === "--dangerously-bypass-approvals-and-sandbox" || arg === "--yolo") {
            settings.bypass = true;
            continue;
        }
        if (arg === "--full-auto") {
            settings.sandbox ??= "workspace-write";
            settings.approval ??= "on-request";
            continue;
        }
        const key = Object.hasOwn(VALUE_OPTIONS, arg) ? VALUE_OPTIONS[arg] : undefined;
        if (key === undefined)
            continue;
        if (value === undefined) {
            value = argv[index + 1];
            index += 1;
        }
        if (key === null || value === undefined)
            continue;
        if (key === "config")
            settings.config.push(value);
        else
            settings[key] = value;
    }
    settings.config.sort();
    return settings;
}
/** Which settings differ. Config overrides are named by key only; their values may be paths. */
function settingsDrift(running, relaunch) {
    const differs = [];
    for (const key of ["model", "profile", "sandbox", "approval"])
        if (running[key] !== relaunch[key])
            differs.push(key);
    if (running.bypass !== relaunch.bypass)
        differs.push("approval/sandbox bypass");
    const configKey = (entry) => entry.split("=")[0];
    const a = new Set(running.config);
    const b = new Set(relaunch.config);
    const keys = new Set([...running.config.filter((entry) => !b.has(entry)), ...relaunch.config.filter((entry) => !a.has(entry))].map(configKey));
    for (const key of [...keys].sort())
        differs.push(key === "model_reasoning_effort" ? "effort" : `config ${key}`);
    return differs;
}
/** Split a POSIX command line built with shellQuote (single quotes, double quotes, backslashes). */
export function shellWords(command) {
    const words = [];
    let current = "";
    let has = false;
    for (let i = 0; i < command.length; i += 1) {
        const char = command[i];
        if (char === "'") {
            const end = command.indexOf("'", i + 1);
            current += command.slice(i + 1, end < 0 ? command.length : end);
            i = end < 0 ? command.length : end;
            has = true;
        }
        else if (char === '"') {
            i += 1;
            while (i < command.length && command[i] !== '"') {
                if (command[i] === "\\" && i + 1 < command.length)
                    i += 1;
                current += command[i];
                i += 1;
            }
            has = true;
        }
        else if (char === "\\" && i + 1 < command.length) {
            current += command[i + 1];
            i += 1;
            has = true;
        }
        else if (/\s/.test(char)) {
            if (has)
                words.push(current);
            current = "";
            has = false;
        }
        else {
            current += char;
            has = true;
        }
    }
    if (has)
        words.push(current);
    return words;
}
/** A NAME=value assignment in a launch wrapper (`env NAME=…` or `/usr/bin/env 'NAME=…'`), before the command. */
function envAssignment(command, name) {
    for (const word of shellWords(command)) {
        if (word.startsWith(`${name}=`))
            return word.slice(name.length + 1);
        if (/^codex$|\/codex$/.test(word))
            break;
    }
    return null;
}
/** The pane's status `Account:` lines, trimmed of frame borders, in order. */
function accountLines(text) {
    return text.split("\n").map((line) => line.replace(/^[\s│|]+|[\s│|]+$/g, "")).filter((line) => /^Account:\s*\S/i.test(line));
}
/** A line's key in the recorded counts: a digest, so the event log holds no account names. */
function accountLineKey(line) {
    return createHash("sha256").update(line).digest("hex").slice(0, 16);
}
/** How often each Account line occurs in the pane's text; null when the text couldn't be read. */
function accountLineCounts(text) {
    if (text === null)
        return null;
    const counts = {};
    for (const line of accountLines(text))
        counts[accountLineKey(line)] = (counts[accountLineKey(line)] ?? 0) + 1;
    return counts;
}
/** Whether a status `Account:` line names `expected` as a whole value: `bob@corp.com` doesn't match
 *  `jimbob@corp.com` or `bob@corp.com.au`. Case-insensitive, as account names are. */
export function accountLineNames(line, expected) {
    const want = expected.trim();
    if (!want)
        return false;
    const escaped = want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z0-9._%+@-])${escaped}($|[^A-Za-z0-9._%+@-])`, "i").test(line.replace(/^Account:\s*/i, " "));
}
export function defaultInPlaceRestartIo() {
    return {
        async readProcess(pid) {
            try {
                const environ = fs.readFileSync(`/proc/${pid}/environ`);
                const env = {};
                const apiKeyEnvNames = [];
                for (const entry of environ.toString("utf8").split("\0")) {
                    const eq = entry.indexOf("=");
                    if (eq <= 0)
                        continue;
                    const key = entry.slice(0, eq);
                    if (key === "CODEX_HOME" || key === "HOME")
                        env[key] = entry.slice(eq + 1);
                    else if (API_KEY_NAMES.includes(key) && eq < entry.length - 1)
                        apiKeyEnvNames.push(key);
                }
                const read = (link) => { try {
                    return fs.readlinkSync(`/proc/${pid}/${link}`);
                }
                catch {
                    return null;
                } };
                return { cwd: read("cwd"), exe: read("exe"), env, apiKeyEnvNames: apiKeyEnvNames.sort() };
            }
            catch {
                return null;
            }
        },
        async readThreadId(pid, startedAt, codexHome) {
            return new CodexThreadIdResolver({ codexHome }).resolve(pid, startedAt);
        },
        readCredentialStore(codexHome) {
            let text;
            try {
                text = fs.readFileSync(nodePath.join(codexHome, "config.toml"), "utf8");
            }
            catch (error) {
                return error.code === "ENOENT" ? null : undefined;
            }
            for (const line of text.split("\n")) {
                if (/^\s*\[/.test(line))
                    break; // top-level keys only
                const match = line.match(/^\s*cli_auth_credentials_store\s*=\s*["']([^"']*)["']/);
                if (match)
                    return match[1];
            }
            return null;
        },
        statAuthFile(codexHome) {
            try {
                return { mtimeMs: fs.statSync(nodePath.join(codexHome, "auth.json")).mtimeMs };
            }
            catch {
                return null;
            }
        },
        findRollout(codexHome, conversationId) {
            for (const dbPath of resolveCodexDbPaths("", "state", undefined, codexHome)) {
                try {
                    const db = new Database(dbPath, { readonly: true });
                    try {
                        const row = db.prepare("SELECT rollout_path FROM threads WHERE id = ?").get(conversationId);
                        if (row?.rollout_path)
                            return row.rollout_path;
                    }
                    finally {
                        db.close();
                    }
                }
                catch { /* no native state in this file */ }
            }
            return null;
        },
        readRolloutTail(path) {
            const maxBytes = 4 * 1024 * 1024;
            try {
                const fd = fs.openSync(path, "r");
                try {
                    const size = fs.fstatSync(fd).size;
                    const start = Math.max(0, size - maxBytes);
                    const buffer = Buffer.alloc(size - start);
                    fs.readSync(fd, buffer, 0, buffer.length, start);
                    const text = buffer.toString("utf8");
                    return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
                }
                finally {
                    fs.closeSync(fd);
                }
            }
            catch {
                return null;
            }
        },
    };
}
//# sourceMappingURL=seat-restart-in-place.js.map