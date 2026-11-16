// Pure usage folding for the pane-hosted OpenCode/DSH CLI agent runners.
//
// The runner observes the runtime's stdout event stream and folds the token /
// cost numbers it finds into a monotonic totals state, then persists a snapshot
// as `<seatRoot>/usage.json`. This module is deliberately free of daemon, db and
// IO imports so the wire shapes can be tested without spawning a runtime.
//
// Shapes consumed:
// - OpenCode `run --format json`: `step_finish.part.tokens` (input/output/
//   reasoning/cache{read,write}) plus `part.cost` (USD for that step).
// - DSH `--json`: `status` + `phase: "step_end"` with `usage.inputTokens/
//   outputTokens/cacheReadTokens/cacheWriteTokens`. DSH reports no cost and no
//   separate reasoning count, so both stay honest (`costUsd: null`,
//   `reasoning: 0`) instead of being fabricated.
//
// Duplicate feeds must not double-count: OpenCode events are keyed by
// `part.id`; DSH events by its `turn`/`step` pair when the stream carries them.

export type CliAgentUsageRuntime = "opencode" | "dsh";

export interface CliAgentUsageTotals {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number | null;
}

export interface CliAgentUsageLastStep {
  at: string;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number | null;
}

export interface CliAgentUsageSidecar {
  schemaVersion: 1;
  runtime: CliAgentUsageRuntime;
  sessionName: string;
  sessionId?: string;
  sampledAt: string;
  steps: number;
  totals: CliAgentUsageTotals;
  lastStep: CliAgentUsageLastStep | null;
  /** Last accepted usage-event key, persisted so a runner restart can still dedupe a replayed tail. */
  lastEventId?: string;
}

export interface CliAgentUsageState {
  runtime: CliAgentUsageRuntime;
  sessionName: string;
  sessionId?: string;
  sampledAt: string;
  steps: number;
  totals: CliAgentUsageTotals;
  lastStep: CliAgentUsageLastStep | null;
  /** Dedup key of the last accepted usage event; persisted in the sidecar. */
  lastEventId?: string;
}

export const CLI_AGENT_USAGE_SCHEMA_VERSION = 1 as const;

function emptyTotals(): CliAgentUsageTotals {
  return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, costUsd: null };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Like `nonNegative`, but a missing/invalid cost stays `null` instead of `0`. */
function costOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function numberField(value: Record<string, unknown>, names: readonly string[]): number {
  for (const name of names) {
    if (typeof value[name] === "number") return nonNegative(value[name]);
  }
  return 0;
}

function stringField(value: Record<string, unknown>, names: readonly string[]): string | undefined {
  for (const name of names) {
    const found = value[name];
    if (typeof found === "string" && found.length > 0) return found;
  }
  return undefined;
}

export function createCliAgentUsageState(
  runtime: CliAgentUsageRuntime,
  sessionName: string,
  sessionId?: string,
  prior?: CliAgentUsageSidecar | null,
): CliAgentUsageState {
  const resumable = prior && prior.runtime === runtime && prior.sessionName === sessionName ? prior : null;
  return {
    runtime,
    sessionName,
    sessionId: sessionId ?? resumable?.sessionId,
    sampledAt: resumable?.sampledAt ?? "",
    steps: resumable?.steps ?? 0,
    totals: resumable
      ? {
        input: resumable.totals.input,
        output: resumable.totals.output,
        reasoning: resumable.totals.reasoning,
        cacheRead: resumable.totals.cacheRead,
        cacheWrite: resumable.totals.cacheWrite,
        costUsd: resumable.totals.costUsd,
      }
      : emptyTotals(),
    lastStep: resumable?.lastStep ? { ...resumable.lastStep } : null,
    lastEventId: resumable?.lastEventId,
  };
}

/**
 * Point the usage state at a runtime-native session id.
 *
 * A runner may be reused across native sessions (for example when the seat is
 * fresh-primed). Cumulative totals belong to one native session, so a change
 * resets the fold instead of letting the new session inherit the old session's
 * cost/token window. Returns true when totals were reset (caller should persist).
 */
