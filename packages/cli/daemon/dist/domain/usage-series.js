import { hasClientCostColumns } from "./usage-samples-store.js";
import { hasPiUsageChargesTable, hasPiUsageEntriesTable } from "./pi-usage-entries-store.js";
import { openRouterChargeTarget } from "./openrouter-charge.js";
/** Captures are stored at millisecond precision in UTC. Keep the indexed column
 * comparison, but compare an ISO cutoff's instant rather than its offset/spelling.
 * Both >= and < use the next stored instant for a sub-millisecond boundary. */
function capturedAtBound(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match)
        return value;
    const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
    const local = new Date(0);
    local.setUTCFullYear(year, month - 1, day);
    local.setUTCHours(hour, minute, second, 0);
    if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month ||
        local.getUTCDate() !== day || local.getUTCHours() !== hour ||
        local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second)
        return value;
    const epoch = Date.parse(value);
    const betweenMilliseconds = /[1-9]/.test(match[7]?.slice(3) ?? "");
    const bound = epoch + (betweenMilliseconds ? 1 : 0);
    return Number.isFinite(bound) && Math.abs(bound) <= 8.64e15 ? new Date(bound).toISOString() : value;
}
/** Serve the RAW stored rows, oldest first. Bounds are absolute on captured_at
 *  (since inclusive-of-later, i.e. `>=`; until exclusive `<`). */
