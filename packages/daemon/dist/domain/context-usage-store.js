import Database from "better-sqlite3";
import { join } from "node:path";
import os from "node:os";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, unlinkSync } from "node:fs";
import { resolveCodexDbPaths } from "./codex-thread-id.js";
import { parseSqliteUtcMs } from "./sqlite-time.js";
import { contextUsageDirectory, legacyContextUsageDirectory, telemetrySidecarPath, } from "./telemetry-state-paths.js";
import { parseCliAgentUsageSidecar, } from "../adapters/cli-agent/cli-agent-usage.js";
import { cliAgentUsagePath } from "../adapters/cli-agent/cli-agent-runner-protocol.js";
/** Freshness threshold: samples older than this are considered stale for compact displays. */
export const FRESHNESS_THRESHOLD_MS = 600_000; // 10 minutes per PM spec
export class ContextUsageStore {
    db;
    stateDir;
    codexHomeDir;
    codexHome;
    resolveOccupantBootAt;
    constructor(db, opts) {
        this.db = db;
        this.stateDir = opts.stateDir;
        this.codexHomeDir = opts.codexHomeDir ?? safeHomeDir();
        this.codexHome = opts.codexHome;
        this.resolveOccupantBootAt = opts.resolveOccupantBootAt;
    }
    /**
     * GHOST-STAGE (c-id): is this reading from a generation PRIOR to the node's live occupant?
     * A reading sampled strictly before the current occupant booted belongs to a retired tenure
     * (the frozen-88% specimen in the mixed-gen window after handover, where the name is reused so
     * session_mismatch cannot catch it). Returns false when boot time is UNKNOWN or the reading has
     * no sampled_at — the gate is inert (note-2: never treat unknown as stale), leaving
     * session_mismatch + freshness as the remaining guards. boot_at is SQLite datetime('now') (UTC,
     * no zone marker), so it is parsed as UTC; a bare Date.parse would read it as local time.
     */
    isPriorGenerationReading(nodeId, sampledAt) {
        if (!sampledAt)
            return false;
        const bootAt = this.resolveOccupantBootAt?.(nodeId) ?? null;
        if (!bootAt)
            return false;
        const sampled = Date.parse(sampledAt);
        const boot = parseSqliteUtcMs(bootAt);
        if (Number.isNaN(sampled) || Number.isNaN(boot))
            return false;
        return sampled < boot;
    }
    /** Get the sidecar file path for a session. */
    getSidecarPath(sessionName) {
        return telemetrySidecarPath(contextUsageDirectory(this.stateDir), sessionName);
    }
    /**
     * GHOST-STAGE (e) Class-A 2a: remove a retiring occupant's name-keyed context sidecar so a
     * same-name successor does not read the predecessor's frozen telemetry sample (the "gen-1 88%
     * resurfaced as a live threshold flag" specimen). Safe by TIMING — the cutover seam
     * (OccupantInvalidator) calls this inside SeatHandoverService.commit(), BEFORE the successor
     * writes its own sidecar. Missing file = no-op; best-effort (a leftover is caught downstream by
     * the freshness gate). NOTE: this is the DISK sidecar (name-keyed); the context_usage DB table is
     * node_id-keyed + already session_mismatch-gated, so it needs no invalidation here.
     */
    invalidateOccupantSidecar(sessionName) {
        const filePath = this.getSidecarPath(sessionName);
        try {
            if (existsSync(filePath))
                unlinkSync(filePath);
        }
        catch {
            /* best-effort — a stale leftover is still gated by isFresh downstream */
        }
    }
    /** Read and parse a sidecar JSON file. Returns discriminated result. */
    readSidecar(sessionName) {
        const canonical = this.readSidecarAt(this.getSidecarPath(sessionName));
        if (canonical.ok || canonical.reason !== "missing_sidecar")
            return canonical;
        return this.readSidecarAt(telemetrySidecarPath(legacyContextUsageDirectory(this.stateDir), sessionName));
    }
    readSidecarAt(filePath) {
        try {
            if (!existsSync(filePath))
                return { ok: false, reason: "missing_sidecar" };
            const content = readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(content);
            return { ok: true, data: parsed };
        }
        catch {
            return { ok: false, reason: "parse_error" };
        }
    }
    /** Read sidecar and normalize into ContextUsage in one step. */
    readAndNormalize(sessionName) {
        const result = this.readSidecar(sessionName);
        if (!result.ok)
            return this.unknownUsage(result.reason);
        return this.normalizeSample(result.data);
    }
    /** Read the latest Codex token_count event for a thread and normalize it. */
    readCodexAndNormalize(input) {
        const threadId = input.threadId?.trim();
        if (!threadId)
            return this.unknownUsage("no_data");
        const thread = this.readCodexThread(threadId);
        if (!thread?.rollout_path)
            return this.unknownUsage("no_data");
        const tokenEvent = this.readLatestCodexTokenCount(thread.rollout_path);
        if (!tokenEvent)
            return this.unknownUsage("no_data");
        return this.normalizeCodexTokenCount({
            event: tokenEvent,
            sessionName: input.sessionName,
            threadId,
            transcriptPath: thread.rollout_path,
        });
    }
    /** Resolve an explicitly selected native thread, even before its first token count. */
    readCodexTranscriptPath(threadId) {
        return this.readCodexThread(threadId)?.rollout_path ?? null;
    }
    /**
     * Read the OpenCode/DSH runner's per-seat `usage.json` sidecar and normalize it.
     *
     * The runner owns the fold (streaming tokens/cost → monotonic totals); this
     * read surface only maps the snapshot onto `ContextUsage`. `stateDir` is
     * OPENRIG_HOME, so the sidecar lives at
     * `OPENRIG_HOME/state/<runtime>/<sanitized-session>/usage.json`.
     *
     * Missing file → `missing_sidecar`; unparseable/incompatible sidecar →
     * `parse_error`. Neither is treated as a zero sample.
     */
    readCliAgentAndNormalize(input) {
        const stateRoot = join(this.stateDir, "state", input.runtime);
        const filePath = cliAgentUsagePath(stateRoot, input.sessionName);
        let raw;
        try {
            if (!existsSync(filePath))
                return this.unknownUsage("missing_sidecar");
            raw = readFileSync(filePath, "utf-8");
        }
        catch {
            return this.unknownUsage("parse_error");
        }
        const sidecar = parseCliAgentUsageSidecar(raw);
        if (!sidecar || sidecar.runtime !== input.runtime)
            return this.unknownUsage("parse_error");
        return this.normalizeCliAgentUsage(sidecar);
    }
    /** Map a validated runner usage sidecar to the shared context-usage shape. */
    normalizeCliAgentUsage(sidecar) {
        const { totals, lastStep, steps } = sidecar;
        return {
            availability: "known",
            reason: null,
            source: sidecar.runtime === "opencode" ? "opencode_runner_json" : "dsh_runner_json",
            // The runners report tokens and cost, not a context-window measurement.
            usedPercentage: null,
            remainingPercentage: null,
            contextWindowSize: null,
            totalInputTokens: totals.input + totals.cacheRead,
            totalOutputTokens: totals.output + totals.reasoning,
            currentUsage: this.normalizeCurrentUsage({ steps, totals, lastStep }),
            transcriptPath: null,
            sessionId: sidecar.sessionId ?? null,
            sessionName: sidecar.sessionName,
            sampledAt: sidecar.sampledAt,
            fresh: this.isFresh(sidecar.sampledAt),
            clientCostEstimateUsd: totals.costUsd,
        };
    }
    /** Normalize raw sidecar data into a ContextUsage record. */
    normalizeSample(raw) {
        if (!raw) {
            return this.unknownUsage("missing_sidecar");
        }
        const cw = raw.context_window;
        if (!cw || typeof cw.used_percentage !== "number") {
            return this.unknownUsage("parse_error");
        }
        const sampledAt = raw.sampled_at ?? null;
        const fresh = sampledAt ? this.isFresh(sampledAt) : false;
        return {
            availability: "known",
            reason: null,
            source: "claude_statusline_json",
            usedPercentage: cw.used_percentage ?? null,
            remainingPercentage: cw.remaining_percentage ?? null,
            contextWindowSize: cw.context_window_size ?? null,
            totalInputTokens: cw.total_input_tokens ?? null,
            totalOutputTokens: cw.total_output_tokens ?? null,
            currentUsage: this.normalizeCurrentUsage(cw.current_usage),
            transcriptPath: raw.transcript_path ?? null,
            sessionId: raw.session_id ?? null,
            sessionName: raw.session_name ?? null,
            sampledAt,
            fresh,
            clientCostEstimateUsd: typeof raw.cost?.total_cost_usd === "number" && Number.isFinite(raw.cost.total_cost_usd) ? raw.cost.total_cost_usd : null,
        };
    }
    /** Normalize a Codex token_count JSONL event into ContextUsage. */
    normalizeCodexTokenCount(input) {
        const info = input.event.payload?.info;
        const usage = info?.last_token_usage;
        const contextWindowSize = info?.model_context_window;
        if (!usage || typeof contextWindowSize !== "number" || contextWindowSize <= 0) {
            return this.unknownUsage("parse_error");
        }
        const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : null;
        const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : null;
        const totalTokens = typeof usage.total_tokens === "number"
            ? usage.total_tokens
            : (inputTokens ?? 0) + (outputTokens ?? 0);
        const usedPercentage = clampPercentage(Math.round((totalTokens / contextWindowSize) * 100));
        const remainingPercentage = clampPercentage(100 - usedPercentage);
        const sampledAt = input.event.timestamp ?? null;
        return {
            availability: "known",
            reason: null,
            source: "codex_token_count_jsonl",
            usedPercentage,
            remainingPercentage,
            contextWindowSize,
            totalInputTokens: inputTokens,
            totalOutputTokens: outputTokens,
            currentUsage: this.normalizeCurrentUsage({
                last_token_usage: usage,
                model_context_window: contextWindowSize,
            }),
            transcriptPath: input.transcriptPath,
            sessionId: input.threadId,
            sessionName: input.sessionName,
            sampledAt,
            fresh: sampledAt ? this.isFresh(sampledAt) : false,
        };
    }
    /** Persist a context usage record for a node. Upserts. */
    persist(nodeId, usage) {
        this.db.prepare(`
      INSERT INTO context_usage (
        node_id, session_id, session_name, availability, reason, source,
        used_percentage, remaining_percentage, context_window_size,
        total_input_tokens, total_output_tokens, current_usage,
        transcript_path, sampled_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(node_id) DO UPDATE SET
        session_id = excluded.session_id,
        session_name = excluded.session_name,
        availability = excluded.availability,
        reason = excluded.reason,
        source = excluded.source,
        used_percentage = excluded.used_percentage,
        remaining_percentage = excluded.remaining_percentage,
        context_window_size = excluded.context_window_size,
        total_input_tokens = excluded.total_input_tokens,
        total_output_tokens = excluded.total_output_tokens,
        current_usage = excluded.current_usage,
        transcript_path = excluded.transcript_path,
        sampled_at = excluded.sampled_at,
        updated_at = datetime('now')
    `).run(nodeId, usage.sessionId, usage.sessionName, usage.availability, usage.reason, usage.source, usage.usedPercentage, usage.remainingPercentage, usage.contextWindowSize, usage.totalInputTokens, usage.totalOutputTokens, usage.currentUsage, usage.transcriptPath, usage.sampledAt);
    }
    /** Get context usage for a single node. Session-aware: mismatched session returns unknown. */
    getForNode(nodeId, currentSessionName) {
        if (!currentSessionName)
            return this.unknownUsage("not_managed");
        const row = this.db.prepare("SELECT * FROM context_usage WHERE node_id = ?").get(nodeId);
        if (!row)
            return this.unknownUsage("no_data");
        // Session mismatch guard: prevent stale cross-session inheritance
        if (row.session_name && row.session_name !== currentSessionName) {
            return this.unknownUsage("session_mismatch");
        }
        // GHOST-STAGE (c-id): generation guard. Under handover the name is REUSED, so session_mismatch
        // passes while the table still holds the retiree's pre-boot reading (the mixed-gen window).
        // Reject readings from before the live occupant booted → insufficient-data, evaluate current-gen only.
        if (this.isPriorGenerationReading(nodeId, row.sampled_at)) {
            return this.unknownUsage("stale_generation");
        }
        return this.rowToUsage(row);
    }
    /** Batch get context usage for multiple nodes. Session-aware per entry. */
    getForNodes(entries) {
        const result = new Map();
        if (entries.length === 0)
            return result;
        const nodeIds = entries.map((e) => e.nodeId);
        const sessionMap = new Map(entries.map((e) => [e.nodeId, e.currentSessionName]));
        const rows = this.db.prepare(`SELECT * FROM context_usage WHERE node_id IN (${nodeIds.map(() => "?").join(",")})`).all(...nodeIds);
        const rowMap = new Map(rows.map((r) => [r.node_id, r]));
        for (const entry of entries) {
            if (!entry.currentSessionName) {
                result.set(entry.nodeId, this.unknownUsage("not_managed"));
                continue;
            }
            const row = rowMap.get(entry.nodeId);
            if (!row) {
                result.set(entry.nodeId, this.unknownUsage("no_data"));
                continue;
            }
            if (row.session_name && row.session_name !== entry.currentSessionName) {
                result.set(entry.nodeId, this.unknownUsage("session_mismatch"));
                continue;
            }
            // GHOST-STAGE (c-id): generation guard — see getForNode. Reject pre-boot (prior-gen) readings.
            if (this.isPriorGenerationReading(entry.nodeId, row.sampled_at)) {
                result.set(entry.nodeId, this.unknownUsage("stale_generation"));
                continue;
            }
            result.set(entry.nodeId, this.rowToUsage(row));
        }
        return result;
    }
    /** Create an unknown ContextUsage with an honest reason. */
    unknownUsage(reason) {
        return {
            availability: "unknown",
            reason,
            source: null,
            usedPercentage: null,
            remainingPercentage: null,
            contextWindowSize: null,
            totalInputTokens: null,
            totalOutputTokens: null,
            currentUsage: null,
            transcriptPath: null,
            sessionId: null,
            sessionName: null,
            sampledAt: null,
            fresh: false,
        };
    }
    /** Check if a sample timestamp is fresh. */
    isFresh(sampledAt) {
        try {
            const age = Date.now() - new Date(sampledAt).getTime();
            return age >= 0 && age < FRESHNESS_THRESHOLD_MS;
        }
        catch {
            return false;
        }
    }
    /** Convert a DB row to a ContextUsage, applying freshness. */
    rowToUsage(row) {
        const fresh = row.sampled_at ? this.isFresh(row.sampled_at) : false;
        return {
            availability: row.availability,
            reason: row.reason,
            source: row.source,
            usedPercentage: row.used_percentage,
            remainingPercentage: row.remaining_percentage,
            contextWindowSize: row.context_window_size,
            totalInputTokens: row.total_input_tokens,
            totalOutputTokens: row.total_output_tokens,
            currentUsage: row.current_usage,
            transcriptPath: row.transcript_path,
            sessionId: row.session_id,
            sessionName: row.session_name,
            sampledAt: row.sampled_at,
            fresh,
        };
    }
    normalizeCurrentUsage(value) {
        if (value == null)
            return null;
        if (typeof value === "string")
            return value;
        try {
            return JSON.stringify(value);
        }
        catch {
            return String(value);
        }
    }
    readCodexThread(threadId) {
        for (const dbPath of this.resolveCodexStateDbPaths()) {
            try {
                const codexDb = new Database(dbPath, { readonly: true });
                try {
                    const row = codexDb.prepare("SELECT id, rollout_path FROM threads WHERE id = ? LIMIT 1").get(threadId);
                    if (row?.rollout_path)
                        return row;
                }
                finally {
                    codexDb.close();
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    resolveCodexStateDbPaths() {
        return this.codexHome || this.codexHomeDir ? resolveCodexDbPaths(this.codexHomeDir ?? "", "state", undefined, this.codexHome) : [];
    }
    readLatestCodexTokenCount(rolloutPath) {
        let content;
        try {
            content = this.readTail(rolloutPath, 4_000_000);
        }
        catch {
            return null;
        }
        const lines = content.trimEnd().split("\n").reverse();
        for (const line of lines) {
            if (!line.includes("\"token_count\""))
                continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.payload?.type === "token_count") {
                    // Native Codex also writes quota-only updates under token_count.
                    // They carry no context measurement and must not replace its timestamp.
                    if (parsed.payload.info == null && parsed.payload.rate_limits != null)
                        continue;
                    return parsed;
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    readTail(filePath, maxBytes) {
        const stat = statSync(filePath);
        const start = Math.max(0, stat.size - maxBytes);
        const length = stat.size - start;
        const fd = openSync(filePath, "r");
        try {
            const buffer = Buffer.alloc(length);
            readSync(fd, buffer, 0, length, start);
            return buffer.toString("utf-8");
        }
        finally {
            closeSync(fd);
        }
    }
}
function clampPercentage(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(100, Math.max(0, value));
}
function safeHomeDir() {
    try {
        return os.homedir();
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=context-usage-store.js.map