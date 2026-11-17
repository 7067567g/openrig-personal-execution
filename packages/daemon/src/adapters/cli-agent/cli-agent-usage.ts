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
//   `reasoning: null`) instead of being fabricated as zero.
//
// Duplicate feeds must not double-count: OpenCode events are keyed by
// `part.id`; DSH events by its `turn`/`step` pair when the stream carries them.

export type CliAgentUsageRuntime = "opencode" | "dsh";

/** A token counter is null when the runtime did not report it. A reported zero
 * stays 0; missing and zero are deliberately different values. */
export interface CliAgentUsageTotals {
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** Aggregate token aliases (`total_tokens` / `totalTokens` / `total`) when
   * the runtime reports a total without a component split. */
  total: number | null;
  costUsd: number | null;
}

export interface CliAgentUsageLastStep {
  at: string;
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  total: number | null;
  costUsd: number | null;
}

export interface CliAgentUsageSidecar {
  schemaVersion: 1;
  runtime: CliAgentUsageRuntime;
  sessionName: string;
  sessionId?: string;
  /** Per-seat occupant tenure that produced this file. A same-name successor
   * has a different generation and must not resume the predecessor's totals. */
  occupantGeneration?: string;
  sampledAt: string;
  steps: number;
  totals: CliAgentUsageTotals;
  lastStep: CliAgentUsageLastStep | null;
  /** Last accepted usage-event key (kept for old-sidecar compatibility). */
  lastEventId?: string;
  /** Bounded replay window of accepted usage-event keys. */
  recentEventIds?: string[];
}

export interface CliAgentUsageState {
  runtime: CliAgentUsageRuntime;
  sessionName: string;
  sessionId?: string;
  occupantGeneration?: string;
  sampledAt: string;
  steps: number;
  totals: CliAgentUsageTotals;
  lastStep: CliAgentUsageLastStep | null;
  /** Last accepted usage-event key; persisted in the sidecar for compatibility. */
  lastEventId?: string;
  /** Bounded replay window of accepted usage-event keys. */
  recentEventIds: string[];
}

export const CLI_AGENT_USAGE_SCHEMA_VERSION = 1 as const;
/** Enough IDs to absorb a reconnect replay while keeping the sidecar bounded. */
export const CLI_AGENT_USAGE_DEDUPE_LIMIT = 64;

function emptyTotals(): CliAgentUsageTotals {
  return {
    input: null,
    output: null,
    reasoning: null,
    cacheRead: null,
    cacheWrite: null,
    total: null,
    costUsd: null,
  };
}

/** Read the launch environment the seat wrapper already sets. Keeping this in
 * the pure fold module means the runner need not grow a second identity path. */
