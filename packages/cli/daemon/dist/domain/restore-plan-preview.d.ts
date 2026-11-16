import type Database from "better-sqlite3";
import type { RigWithRelations, Snapshot } from "./types.js";
/** OPR.0.4.3.20 FR-6 — a present token whose last verification is older than this
 *  is surfaced as `stale` (age-based staleness — the "stale while running" signal
 *  that needs no probe). DELIVERY DEFAULT; pm confirms the exact value. */
export declare const RESUME_FRESHNESS_THRESHOLD_MS: number;
/** OPR.0.4.3.20 FR-6 — per-seat token truth in the restore plan. */
export type ResumeTokenState = "present" | "missing" | "stale" | "unverified";
export interface RestorePlanPreviewNode {
    logicalId: string;
    /** Consent version, not a guessed native conversation id. */
    occupantSessionId?: string | null;
    hasHistory?: boolean;
    /** The slice-02 vocabulary, as a forecast: what apply mode WOULD do. */
    intendedAction: "resume-original" | "fresh-primed" | "awaiting-decision";
    reason?: string;
    /** present = verified + fresh; missing = no token; stale = probe failed OR
     *  last-verified past the freshness threshold; unverified = present but never
     *  verified. A stale/unverified token is NEVER a silent restore failure —
     *  the operator sees it here and can re-verify before restore. */
    tokenState: ResumeTokenState;
    /** The token's source: adoption / hook / operator / scrape (null when none). */
    provenance?: string | null;
    /** When the token was last confirmed current (SQLite UTC ts; null = never). */
    lastVerified?: string | null;
    /** True when the seat has no resumable token → restore would require an
     *  explicit `--fresh` (surfaced here; never presented as a silent fresh-prime). */
    freshRequired: boolean;
    /** A runtime prompt the operator should expect at restore (Claude session
     *  picker, Codex auth/update) — a forecast, not an incidental surprise. */
    runtimePrompt?: string;
}
export interface RestorePlanPreview {
    status: "plan";
    mode: "restore";
    rigId: string;
    rigName: string;
    /** The snapshot apply mode would restore from (null when it would capture
     *  a current-state auto-rehydrate snapshot instead). */
    snapshot: {
        id: string;
        kind: string;
        createdAt: string;
    } | null;
    /** True when apply mode would first CAPTURE an auto-rehydrate snapshot —
     *  reported, not performed (plan mode performs zero writes). */
    wouldCaptureCurrentState: boolean;
    nodes: RestorePlanPreviewNode[];
    /** Always false — the contract this preview exists to keep. */
    mutated: false;
}
export interface PreviewSessionRow {
    nodeId: string;
    restorePolicy: string | null;
    resumeType: string | null;
    resumeToken: string | null;
    resumeProvenance?: string | null;
    resumeLastVerified?: string | null;
    resumeLastProbeStatus?: string | null;
    /** Row id (ULID). Selection is by the shared ACTIVE-OCCUPANT resolution
     *  (active-occupant.ts) — the same truth the restore execution consumes —
     *  never by newest-id inference. */
    id: string;
    /** Session status — the occupant ladder's legacy/uniquely-running input and
     *  the live would-capture derivation's input. */
    status: string | null;
}
/** Gather the session rows the preview forecasts from — the snapshot's
 *  captured sessions when one exists, otherwise the live rows an
 *  auto-rehydrate capture WOULD snapshot (read-only SELECT; the capture
 *  itself is a mutation and is never performed here). */
export declare function collectPreviewSessionRows(db: Database.Database, rig: RigWithRelations, snapshot: Snapshot | null): PreviewSessionRow[];
/**
 * Forecast per-seat restore actions from current inventory and saved occupancy.
 * Report token state and guidance without launching or changing any sessions.
 */
export declare function buildRestorePlanPreview(rig: RigWithRelations, snapshot: Snapshot | null, sessionRows: PreviewSessionRow[], freshLogicalIds?: string[], nowMs?: number, recorded?: Record<string, string | null>): RestorePlanPreview;
//# sourceMappingURL=restore-plan-preview.d.ts.map