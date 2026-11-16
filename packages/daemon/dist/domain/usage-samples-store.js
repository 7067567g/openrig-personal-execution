/** Whether migration 105's cost columns exist (a database built from 062 alone has none). */
export function hasClientCostColumns(db) {
    try {
        const cols = db.prepare("PRAGMA table_info(usage_samples)").all();
        return cols.some((c) => c.name === "client_cost_estimate_usd") && cols.some((c) => c.name === "native_session_id");
    }
    catch {
        return false;
    }
}
export class UsageSamplesStore {
    db;
    costColumns = null;
    constructor(db) {
        this.db = db;
    }
    withCost() {
        this.costColumns ??= hasClientCostColumns(this.db);
        return this.costColumns;
    }
    /** Append the context-lane sample IFF it advanced past the seat's latest row. */
    appendContextSample(s, capturedAt) {
        const cost = this.withCost();
        const nativeSessionId = s.nativeSessionId ?? null;
        const estimate = s.clientCostEstimateUsd ?? null;
        const last = this.db
            .prepare(`SELECT sampled_at, total_input_tokens, total_output_tokens, used_percentage${cost ? ", native_session_id, client_cost_estimate_usd" : ""}
         FROM usage_samples
         WHERE lane = 'context' AND seat_session = ? AND node_id = ?
         ORDER BY id DESC LIMIT 1`)
            .get(s.seatSession, s.nodeId);
        if (last &&
            last.sampled_at === s.sampledAt &&
            last.total_input_tokens === s.totalInputTokens &&
            last.total_output_tokens === s.totalOutputTokens &&
            last.used_percentage === s.usedPercentage &&
            (!cost || ((last.native_session_id ?? null) === nativeSessionId && (last.client_cost_estimate_usd ?? null) === estimate))) {
            return false;
        }
        this.db
            .prepare(`INSERT INTO usage_samples
           (lane, seat_session, node_id, source, sampled_at, captured_at,
            total_input_tokens, total_output_tokens, used_percentage${cost ? ", native_session_id, client_cost_estimate_usd" : ""})
         VALUES ('context', ?, ?, ?, ?, ?, ?, ?, ?${cost ? ", ?, ?" : ""})`)
            .run(s.seatSession, s.nodeId, s.source, s.sampledAt, capturedAt, s.totalInputTokens, s.totalOutputTokens, s.usedPercentage, ...(cost ? [nativeSessionId, estimate] : []));
        return true;
    }
    /** Append the provider-window sample IFF it advanced past the seat's latest row for that window. */
    appendProviderWindowSample(s, capturedAt) {
        const last = this.db
            .prepare(`SELECT sampled_at, window_used_percent, resets_at
         FROM usage_samples
         WHERE lane = 'provider_window' AND seat_session = ? AND window = ?
         ORDER BY id DESC LIMIT 1`)
            .get(s.seatSession, s.window);
        if (last &&
            last.sampled_at === s.asOf &&
            last.window_used_percent === s.usedPercent &&
            last.resets_at === s.resetsAt) {
            return false;
        }
        this.db
            .prepare(`INSERT INTO usage_samples
           (lane, seat_session, source, sampled_at, captured_at,
            window, window_used_percent, resets_at)
         VALUES ('provider_window', ?, 'claude_statusline_json', ?, ?, ?, ?, ?)`)
            .run(s.seatSession, s.asOf, capturedAt, s.window, s.usedPercent, s.resetsAt);
        return true;
    }
}
/** Map the read model's statusline signals to window-sample inputs. Only the two
 *  normalized subscription windows ride the series; rows without a seat identity
 *  or an asOf stamp are skipped (nothing is fabricated — the Option-A bar). */
export function providerWindowSamplesFromSignals(signals) {
    const out = [];
    for (const sig of signals) {
        if (!sig.seatSession || !sig.asOf)
            continue;
        // SignalWindow admits provider-native strings; only the two normalized
        // windows ride the series (an explicit re-literal narrows the open union).
        const window = sig.window === "five_hour" ? "five_hour" : sig.window === "weekly" ? "weekly" : null;
        if (!window)
            continue;
        out.push({
            seatSession: sig.seatSession,
            window,
            usedPercent: typeof sig.usedPercent === "number" ? sig.usedPercent : null,
            resetsAt: sig.resetsAt ?? null,
            asOf: sig.asOf,
        });
    }
    return out;
}
//# sourceMappingURL=usage-samples-store.js.map