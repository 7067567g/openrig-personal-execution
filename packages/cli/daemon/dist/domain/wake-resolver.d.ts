/**
 * L3b — resolve a seat[@generation] to a resume token for a wake, on the stores
 * that exist TODAY (ruling A): the `sessions` rows for the seat's session_name,
 * newest-first. No dedicated tenure ledger exists yet (that is the pooled
 * boot-capture atom); until it lands, "which tenures exist" = the sessions rows,
 * and a wake target that cannot be resolved REFUSES with a teaching listing —
 * raw tokens accepted, guessed tokens never.
 */
export interface WakeSessionRow {
    id: number;
    sessionName: string;
    resumeToken: string | null;
    runtime: string | null;
    createdAt: string;
}
export interface WakeResolveInput {
    seat: string;
    /** 1 = newest tenure (default), 2 = next-older, … */
    generation?: number;
}
export interface KnownTenure {
    generation: number;
    sessionId: number;
    tokenPresent: boolean;
    createdAt: string;
}
export type WakeResolution = {
    resolved: true;
    token: string;
    runtime: "claude" | "codex";
    sessionId: number;
} | {
    resolved: false;
    reason: string;
    known: KnownTenure[];
};
/**
 * @param rows sessions for the seat's session_name, NEWEST-FIRST (id DESC).
 */
export declare function resolveWakeTarget(rows: WakeSessionRow[], input: WakeResolveInput): WakeResolution;
//# sourceMappingURL=wake-resolver.d.ts.map