export function setCliAgentUsageSession(
  state: CliAgentUsageState,
  nextSessionId: string | undefined,
  nowIso: string,
): boolean {
  if (!nextSessionId || nextSessionId === state.sessionId) return false;
  const hadPriorSession = state.sessionId !== undefined && state.steps > 0;
  state.sessionId = nextSessionId;
  if (!hadPriorSession) return false;
  state.sampledAt = nowIso;
  state.steps = 0;
  state.totals = emptyTotals();
  state.lastStep = null;
  state.lastEventId = undefined;
  return true;
}

interface UsageStep {
  eventId?: string;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number | null;
}

/** OpenCode: `{"type":"step_finish","part":{"id":"prt_…","tokens":{…},"cost":0.01}}`. */
function readOpencodeStep(event: Record<string, unknown>): UsageStep | null {
  if (event["type"] !== "step_finish") return null;
  const part = isObject(event["part"]) ? event["part"] : {};
  const tokens = isObject(part["tokens"]) ? part["tokens"] : {};
  const cache = isObject(tokens["cache"]) ? tokens["cache"] : {};
  return {
    eventId: stringField(part, ["id"]),
    input: nonNegative(tokens["input"]),
    output: nonNegative(tokens["output"]),
    reasoning: nonNegative(tokens["reasoning"]),
    cacheRead: nonNegative(cache["read"]),
    cacheWrite: nonNegative(cache["write"]),
    costUsd: costOrNull(part["cost"]),
  };
}

/** DSH: `{"type":"status","phase":"step_end","turn":1,"step":2,"usage":{…}}`. */
function readDshStep(event: Record<string, unknown>): UsageStep | null {
  if (event["type"] !== "status") return null;
  const phase = typeof event["phase"] === "string" ? event["phase"] : "";
  if (phase !== "step_end" && phase !== "step/end") return null;
  const candidates: Record<string, unknown>[] = [];
  if (isObject(event["usage"])) candidates.push(event["usage"]);
  if (isObject(event["data"]) && isObject(event["data"]["usage"])) candidates.push(event["data"]["usage"]);
  if (isObject(event["message"]) && isObject(event["message"]["usage"])) candidates.push(event["message"]["usage"]);
  // Some streams put an empty `usage: {}` on the envelope and the real counts
  // in a nested object. Pick the first candidate that actually carries a field,
  // not merely the first object.
  const hasUsageField = (value: Record<string, unknown>): boolean =>
    ["inputTokens", "input_tokens", "promptTokens", "prompt_tokens",
      "outputTokens", "output_tokens", "completionTokens", "completion_tokens",
      "cacheReadTokens", "cache_read_tokens", "cacheWriteTokens", "cache_write_tokens"]
      .some((key) => typeof value[key] === "number");
  const usage = candidates.find(hasUsageField) ?? candidates[0] ?? {};

  // DSH's own numeric step key; both halves are optional but the pair is the
  // dedup identity when present.
  const turn = event["turn"] ?? usage["turn"];
  const step = event["step"] ?? usage["step"];
  const eventId = turn === undefined && step === undefined
    ? undefined
    : `dsh:${String(turn ?? "")}:${String(step ?? "")}`;

  return {
    eventId,
    input: numberField(usage, ["inputTokens", "input_tokens", "promptTokens", "prompt_tokens"]),
    output: numberField(usage, ["outputTokens", "output_tokens", "completionTokens", "completion_tokens"]),
    // DSH carries no separate reasoning count; tokens are reported as a total.
    reasoning: 0,
    cacheRead: numberField(usage, ["cacheReadTokens", "cache_read_tokens"]),
    cacheWrite: numberField(usage, ["cacheWriteTokens", "cache_write_tokens"]),
    costUsd: null,
  };
}

function readUsageStep(runtime: CliAgentUsageRuntime, event: Record<string, unknown>): UsageStep | null {
  return runtime === "opencode" ? readOpencodeStep(event) : readDshStep(event);
}

/**
 * Fold one runtime event. Returns `true` only when a usage event advanced the
 * totals (so the runner knows to persist); anything else leaves the state
 * untouched.
 */