export function queryUsageSeries(db, q) {
    return readUsageSeries(db, q, false);
}
/** Complete internal projections must not inherit the public raw-row page cap. */
function readUsageSeries(db, q, complete) {
    const where = [];
    const params = [];
    if (q.seatSession) {
        where.push("seat_session = ?");
        params.push(q.seatSession);
    }
    if (q.lane) {
        where.push("lane = ?");
        params.push(q.lane);
    }
    if (q.sinceIso) {
        where.push("captured_at >= ?");
        params.push(capturedAtBound(q.sinceIso));
    }
    if (q.untilIso) {
        where.push("captured_at < ?");
        params.push(capturedAtBound(q.untilIso));
    }
    const limit = q.limit && q.limit > 0 ? Math.floor(q.limit) : 10_000;
    const withCost = hasClientCostColumns(db);
    const rows = db
        .prepare(`SELECT id, lane, seat_session, node_id, source, sampled_at, captured_at,
              total_input_tokens, total_output_tokens, used_percentage,
              window, window_used_percent, resets_at${withCost ? ", native_session_id, client_cost_estimate_usd" : ""}
         FROM usage_samples
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY captured_at ASC, id ASC
        ${complete ? "" : "LIMIT ?"}`)
        .all(...params, ...(complete ? [] : [limit]));
    return rows.map((r) => ({
        id: r.id,
        lane: r.lane,
        seatSession: r.seat_session,
        nodeId: r.node_id ?? null,
        source: r.source ?? null,
        sampledAt: r.sampled_at ?? null,
        capturedAt: r.captured_at,
        totalInputTokens: r.total_input_tokens ?? null,
        totalOutputTokens: r.total_output_tokens ?? null,
        usedPercentage: r.used_percentage ?? null,
        window: r.window ?? null,
        windowUsedPercent: r.window_used_percent ?? null,
        resetsAt: r.resets_at ?? null,
        ...(withCost ? { nativeSessionId: r.native_session_id ?? null,
            clientCostEstimateUsd: r.client_cost_estimate_usd ?? null } : {}),
    }));
}
function hoursBetween(aIso, bIso) {
    return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3_600_000;
}
/** The money question: top-N seats by token burn over the last H hours. */
export function computeTopBurn(db, q) {
    const nowMs = new Date(q.nowIso).getTime();
    const sinceIso = new Date(nowMs - q.windowHours * 3_600_000).toISOString();
    // Stored captures use millisecond ISO timestamps; retain the exact endpoint.
    const untilIso = new Date(nowMs + 1).toISOString();
    const seats = db.prepare(`SELECT DISTINCT seat_session AS s FROM usage_samples`).all().map((r) => r.s);
    const ranked = [];
    const unknown = [];
    for (const seat of seats) {
        const rawContext = readUsageSeries(db, { seatSession: seat, lane: "context", sinceIso, untilIso }, true);
        if (rawContext.length === 0) {
            // history exists (the seat appeared in the census) but nothing fresh
            unknown.push({ seatSession: seat, reason: "no_fresh_samples" });
            continue;
        }
        // Missing counters are unknown observations, not a restart to zero.
        const ctx = rawContext.filter((row) => Number.isFinite(row.totalInputTokens) && Number.isFinite(row.totalOutputTokens));
        if (ctx.length < 2) {
            unknown.push({ seatSession: seat, reason: "insufficient_samples" });
            continue;
        }
        let tokensDelta = 0;
        let resets = 0;
        // A node can launch another native session or switch runtimes. Counters
        // only describe movement within that history; crossing baselines invents burn.
        const previousByHistory = new Map();
        let pairs = 0;
        for (const row of ctx) {
            const cur = row.totalInputTokens + row.totalOutputTokens;
            const history = JSON.stringify([row.nodeId, row.source, row.nativeSessionId ?? null]);
            const prev = previousByHistory.get(history);
            if (prev !== undefined) {
                pairs += 1;
                const delta = cur - prev;
                if (delta >= 0)
                    tokensDelta += delta;
                else
                    resets += 1; // a restart dropped the totals — never negative burn
            }
            previousByHistory.set(history, cur);
        }
        if (pairs === 0) {
            unknown.push({ seatSession: seat, reason: "insufficient_samples" });
            continue;
        }
        const spanHours = hoursBetween(ctx[0].capturedAt, ctx[ctx.length - 1].capturedAt);
        const tokensPerHour = spanHours > 0 ? tokensDelta / spanHours : 0;
        const windows = [];
        const providerRows = readUsageSeries(db, { seatSession: seat, lane: "provider_window", sinceIso, untilIso }, true);
        for (const w of ["five_hour", "weekly"]) {
            const rows = providerRows.filter((r) => r.window === w);
            if (rows.length === 0)
                continue;
            const first = rows[0];
            const last = rows[rows.length - 1];
            const wSpan = hoursBetween(first.capturedAt, last.capturedAt);
            const measurable = rows.length >= 2 && wSpan > 0 && first.windowUsedPercent !== null && last.windowUsedPercent !== null;
            windows.push({
                window: w,
                usedPercentFirst: first.windowUsedPercent,
                usedPercentLast: last.windowUsedPercent,
                percentPerHour: measurable ? (last.windowUsedPercent - first.windowUsedPercent) / wSpan : null,
                resetsAt: last.resetsAt,
            });
        }
        ranked.push({ seatSession: seat, tokensPerHour, tokensDelta, resets, spanHours, samples: ctx.length, windows });
    }
    ranked.sort((a, b) => b.tokensPerHour - a.tokensPerHour);
    const totalRankedSeats = ranked.length;
    const capped = q.topN && q.topN > 0 ? ranked.slice(0, q.topN) : ranked;
    return { windowHours: q.windowHours, sinceIso, ranked: capped, unknown, totalRankedSeats };
}
// ---------------------------------------------------------------------------
// OPR.0.7.0.2 (cost reporting, first atom): what each seat's harness reports about cost, beside its tokens.
// Read from the context lane only. Every figure names its kind, source, window and coverage; a missing figure
// is reported as missing and an old one as stale, never as zero. Nothing here is an invoice, and no
// subscription window is ever turned into dollars.
/** A Claude estimate older than this reads stale (it stays shown, as history). Matches context freshness. */
export const COST_STALE_AFTER_MS = 10 * 60_000;
export const CODEX_NO_COST_NOTE = "no cost reported by the inspected method (Codex token_count events carry tokens only)";
/** DSH's runner reports token usage but no client-side cost; the view says so instead of showing $0. */
export const DSH_NO_COST_NOTE = "no cost reported by the inspected method (DSH runner reports tokens but no client cost estimate)";
export const PI_COST_COVERAGE_WITH_CHARGE = "this Pi session's own persisted entries of every usage-bearing kind Pi records (assistant, usage, tool result, compaction, branch summary), each counted once; a model-priced estimate from catalog rates, not a provider charge (OpenRouter's actual charge, where established, is in providerCharge beside it, never added)";
export const PI_PROVIDER_CHARGE_COVERAGE = "OpenRouter requests Pi made through its openai-completions API with a recorded generation id, looked up with the key OpenRig forwarded only when the runner's observations before and after the request show that key as Pi's credential and no extension, credential-bearing models.json OpenRouter entry or unclassifiable credential source, and none has been seen, nor any reading failed, in the runner's life (models.json is read as Pi reads it, comments included). Conservatively excluded too: any settings.json package entry, and an explicit models.json apiKey even when it names OPENROUTER_API_KEY. Anthropic-messages requests, other credentials, inherited and unknown-origin entries are not looked up. Not observable: a credential Pi loads and drops between two of the runner's observations (an extension, a models.json entry, or a stored key added and removed within one gap), including runtime effects Pi keeps after it; Pi records no per-request credential";
export const PI_COST_COVERAGE = "this Pi session's own persisted entries of every usage-bearing kind Pi records (assistant, usage, tool result, compaction, branch summary), each counted once; a model-priced estimate from catalog rates, not a provider charge (an OpenRouter actual charge isn't correlated here)";
export function computeCostView(db, q) {
    const note = "Costs are what each harness reports: a client-side estimate is not an invoice, and no subscription window is shown in dollars.";
    const withCost = hasClientCostColumns(db);
    const rows = db.prepare(`SELECT id, seat_session, source, sampled_at, captured_at, total_input_tokens, total_output_tokens,
            ${withCost ? "native_session_id, client_cost_estimate_usd" : "NULL AS native_session_id, NULL AS client_cost_estimate_usd"}
       FROM usage_samples
      WHERE lane = 'context'${q.seatSession ? " AND seat_session = ?" : ""}
      ORDER BY seat_session ASC, id ASC`).all(...(q.seatSession ? [q.seatSession] : []));
    const bySeat = new Map();
    for (const row of rows)
        bySeat.set(row.seat_session, [...(bySeat.get(row.seat_session) ?? []), row]);
    const now = Date.parse(q.nowIso);
    const staleAfter = q.staleAfterMs ?? COST_STALE_AFTER_MS;
    const seats = [];
    for (const [seatSession, seatRows] of bySeat) {
        const latest = seatRows[seatRows.length - 1];
        const tokens = { input: latest.total_input_tokens, output: latest.total_output_tokens };
        const asOf = latest.sampled_at ?? latest.captured_at;
        if (latest.source === "codex_token_count_jsonl") {
            seats.push({ seatSession, runtime: "codex", status: "no-cost-method", note: CODEX_NO_COST_NOTE,
                window: { nativeSessionId: latest.native_session_id, asOf }, tokens });
            continue;
        }
        if (latest.source === "opencode_runner_json") {
            seats.push(opencodeSeatCost({ seatSession, seatRows, latest, now, staleAfter, withCost, tokens }));
            continue;
        }
        if (latest.source === "dsh_runner_json") {
            seats.push({ seatSession, runtime: "dsh", status: "no-cost-method", note: DSH_NO_COST_NOTE,
                window: { nativeSessionId: latest.native_session_id, asOf }, tokens });
            continue;
        }
        if (latest.source !== "claude_statusline_json") {
            seats.push({ seatSession, runtime: null, status: "unknown", reason: `samples from source ${latest.source ?? "(none)"} carry no cost` });
            continue;
        }
        // The latest native session's estimates, in order. A drop within the session is a reset: the window restarts.
        const session = latest.native_session_id;
        const estimates = session ? seatRows.filter((r) => r.native_session_id === session && r.client_cost_estimate_usd !== null) : [];
        if (estimates.length === 0) {
            seats.push({ seatSession, runtime: "claude-code", status: "absent",
                reason: !withCost ? "this daemon's usage series has no cost columns yet"
                    : !session ? "the latest sample names no native session"
                        : "Claude's statusline has reported no cost for this session",
                window: { nativeSessionId: session, asOf }, tokens });
            continue;
        }
        let resets = 0;
        let since = estimates[0].sampled_at ?? estimates[0].captured_at;
        for (let i = 1; i < estimates.length; i += 1) {
            if (estimates[i].client_cost_estimate_usd < estimates[i - 1].client_cost_estimate_usd) {
                resets += 1;
                since = estimates[i].sampled_at ?? estimates[i].captured_at;
            }
        }
        const last = estimates[estimates.length - 1];
        const lastAt = last.sampled_at ?? last.captured_at;
        const age = Number.isNaN(now) || Number.isNaN(Date.parse(lastAt)) ? null : Math.max(0, Math.round((now - Date.parse(lastAt)) / 1000));
        seats.push({
            seatSession, runtime: "claude-code", status: "reported", kind: "client-side estimate", source: "Claude statusline cost.total_cost_usd",
            costUsd: last.client_cost_estimate_usd,
            window: { nativeSessionId: session, since, asOf: lastAt },
            coverage: "this native Claude session since its last reset, as Claude's client estimates it; not an invoice, and not the seat's other sessions",
            resets, stale: age === null ? true : age * 1000 > staleAfter, ageSeconds: age,
            tokens: { input: last.total_input_tokens, output: last.total_output_tokens },
        });
    }
    for (const pi of piSeatCosts(db, q.seatSession)) {
        const at = seats.findIndex((seat) => seat.seatSession === pi.seatSession);
        if (at >= 0)
            seats[at] = pi;
        else
            seats.push(pi);
    }
    return { seats, note };
}
/**
 * OpenCode's runner reports a per-step cost in `step_finish`; the series stores the cumulative estimate per
 * native session. Same reading as Claude's arm: a drop within the session is a reset, the figure is the latest
 * reported value (never summed), and an old one is stale, not zero.
 */
