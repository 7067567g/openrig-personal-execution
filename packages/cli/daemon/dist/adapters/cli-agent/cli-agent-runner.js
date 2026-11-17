#!/usr/bin/env node
// Pane-hosted OpenCode/DSH CLI runner.
//
// Stdin is the OpenRig transport channel: one task per line. The runner stays
// alive after a failed turn so OpenRig can retry without relaunching the seat.
// Runtime-native session ids are persisted in the sidecar and reused.
//
// Per-turn budgets are OPT-IN. The adapter adds `--budget-*` args only when
// `budget.enabled` is true; without them this file behaves exactly as before
// (one child per task, no wall/tool/token accounting, no retry). A breach kills
// the current child, prints a BUDGET_EXHAUSTED marker and writes the reason to
// the sidecar — it never retries a budget breach.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createCliAgentInput } from "./cli-agent-input.js";
import { applyDshEvent, cleanDshError, createDshTurnState, dshTurnOutcome, } from "./dsh-event-protocol.js";
import { CLI_AGENT_BUDGET_MARKER, CLI_AGENT_ERROR_MARKER, CLI_AGENT_EXITED_MARKER, CLI_AGENT_READY_MARKER, CLI_AGENT_RETRY_MARKER, buildCliAgentInvocation, cliAgentSeatPaths, cliAgentUsagePath, parseCliAgentRunnerState, } from "./cli-agent-runner-protocol.js";
import { cliAgentUsageSnapshot, createCliAgentUsageState, observeCliAgentUsageEvent, parseCliAgentUsageSidecar, setCliAgentUsageSession, } from "./cli-agent-usage.js";
import { canRetryTask, checkTaskBudget, createTaskBudgetState, formatTaskBudgetBreach, normalizeTaskBudgetConfig, observeTaskBudgetEvent, recordTaskRetry, taskBudgetCoverage, } from "./task-budget.js";
function nonNegativeInt(raw, name) {
    if (raw === undefined)
        return 0;
    if (!/^\d+$/.test(raw.trim()))
        throw new Error(`${name} must be a non-negative integer`);
    return Number.parseInt(raw, 10);
}
function parseArgs(argv) {
    const values = new Map();
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i];
        if (!key)
            throw new Error("missing argument");
        if (!key.startsWith("--"))
            throw new Error(`unexpected argument ${key}`);
        const value = argv[i + 1];
        if (value === undefined)
            throw new Error(`missing value for ${key}`);
        values.set(key.slice(2), value);
        i += 1;
    }
    const runtime = values.get("runtime");
    if (runtime !== "opencode" && runtime !== "dsh")
        throw new Error("--runtime must be opencode or dsh");
    const sessionName = values.get("session-name");
    const stateRoot = values.get("state-root");
    const launchId = values.get("launch-id");
    const cwd = values.get("cwd");
    if (!sessionName || !stateRoot || !launchId || !cwd) {
        throw new Error("--session-name, --state-root, --launch-id and --cwd are required");
    }
    const envBin = runtime === "opencode"
        ? process.env.OPENRIG_OPENCODE_BIN ?? process.env.OPENCODE_BIN
        : process.env.OPENRIG_DSH_BIN ?? process.env.DSH_BIN;
    const budgetEnabled = ["budget-max-wall-time-ms", "budget-max-steps", "budget-max-tool-calls", "budget-max-tokens", "budget-max-retries"]
        .some((key) => values.has(key));
    const budget = budgetEnabled
        ? normalizeTaskBudgetConfig({
            enabled: true,
            maxWallTimeMs: nonNegativeInt(values.get("budget-max-wall-time-ms"), "--budget-max-wall-time-ms"),
            maxSteps: nonNegativeInt(values.get("budget-max-steps"), "--budget-max-steps"),
            maxToolCalls: nonNegativeInt(values.get("budget-max-tool-calls"), "--budget-max-tool-calls"),
            maxTokens: nonNegativeInt(values.get("budget-max-tokens"), "--budget-max-tokens"),
            maxRetries: nonNegativeInt(values.get("budget-max-retries"), "--budget-max-retries"),
        })
        : undefined;
    return {
        runtime,
        sessionName,
        stateRoot,
        launchId,
        cwd,
        bin: values.get("bin") ?? envBin ?? (runtime === "opencode" ? "opencode" : "dsh"),
        model: values.get("model") ?? (runtime === "opencode" ? process.env.OPENRIG_OPENCODE_MODEL : undefined),
        agent: values.get("agent") ?? (runtime === "opencode" ? process.env.OPENRIG_OPENCODE_AGENT : undefined),
        resumeToken: values.get("resume-token"),
        profile: values.get("profile") ?? process.env.OPENRIG_DSH_PROFILE ?? "headless",
        budget,
    };
}
const opts = parseArgs(process.argv.slice(2));
const seat = cliAgentSeatPaths(opts.stateRoot, opts.sessionName);
const usagePath = cliAgentUsagePath(opts.stateRoot, opts.sessionName);
mkdirSync(seat.seatRoot, { recursive: true });
let sessionId = opts.resumeToken;
let currentChild = null;
let shuttingDown = false;
let queue = Promise.resolve();
function readUsageSidecar() {
    try {
        return parseCliAgentUsageSidecar(readFileSync(usagePath, "utf8"));
    }
    catch {
        return null;
    }
}
const usageState = createCliAgentUsageState(opts.runtime, opts.sessionName, sessionId, readUsageSidecar());
/** Atomic sidecar write; a failure is recorded on stderr and never fails a turn. */
function writeUsage() {
    try {
        const snapshot = cliAgentUsageSnapshot(usageState, now());
        const tmp = `${usagePath}.tmp`;
        writeFileSync(tmp, JSON.stringify(snapshot), "utf8");
        renameSync(tmp, usagePath);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[cli-agent-runner] usage sidecar write failed: ${message}\n`);
    }
}
function now() {
    return new Date().toISOString();
}
function readState() {
    try {
        return parseCliAgentRunnerState(readFileSync(seat.runnerStatePath, "utf8"));
    }
    catch {
        return null;
    }
}
function writeState(patch) {
    const prev = readState();
    const next = {
        ...prev,
        ...patch,
        ready: patch.ready ?? prev?.ready ?? true,
        launchId: opts.launchId,
        sessionId: patch.sessionId ?? sessionId ?? prev?.sessionId,
        updatedAt: now(),
    };
    if (next.sessionId)
        sessionId = next.sessionId;
    const tmp = `${seat.runnerStatePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(next), "utf8");
    renameSync(tmp, seat.runnerStatePath);
}
function emit(line) {
    process.stdout.write(`${line}\n`);
}
function budgetSummary(budget, breach) {
    return {
        enforced: true,
        ...(breach
            ? { exhausted: { dimension: breach.dimension, limit: breach.limit, observed: breach.observed, at: now() } }
            : {}),
        retries_used: budget.retries,
        coverage: taskBudgetCoverage(budget),
        observed: {
            steps: budget.steps,
            tool_calls: budget.toolCalls,
            tokens: budget.tokens,
            wall_time_ms: Math.max(0, Date.now() - budget.startedAtMs),
        },
    };
}
function handleEvent(line, state, budget) {
    if (!line.trim())
        return null;
    let event;
    try {
        event = JSON.parse(line);
    }
    catch {
        return null;
    }
    const topSessionId = event["sessionID"] ?? event["sessionId"];
    if (typeof topSessionId === "string" && topSessionId.length > 0) {
        sessionId = topSessionId;
        if (setCliAgentUsageSession(usageState, sessionId, now()))
            writeUsage();
        writeState({ sessionId });
    }
    // Token/cost folding is independent of pane markers and budgets: it only
    // persists when a usage event actually advanced the totals.
    if (observeCliAgentUsageEvent(usageState, event, now()))
        writeUsage();
    if (opts.runtime === "opencode") {
        const part = event["part"];
        if (event["type"] === "text" && part && typeof part === "object") {
            const text = part["text"];
            if (typeof text === "string" && text.length > 0) {
                state.text.push(text);
                emit(text);
            }
        }
        else if (event["type"] === "tool_use" && part && typeof part === "object") {
            const tool = part["tool"];
            if (typeof tool === "string")
                emit(`[tool] ${tool}`);
        }
        else if (event["type"] === "error") {
            const error = event["error"];
            if (error && typeof error === "object") {
                const data = error["data"];
                const message = data && typeof data === "object"
                    ? data["message"]
                    : undefined;
                state.error = cleanDshError(message ?? error);
            }
            else {
                state.error = cleanDshError(error);
            }
        }
    }
    else {
        const effect = applyDshEvent(event, state);
        if (effect.sessionId !== undefined) {
            sessionId = effect.sessionId;
            if (setCliAgentUsageSession(usageState, sessionId, now()))
                writeUsage();
            writeState({ sessionId });
        }
        if (effect.text !== undefined)
            emit(effect.text);
        if (effect.error !== undefined)
            state.error = effect.error;
    }
    return budget ? observeTaskBudgetEvent(budget, event) : null;
}
async function runAttempt(text, budget) {
    const state = createDshTurnState(sessionId);
    const invocation = buildCliAgentInvocation({
        runtime: opts.runtime,
        bin: opts.bin,
        text,
        sessionId,
        model: opts.model,
        agent: opts.agent,
        profile: opts.profile,
    });
    let breach = null;
    let timer = null;
    let killTimer = null;
    await new Promise((resolve) => {
        const child = spawn(invocation.command, invocation.args, {
            cwd: opts.cwd,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        currentChild = child;
        const recordBreach = (candidate) => {
            if (!candidate || breach)
                return;
            breach = candidate;
            const message = formatTaskBudgetBreach(candidate);
            state.error = message;
            emit(`${CLI_AGENT_BUDGET_MARKER} ${message}`);
            // Terminate the current turn; a budget breach is never retried. SIGKILL
            // is the bounded fallback for a child that ignores SIGTERM.
            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGTERM");
                killTimer = setTimeout(() => {
                    if (child.exitCode === null && child.signalCode === null)
                        child.kill("SIGKILL");
                }, 2000);
                killTimer.unref?.();
            }
        };
        // Wall clock spans the whole task, including retries. Recompute on every
        // attempt so a retry cannot reset the budget.
        if (budget && budget.config.maxWallTimeMs > 0) {
            const elapsed = Date.now() - budget.startedAtMs;
            const remaining = Math.max(0, budget.config.maxWallTimeMs - elapsed);
            timer = setTimeout(() => recordBreach(checkTaskBudget(budget, Date.now()) ?? {
                dimension: "wall_time",
                limit: budget.config.maxWallTimeMs,
                observed: Date.now() - budget.startedAtMs,
            }), remaining);
            timer.unref?.();
        }
        let stdoutBuf = "";
        let stderrBuf = "";
        const drain = (chunk, which) => {
            if (which === "stdout") {
                stdoutBuf += chunk;
                const lines = stdoutBuf.split("\n");
                stdoutBuf = lines.pop() ?? "";
                for (const line of lines)
                    recordBreach(handleEvent(line, state, budget));
            }
            else {
                stderrBuf += chunk;
                if (stderrBuf.length > 8000)
                    stderrBuf = stderrBuf.slice(-8000);
            }
        };
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => drain(chunk, "stdout"));
        child.stderr.on("data", (chunk) => drain(chunk, "stderr"));
        child.on("error", (error) => {
            state.error = cleanDshError(error.message);
        });
        child.on("close", (code) => {
            if (timer)
                clearTimeout(timer);
            if (killTimer)
                clearTimeout(killTimer);
            if (stdoutBuf.trim())
                recordBreach(handleEvent(stdoutBuf, state, budget));
            currentChild = null;
            if (!breach) {
                if (opts.runtime === "dsh") {
                    // Pure classification keeps the historical behavior: an event error wins,
                    // and exit 0 without `final` stays a success with empty text.
                    const outcome = dshTurnOutcome(state, code, stderrBuf);
                    if (!state.error && outcome.error !== undefined)
                        state.error = outcome.error;
                }
                else if (!state.error && code !== 0) {
                    state.error = cleanDshError(stderrBuf.trim() || `runtime exited with code ${code ?? "unknown"}`);
                }
            }
            resolve();
        });
    });
    return { state, breach };
}
async function runOne(text) {
    const budget = opts.budget ? createTaskBudgetState(opts.budget, Date.now()) : null;
    emit(`[task] ${opts.runtime}${sessionId ? ` session=${sessionId}` : ""}`);
    let final;
    for (;;) {
        final = await runAttempt(text, budget);
        if (final.breach)
            break;
        if (final.state.error && budget && canRetryTask(budget, Date.now())) {
            const attempt = recordTaskRetry(budget);
            emit(`${CLI_AGENT_RETRY_MARKER} ${attempt}/${budget.config.maxRetries}`);
            continue;
        }
        break;
    }
    const { state, breach } = final;
    const budgetPatch = budget ? { budget: budgetSummary(budget, breach) } : {};
    if (breach) {
        const message = formatTaskBudgetBreach(breach);
        emit(`${CLI_AGENT_ERROR_MARKER} ${message}`);
        writeState({ lastError: message, lastResultText: state.text.join(""), ...budgetPatch });
    }
    else if (state.error) {
        emit(`${CLI_AGENT_ERROR_MARKER} ${state.error}`);
        writeState({ lastError: state.error, lastResultText: state.text.join(""), ...budgetPatch });
    }
    else {
        writeState({ lastError: undefined, lastResultText: state.text.join(""), ...budgetPatch });
    }
}
function shutdown(exitCode = 0) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    const child = currentChild;
    if (child && !child.killed)
        child.kill("SIGTERM");
    const prev = readState();
    writeState({
        ready: false,
        exited: { code: exitCode, at: now() },
        lastError: prev?.lastError,
        lastResultText: prev?.lastResultText,
    });
    emit(`${CLI_AGENT_EXITED_MARKER} code=${exitCode}`);
    process.exit(exitCode);
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
writeState({ ready: true, lastError: undefined });
emit(`${CLI_AGENT_READY_MARKER} runtime=${opts.runtime} session=${opts.sessionName}`);
const rl = createCliAgentInput(process.stdin, process.stdout, (block) => {
    const text = block.trim();
    if (!text)
        return;
    queue = queue.then(() => runOne(text)).catch((error) => {
        const message = cleanDshError(error);
        emit(`${CLI_AGENT_ERROR_MARKER} ${message}`);
        writeState({ lastError: message });
    });
});
rl.on("close", () => {
    queue.finally(() => shutdown(0));
});
//# sourceMappingURL=cli-agent-runner.js.map