function launchOccupantGeneration(): string | undefined {
  return optionalString(process.env.OPENRIG_OCCUPANT_GENERATION);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A missing/invalid counter stays null instead of becoming a known zero. */
function counterOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Cost has the same unknown/zero distinction as a token counter. */
function costOrNull(value: unknown): number | null {
  return counterOrNull(value);
}

function numberField(value: Record<string, unknown>, names: readonly string[]): number | null {
  for (const name of names) {
    if (name in value) {
      const found = counterOrNull(value[name]);
      if (found !== null) return found;
    }
  }
  return null;
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
  occupantGeneration: string | undefined = launchOccupantGeneration(),
): CliAgentUsageState {
  const currentGeneration = optionalString(occupantGeneration);
  const priorGeneration = optionalString(prior?.occupantGeneration);
  // A known current generation may only resume a sidecar that names the SAME
  // generation. A legacy sidecar with no generation cannot prove continuity, so
  // a known current generation starts empty rather than inheriting it. When
  // both are unknown (legacy daemon/tests), preserve the old resume behavior.
  const sameGeneration = currentGeneration === undefined
    ? priorGeneration === undefined
    : priorGeneration === currentGeneration;
  const resumable = prior && prior.runtime === runtime && prior.sessionName === sessionName && sameGeneration
    ? prior
    : null;
  const priorEventIds = resumable?.recentEventIds
    ?? (resumable?.lastEventId ? [resumable.lastEventId] : []);
  return {
    runtime,
    sessionName,
    sessionId: sessionId ?? resumable?.sessionId,
    ...(currentGeneration ?? resumable?.occupantGeneration
      ? { occupantGeneration: currentGeneration ?? resumable?.occupantGeneration }
      : {}),
    sampledAt: resumable?.sampledAt ?? "",
    steps: resumable?.steps ?? 0,
    totals: resumable
      ? {
        input: resumable.totals.input,
        output: resumable.totals.output,
        reasoning: resumable.totals.reasoning,
        cacheRead: resumable.totals.cacheRead,
        cacheWrite: resumable.totals.cacheWrite,
        total: resumable.totals.total,
        costUsd: resumable.totals.costUsd,
      }
      : emptyTotals(),
    lastStep: resumable?.lastStep ? { ...resumable.lastStep } : null,
    lastEventId: resumable?.lastEventId,
    recentEventIds: [...priorEventIds],
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
  state.recentEventIds = [];
  return true;
}

interface UsageStep {
  eventId?: string;
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  total: number | null;
  costUsd: number | null;
}

function hasUsage(step: Omit<UsageStep, "eventId" | "costUsd">): boolean {
  return step.input !== null || step.output !== null || step.reasoning !== null
    || step.cacheRead !== null || step.cacheWrite !== null || step.total !== null;
}

const CACHE_READ_NAMES = ["cacheReadTokens", "cache_read_tokens", "cacheRead", "cache_read"] as const;
const CACHE_WRITE_NAMES = ["cacheWriteTokens", "cache_write_tokens", "cacheWrite", "cache_write"] as const;
const INPUT_NAMES = ["inputTokens", "input_tokens", "promptTokens", "prompt_tokens", "input"] as const;
const OUTPUT_NAMES = ["outputTokens", "output_tokens", "completionTokens", "completion_tokens", "output"] as const;
const REASONING_NAMES = ["reasoningTokens", "reasoning_tokens", "reasoning"] as const;
const TOTAL_NAMES = ["total_tokens", "totalTokens", "total"] as const;

/** OpenCode: `{"type":"step_finish","part":{"id":"prt_…","tokens":{…},"cost":0.01}}`. */
function readOpencodeStep(event: Record<string, unknown>): UsageStep | null {
  if (event["type"] !== "step_finish") return null;
  const part = isObject(event["part"]) ? event["part"] : {};
  const tokens = isObject(part["tokens"]) ? part["tokens"] : {};
  const cache = isObject(tokens["cache"]) ? tokens["cache"] : {};
  const step = {
    eventId: stringField(part, ["id"]) ?? stringField(event, ["id", "eventId", "event_id"]),
    input: numberField(tokens, INPUT_NAMES),
    output: numberField(tokens, OUTPUT_NAMES),
    reasoning: numberField(tokens, REASONING_NAMES),
    cacheRead: numberField(cache, ["read"]) ?? numberField(tokens, CACHE_READ_NAMES),
    cacheWrite: numberField(cache, ["write"]) ?? numberField(tokens, CACHE_WRITE_NAMES),
    total: numberField(tokens, TOTAL_NAMES),
    costUsd: costOrNull(part["cost"]),
  };
  // A cost-only step is not token usage. Likewise an empty token envelope must
  // not increment the step count or produce a "known 0 tokens" snapshot.
  return hasUsage(step) ? step : null;
}

/** DSH: `{"type":"status","phase":"step_end","turn":1,"step":2,"usage":{…}}`. */
function readDshStep(event: Record<string, unknown>): UsageStep | null {
  if (event["type"] !== "status") return null;
  const phase = typeof event["phase"] === "string" ? event["phase"] : "";
  if (phase !== "step_end" && phase !== "step/end") return null;
  const candidates: Record<string, unknown>[] = [event];
  if (isObject(event["usage"])) candidates.push(event["usage"]);
  if (isObject(event["data"]) && isObject(event["data"]["usage"])) candidates.push(event["data"]["usage"]);
  if (isObject(event["message"]) && isObject(event["message"]["usage"])) candidates.push(event["message"]["usage"]);
  // Some streams put an empty `usage: {}` on the envelope and the real counts
  // in a nested object. Pick the first candidate that actually carries a field,
  // not merely the first object.
  const hasUsageField = (value: Record<string, unknown>): boolean =>
    [...INPUT_NAMES, ...OUTPUT_NAMES, ...REASONING_NAMES, ...CACHE_READ_NAMES, ...CACHE_WRITE_NAMES, ...TOTAL_NAMES]
      .some((key) => counterOrNull(value[key]) !== null);
  const usage = candidates.find(hasUsageField) ?? candidates[0] ?? {};
  const cache = isObject(usage["cache"]) ? usage["cache"] : {};

  // DSH's own numeric step key; both halves are optional but the pair is the
  // dedup identity when present. A stream-level id is a useful fallback.
  const explicitId = stringField(event, ["id", "eventId", "event_id"]);
  const turn = event["turn"] ?? usage["turn"];
  const step = event["step"] ?? usage["step"];
  const eventId = explicitId
    ? `dsh:${explicitId}`
    : turn === undefined && step === undefined
      ? undefined
      : `dsh:${String(turn ?? "")}:${String(step ?? "")}`;
  const usageStep = {
    eventId,
    input: numberField(usage, INPUT_NAMES),
    output: numberField(usage, OUTPUT_NAMES),
    // DSH carries no separate reasoning field; leave it unknown rather than
    // asserting that the runtime reported zero reasoning tokens.
    reasoning: numberField(usage, REASONING_NAMES),
    cacheRead: numberField(usage, CACHE_READ_NAMES) ?? numberField(cache, ["read"]),
    cacheWrite: numberField(usage, CACHE_WRITE_NAMES) ?? numberField(cache, ["write"]),
    total: numberField(usage, TOTAL_NAMES),
    costUsd: null,
  };
  return hasUsage(usageStep) ? usageStep : null;
}

function readUsageStep(runtime: CliAgentUsageRuntime, event: Record<string, unknown>): UsageStep | null {
  return runtime === "opencode" ? readOpencodeStep(event) : readDshStep(event);
}

/**
 * Fold one runtime event. Returns `true` only when a usage event advanced the
 * totals (so the runner knows to persist); anything else leaves the state
 * untouched.
 */
function accumulateCounter(
  priorTotal: number | null,
  stepValue: number | null,
  hadPriorSteps: boolean,
): number | null {
  if (stepValue === null) return null;
  if (priorTotal === null) return hadPriorSteps ? null : stepValue;
  return priorTotal + stepValue;
}

export function observeCliAgentUsageEvent(
  state: CliAgentUsageState,
  event: Record<string, unknown>,
  nowIso: string,
): boolean {
  const step = readUsageStep(state.runtime, event);
  if (!step) return false;
  if (step.eventId !== undefined && state.recentEventIds.includes(step.eventId)) return false;

  const hadPriorSteps = state.steps > 0;
  state.totals.input = accumulateCounter(state.totals.input, step.input, hadPriorSteps);
  state.totals.output = accumulateCounter(state.totals.output, step.output, hadPriorSteps);
  state.totals.reasoning = accumulateCounter(state.totals.reasoning, step.reasoning, hadPriorSteps);
  state.totals.cacheRead = accumulateCounter(state.totals.cacheRead, step.cacheRead, hadPriorSteps);
  state.totals.cacheWrite = accumulateCounter(state.totals.cacheWrite, step.cacheWrite, hadPriorSteps);
  state.totals.total = accumulateCounter(state.totals.total, step.total, hadPriorSteps);
  // A runtime that never reports cost keeps `null`; once a numeric cost shows
  // up, accumulate from there.
  if (step.costUsd !== null) state.totals.costUsd = (state.totals.costUsd ?? 0) + step.costUsd;
  state.steps += 1;
  state.lastStep = {
    at: nowIso,
    input: step.input,
    output: step.output,
    reasoning: step.reasoning,
    cacheRead: step.cacheRead,
    cacheWrite: step.cacheWrite,
    total: step.total,
    costUsd: step.costUsd,
  };
  if (step.eventId !== undefined) {
    state.lastEventId = step.eventId;
    state.recentEventIds = [
      ...state.recentEventIds.filter((id) => id !== step.eventId),
      step.eventId,
    ].slice(-CLI_AGENT_USAGE_DEDUPE_LIMIT);
  }
  state.sampledAt = nowIso;
  return true;
}

export function cliAgentUsageSnapshot(state: CliAgentUsageState, nowIso: string): CliAgentUsageSidecar {
  return {
    schemaVersion: CLI_AGENT_USAGE_SCHEMA_VERSION,
    runtime: state.runtime,
    sessionName: state.sessionName,
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
    ...(state.occupantGeneration ? { occupantGeneration: state.occupantGeneration } : {}),
    sampledAt: nowIso,
    steps: state.steps,
    totals: { ...state.totals },
    lastStep: state.lastStep ? { ...state.lastStep } : null,
    ...(state.lastEventId ? { lastEventId: state.lastEventId } : {}),
    ...(state.recentEventIds.length ? { recentEventIds: [...state.recentEventIds] } : {}),
  };
}

/** A missing/null counter is unknown (null); an invalid value is malformed
 * (undefined). The distinction keeps additive schema fields compatible without
 * turning corruption into an unknown reading. */
function parseCounterField(raw: Record<string, unknown>, field: string): number | null | undefined {
  const value = raw[field];
  if (value === undefined || value === null) return null;
  const parsed = counterOrNull(value);
  return parsed === null ? undefined : parsed;
}

function parseTotals(raw: unknown): CliAgentUsageTotals | null {
  if (!isObject(raw)) return null;
  const input = parseCounterField(raw, "input");
  const output = parseCounterField(raw, "output");
  const reasoning = parseCounterField(raw, "reasoning");
  const cacheRead = parseCounterField(raw, "cacheRead");
  const cacheWrite = parseCounterField(raw, "cacheWrite");
  const total = parseCounterField(raw, "total");
  const costUsd = parseCounterField(raw, "costUsd");
  if ([input, output, reasoning, cacheRead, cacheWrite, total, costUsd].some((value) => value === undefined)) return null;
  return {
    input: input ?? null,
    output: output ?? null,
    reasoning: reasoning ?? null,
    cacheRead: cacheRead ?? null,
    cacheWrite: cacheWrite ?? null,
    total: total ?? null,
    costUsd: costUsd ?? null,
  };
}

function parseLastStep(raw: unknown): CliAgentUsageLastStep | null | undefined {
  if (raw === null) return null;
  if (!isObject(raw) || typeof raw["at"] !== "string") return undefined;
  const input = parseCounterField(raw, "input");
  const output = parseCounterField(raw, "output");
  const reasoning = parseCounterField(raw, "reasoning");
  const cacheRead = parseCounterField(raw, "cacheRead");
  const cacheWrite = parseCounterField(raw, "cacheWrite");
  const total = parseCounterField(raw, "total");
  const costUsd = parseCounterField(raw, "costUsd");
  if ([input, output, reasoning, cacheRead, cacheWrite, total, costUsd].some((value) => value === undefined)) return undefined;
  return {
    at: raw["at"],
    input: input ?? null,
    output: output ?? null,
    reasoning: reasoning ?? null,
    cacheRead: cacheRead ?? null,
    cacheWrite: cacheWrite ?? null,
    total: total ?? null,
    costUsd: costUsd ?? null,
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
  const occupantGeneration = parsed["occupantGeneration"];
  if (occupantGeneration !== undefined && (typeof occupantGeneration !== "string" || occupantGeneration.length === 0)) return null;
  const lastEventId = parsed["lastEventId"];
  if (lastEventId !== undefined && (typeof lastEventId !== "string" || lastEventId.length === 0)) return null;
  const recentRaw = parsed["recentEventIds"];
  if (recentRaw !== undefined && !Array.isArray(recentRaw)) return null;
  if (Array.isArray(recentRaw) && recentRaw.some((id) => typeof id !== "string" || id.length === 0)) return null;
  const recentEventIds = [...new Set([
    ...((recentRaw as string[] | undefined) ?? []),
    ...(lastEventId ? [lastEventId] : []),
  ])].slice(-CLI_AGENT_USAGE_DEDUPE_LIMIT);
  return {
    schemaVersion: CLI_AGENT_USAGE_SCHEMA_VERSION,
    runtime,
    sessionName,
    ...(sessionId ? { sessionId } : {}),
    ...(occupantGeneration ? { occupantGeneration } : {}),
    sampledAt,
    steps,
    totals,
    lastStep,
    ...(lastEventId ? { lastEventId } : {}),
    ...(recentEventIds.length ? { recentEventIds } : {}),
  };
}