export function observeCliAgentUsageEvent(
  state: CliAgentUsageState,
  event: Record<string, unknown>,
  nowIso: string,
): boolean {
  const step = readUsageStep(state.runtime, event);
  if (!step) return false;
  if (step.eventId !== undefined && state.lastEventId === step.eventId) return false;

  state.steps += 1;
  state.totals.input += step.input;
  state.totals.output += step.output;
  state.totals.reasoning += step.reasoning;
  state.totals.cacheRead += step.cacheRead;
  state.totals.cacheWrite += step.cacheWrite;
  // A runtime that never reports cost keeps `null`; once a numeric cost shows
  // up, accumulate from there.
  if (step.costUsd !== null) state.totals.costUsd = (state.totals.costUsd ?? 0) + step.costUsd;
  state.lastStep = {
    at: nowIso,
    input: step.input,
    output: step.output,
    reasoning: step.reasoning,
    cacheRead: step.cacheRead,
    cacheWrite: step.cacheWrite,
    costUsd: step.costUsd,
  };
  state.lastEventId = step.eventId;
  state.sampledAt = nowIso;
  return true;
}

export function cliAgentUsageSnapshot(state: CliAgentUsageState, nowIso: string): CliAgentUsageSidecar {
  return {
    schemaVersion: CLI_AGENT_USAGE_SCHEMA_VERSION,
    runtime: state.runtime,
    sessionName: state.sessionName,
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
    sampledAt: nowIso,
    steps: state.steps,
    totals: { ...state.totals },
    lastStep: state.lastStep ? { ...state.lastStep } : null,
    ...(state.lastEventId ? { lastEventId: state.lastEventId } : {}),
  };
}

function parseTotals(raw: unknown): CliAgentUsageTotals | null {
  if (!isObject(raw)) return null;
  const fields = ["input", "output", "reasoning", "cacheRead", "cacheWrite"] as const;
  for (const field of fields) {
    if (typeof raw[field] !== "number" || !Number.isFinite(raw[field] as number)) return null;
  }
  const cost = raw["costUsd"];
  if (cost !== null && (typeof cost !== "number" || !Number.isFinite(cost))) return null;
  return {
    input: raw["input"] as number,
    output: raw["output"] as number,
    reasoning: raw["reasoning"] as number,
    cacheRead: raw["cacheRead"] as number,
    cacheWrite: raw["cacheWrite"] as number,
    costUsd: cost as number | null,
  };
}

function parseLastStep(raw: unknown): CliAgentUsageLastStep | null | undefined {
  if (raw === null) return null;
  if (!isObject(raw)) return undefined;
  const fields = ["input", "output", "reasoning", "cacheRead", "cacheWrite"] as const;
  for (const field of fields) {
    if (typeof raw[field] !== "number" || !Number.isFinite(raw[field] as number)) return undefined;
  }
  const cost = raw["costUsd"];
  if (cost !== null && (typeof cost !== "number" || !Number.isFinite(cost))) return undefined;
  if (typeof raw["at"] !== "string") return undefined;
  return {
    at: raw["at"],
    input: raw["input"] as number,
    output: raw["output"] as number,
    reasoning: raw["reasoning"] as number,
    cacheRead: raw["cacheRead"] as number,
    cacheWrite: raw["cacheWrite"] as number,
    costUsd: cost as number | null,
  };
}

/** Strict reader for the persisted sidecar: bad JSON or a missing field → null. */
export function parseCliAgentUsageSidecar(raw: string): CliAgentUsageSidecar | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  if (parsed["schemaVersion"] !== CLI_AGENT_USAGE_SCHEMA_VERSION) return null;
  const runtime = parsed["runtime"];
  if (runtime !== "opencode" && runtime !== "dsh") return null;
  const sessionName = parsed["sessionName"];
  if (typeof sessionName !== "string" || sessionName.length === 0) return null;
  const sampledAt = parsed["sampledAt"];
  if (typeof sampledAt !== "string") return null;
  const steps = parsed["steps"];
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 0) return null;
  const totals = parseTotals(parsed["totals"]);
  if (!totals) return null;
  const lastStep = parseLastStep(parsed["lastStep"]);
  if (lastStep === undefined) return null;
  const sessionId = parsed["sessionId"];
  if (sessionId !== undefined && typeof sessionId !== "string") return null;
  const lastEventId = parsed["lastEventId"];
  if (lastEventId !== undefined && typeof lastEventId !== "string") return null;
  return {
    schemaVersion: CLI_AGENT_USAGE_SCHEMA_VERSION,
    runtime,
    sessionName,
    ...(sessionId ? { sessionId } : {}),
    sampledAt,
    steps,
    totals,
    lastStep,
    ...(lastEventId ? { lastEventId } : {}),
  };
}
