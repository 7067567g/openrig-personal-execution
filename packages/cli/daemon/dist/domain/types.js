/** Only a confirmed missing session proves the seat is no longer running.
 * Callers must first gate the verdict to the current session and binding. */
export function identityVerdictConfirmsSessionMissing(verdict) {
    return verdict?.reason === "session_missing";
}
/**
 * OPR.0.4.3.19 — the two verdict kinds that down-rank a `running`/`active`
 * projection to a non-green state. `verified`, `tmux_unavailable`, and an
 * ABSENT verdict all leave the projection unchanged (fail-open on unknown).
 */
export function identityVerdictDownranksRunning(verdict) {
    return verdict === "mismatch" || verdict === "pane_missing";
}
/**
 * PL-007 Workspace Primitive — typed workspace kinds enum. Reserved set
 * at v0; adding a sixth kind is a v1+ amendment per the PL-007 product
 * spec. Each kind has folder shape + frontmatter contract + ownership
 * rules (see `frontmatter-validator.ts` for the per-kind required-field
 * map).
 */
export const WORKSPACE_KINDS = ["user", "project", "knowledge", "lab", "delivery"];
//# sourceMappingURL=types.js.map