function opencodeSeatCost(input) {
    const { seatSession, seatRows, latest, now, staleAfter, withCost, tokens } = input;
    const session = latest.native_session_id;
    const asOf = latest.sampled_at ?? latest.captured_at;
    const estimates = session
        ? seatRows.filter((r) => r.native_session_id === session && r.client_cost_estimate_usd !== null)
        : [];
    if (estimates.length === 0) {
        return {
            seatSession, runtime: "opencode", status: "absent",
            reason: !withCost ? "this daemon's usage series has no cost columns yet"
                : !session ? "the latest sample names no native session"
                    : "OpenCode's step_finish events have reported no cost for this session",
            window: { nativeSessionId: session, asOf }, tokens,
        };
    }
    let resets = 0;
    let since = estimates[0].sampled_at ?? estimates[0].captured_at;
    for (let i = 1; i < estimates.length; i += 1) {
        if (estimates[i].client_cost_estimate_usd < estimates[i - 1].client_cost_estimate_usd) {
            resets += 1;
            since = estimates[i].sampled_at ?? estimates[i].captured_at;
        }
    }
    const last = estimates[estimates.length - 1];
    const lastAt = last.sampled_at ?? last.captured_at;
    const age = Number.isNaN(now) || Number.isNaN(Date.parse(lastAt)) ? null : Math.max(0, Math.round((now - Date.parse(lastAt)) / 1000));
    return {
        seatSession, runtime: "opencode", status: "reported", kind: "client-side estimate", source: "OpenCode step_finish cost",
        costUsd: last.client_cost_estimate_usd,
        window: { nativeSessionId: session, since, asOf: lastAt },
        coverage: "this native OpenCode session since its last reset, from the runner's step_finish cost values; a client-side estimate, not an invoice, and not the seat's other sessions",
        resets, stale: age === null ? true : age * 1000 > staleAfter, ageSeconds: age,
        tokens: { input: last.total_input_tokens, output: last.total_output_tokens },
    };
}
function hasChargeOutcome(db, piSession) {
    return !!db.prepare("SELECT 1 FROM pi_usage_charges WHERE pi_session_id = ? LIMIT 1").get(piSession);
}
/** OpenRouter's charge for one seat's Pi session: own assistant requests only, charged ones summed apart from
 *  the estimate, every other request counted with its reason. */
