// Slice-04 (OPR.0.5.0.4) seam C3 — the Claude statusline provider_usage cache LANE.
// A statusline sidecar writes a per-seat provider_usage cache with an atomic tmp+rename (so a
// concurrent daemon read never sees a torn file); the daemon reads it here and normalizes it into
// provider_statusline signal rows via the existing claudeStatuslineSignals. Absent cache
// (pre-first-response) and empty/malformed readings each become an EXPLICIT
// unknown row with an unknownReason — never a missing row and never a fabricated zero. Never throws.
//
// SCOPE: this atom is the cache producer/reader + collectSignals wiring ONLY. It does not touch the
// C4 reactive tap, C2 Codex app-server, activity-accurate precheck, D switch execution, or BR-1.
import fs from "node:fs";
import nodePath from "node:path";
import { claudeStatuslineSignals } from "./provider-signals.js";
import { telemetrySidecarFilename } from "../telemetry-state-paths.js";
/**
 * Atomic write: serialize to a tmp sibling, then rename over the target. rename(2) is atomic on the
 * same filesystem, so a concurrent reader sees EITHER the old file OR the fully-written new one —
 * never a half-written (torn) read. The sidecar uses this so the daemon never parses a partial cache.
 */
export function writeProviderUsageCacheAtomic(fs, path, cache) {
    const tmp = `${path}.tmp-${cache.asOf.replace(/[^0-9]/g, "")}`;
    fs.writeFile(tmp, JSON.stringify(cache));
    fs.rename(tmp, path);
}
/**
 * Read each Claude seat's provider_usage cache → provider_statusline rows via
 * claudeStatuslineSignals. Explicit unknown rows for absent cache (no_statusline_cache_yet) and
 * cache-present-but-no/-malformed windows (empty_reading).
 * Never throws — a malformed cache is treated as present-with-no-windows, not a crash.
 */
export function collectClaudeStatuslineSignals(deps) {
    const now = deps.now();
    const out = [];
    for (const seat of deps.listClaudeSeats()) {
        let cachePresent = false;
        let reading;
        let staleAfter;
        let capturedAsOf;
        const raw = deps.readCacheRaw(seat.seatSession);
        if (raw !== null) {
            cachePresent = true;
            try {
                const parsed = JSON.parse(raw);
                if (parsed.seatSession === seat.seatSession && parsed.accountKind === "subscription") {
                    reading = validRateLimits(parsed.rateLimits);
                }
                staleAfter = parsed.staleAfter;
                capturedAsOf = typeof parsed.asOf === "string" ? parsed.asOf : undefined;
            }
            catch {
                // Malformed cache → present-with-no-windows (empty_reading unknown), never a throw.
                reading = undefined;
            }
        }
        out.push(...claudeStatuslineSignals({
            seatSession: seat.seatSession,
            cachePresent,
            reading,
            // Signal asOf = when the reading was captured (the cache's asOf) when present+valid; else now.
            asOf: cachePresent && capturedAsOf ? capturedAsOf : now,
            staleAfter,
        }));
    }
    return out;
}
/** Read the seat-keyed cache directory using the same path consumed by daemon startup. */
export function collectClaudeSignalsFromProviderUsageDirectory(directory, now = () => new Date().toISOString(), legacyDirectory) {
    const seats = new Map();
    for (const candidateDirectory of [directory, legacyDirectory]) {
        if (!candidateDirectory)
            continue;
        try {
            for (const file of fs.readdirSync(candidateDirectory)) {
                if (!file.endsWith(".json"))
                    continue;
                try {
                    const parsed = JSON.parse(fs.readFileSync(nodePath.join(candidateDirectory, file), "utf-8"));
                    if (typeof parsed.seatSession === "string") {
                        seats.set(parsed.seatSession, { seatSession: parsed.seatSession });
                    }
                }
                catch { /* malformed cache cannot create a usable cache signal */ }
            }
        }
        catch { /* absent cache directory */ }
    }
    const readFrom = (candidateDirectory, seatSession) => {
        try {
            return fs.readFileSync(nodePath.join(candidateDirectory, telemetrySidecarFilename(seatSession)), "utf-8");
        }
        catch (error) {
            return error.code === "ENOENT" ? null : "";
        }
    };
    return collectClaudeStatuslineSignals({
        listClaudeSeats: () => [...seats.values()],
        readCacheRaw: (seatSession) => {
            const canonical = readFrom(directory, seatSession);
            if (canonical !== null)
                return canonical;
            return legacyDirectory ? readFrom(legacyDirectory, seatSession) : null;
        },
        now,
    });
}
function validRateLimits(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const source = value;
    const reading = {};
    for (const key of ["five_hour", "seven_day"]) {
        const raw = source[key];
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
            continue;
        const window = raw;
        if (typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent)
            && typeof window.resetsAt === "string") {
            reading[key] = { usedPercent: window.usedPercent, resetsAt: window.resetsAt };
        }
    }
    return reading.five_hour || reading.seven_day ? reading : undefined;
}
//# sourceMappingURL=claude-usage-reader.js.map