function providerChargeView(db, seat, piSession) {
    const rows = db.prepare(`SELECT e.kind, e.provider, e.api, e.response_id, e.cost_total, c.status, c.total_cost_usd, c.reason,
            c.credential_source, c.workspace_id, c.is_byok, c.generation_id
       FROM pi_usage_entries e
       LEFT JOIN pi_usage_charges c ON c.pi_session_id = e.pi_session_id AND c.entry_id = e.entry_id
      WHERE e.seat_session = ? AND e.pi_session_id = ? AND e.origin = 'own' AND e.kind = 'assistant' AND e.provider = 'openrouter'`).all(seat, piSession);
    const tally = (into, key) => { into[key] = (into[key] ?? 0) + 1; };
    const notCovered = {};
    const unavailable = {};
    const covered = rows.filter((row) => {
        const target = openRouterChargeTarget({ kind: row.kind, provider: row.provider, api: row.api, responseId: row.response_id });
        if ("notCovered" in target)
            tally(notCovered, target.notCovered);
        return "generationId" in target;
    });
    const charged = covered.filter((row) => row.status === "charged" && row.generation_id === row.response_id);
    for (const row of covered)
        if (row.status === "unavailable")
            tally(unavailable, row.reason ?? "unavailable");
    const unavailableCount = covered.filter((row) => row.status === "unavailable").length;
    const pending = covered.length - charged.length - unavailableCount;
    const looked = covered.some((row) => row.status !== null);
    const status = rows.length === 0 ? "not-applicable"
        : charged.length > 0 && charged.length === covered.length ? "reported"
            : charged.length > 0 ? "partial"
                : !looked ? "none"
                    : pending > 0 ? "pending" : "unavailable";
    const priced = charged.filter((row) => row.cost_total !== null);
    const distinct = (values) => [...new Set(values.filter((v) => !!v))].sort();
    return {
        kind: "provider charge",
        source: "OpenRouter GET /api/v1/generation (data.total_cost, USD)",
        coverage: PI_PROVIDER_CHARGE_COVERAGE,
        status,
        ...(charged.length > 0 ? {
            costUsd: charged.reduce((t, row) => t + row.total_cost_usd, 0),
            estimateForChargedUsd: priced.length === charged.length ? priced.reduce((t, row) => t + row.cost_total, 0) : null,
        } : {}),
        requests: {
            openRouter: rows.length, covered: covered.length, charged: charged.length, pending,
            unavailable: { count: unavailableCount, reasons: unavailable },
            notCovered: { count: rows.length - covered.length, reasons: notCovered },
        },
        accountContext: {
            credentialSources: distinct(covered.map((row) => row.credential_source)),
            workspaceIds: distinct(charged.map((row) => row.workspace_id)),
            byokRequests: charged.filter((row) => row.is_byok === 1).length,
        },
    };
}
/** Each Pi seat's latest Pi session: the one whose facts first arrived most recently (a late entry for an older
 *  session doesn't make it current again). Earlier sessions stay stored as history. */
function piSeatCosts(db, seatSession) {
    if (!hasPiUsageEntriesTable(db))
        return [];
    const latest = db.prepare(`WITH s AS (SELECT seat_session, pi_session_id, MIN(id) AS first_id FROM pi_usage_entries
                ${seatSession ? "WHERE seat_session = ? " : ""}GROUP BY seat_session, pi_session_id)
     SELECT seat_session, pi_session_id FROM s
      WHERE first_id = (SELECT MAX(first_id) FROM s s2 WHERE s2.seat_session = s.seat_session)
      ORDER BY seat_session ASC`).all(...(seatSession ? [seatSession] : []));
    const sum = (rows) => {
        const priced = rows.filter((r) => r.cost_total !== null);
        return priced.length ? priced.reduce((total, r) => total + r.cost_total, 0) : null;
    };
    return latest.map(({ seat_session: seat, pi_session_id: piSession }) => {
        const rows = db.prepare(`SELECT id, seat_session, pi_session_id, entry_timestamp, kind, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
              cost_total, stop_reason, origin
         FROM pi_usage_entries WHERE seat_session = ? AND pi_session_id = ? ORDER BY entry_timestamp ASC, id ASC`).all(seat, piSession);
        const own = rows.filter((r) => r.origin === "own");
        const charged = hasPiUsageChargesTable(db) && hasChargeOutcome(db, piSession);
        const inherited = rows.filter((r) => r.origin === "inherited");
        const unknown = rows.filter((r) => r.origin === "unknown");
        const kinds = { assistant: 0, usage: 0, tool_result: 0, compaction: 0, branch_summary: 0 };
        for (const r of own)
            kinds[r.kind] += 1;
        const ownCost = sum(own);
        return {
            seatSession: seat, runtime: "pi",
            status: ownCost === null ? "absent" : "reported",
            kind: "model-priced estimate", source: "Pi persisted session entries (usage.cost.total)",
            ...(ownCost === null
                ? { reason: own.length === 0 ? "no own entries with usage are stored for this Pi session yet" : "Pi recorded no cost on this session's own entries" }
                : { costUsd: ownCost }),
            window: { piSessionId: piSession, since: own[0]?.entry_timestamp ?? null, asOf: own.at(-1)?.entry_timestamp ?? null },
            coverage: charged ? PI_COST_COVERAGE_WITH_CHARGE : PI_COST_COVERAGE,
            kinds,
            entries: {
                own: own.length,
                ownWithoutCost: own.filter((r) => r.cost_total === null).length,
                errorOrAborted: own.filter((r) => r.kind === "assistant" && (r.stop_reason === "error" || r.stop_reason === "aborted")).length,
                inherited: { count: inherited.length, costUsd: sum(inherited) },
                unknownOrigin: { count: unknown.length, costUsd: sum(unknown) },
            },
            tokens: {
                input: own.reduce((t, r) => t + r.input_tokens, 0), output: own.reduce((t, r) => t + r.output_tokens, 0),
                cacheRead: own.reduce((t, r) => t + r.cache_read_tokens, 0), cacheWrite: own.reduce((t, r) => t + r.cache_write_tokens, 0),
            },
            // Only once this session has a charge outcome, so with the charge lookup off the view is unchanged.
            ...(charged ? { providerCharge: providerChargeView(db, seat, piSession) } : {}),
        };
    });
}
//# sourceMappingURL=usage-series.js.map