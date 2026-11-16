import type { MissionControlActionLog } from "../mission-control/mission-control-action-log.js";
export type ScopeTier = "slice" | "mission";
export type ApprovalScope = "spec" | "delivery";
export interface ScopeApproveInput {
    scopeTier: ScopeTier;
    /** Canonical missions-root-relative path (e.g.
     *  "release-0.4.4/slices/19-living-notes-signal-layer" or "release-0.4.4"). */
    scopePath: string;
    /** STAGED APPROVAL (founder un-deferred): `spec` = "the SPEC matches my
     *  intent" (the first accept-point); `delivery` = the terminal sign-off
     *  (the freeze trigger). Omitted upstream ⇒ delivery (back-compat). */
    approvalScope: ApprovalScope;
    /** The REAL invoking session (honest provenance — never overwritten by
     *  delegation). */
    actorSession: string;
    /** P21 era-stamp: how actorSession was established. The route passes `transport:v1` when it derived
     *  the actor from the authenticated transport chokepoint; omitted (null) ⇒ claimed-era (a direct
     *  caller / pre-P21 row), rendered "recorded (pre-verification era)", never re-labeled. */
    identityProvenance?: string | null;
    /** DELEGATED APPROVAL: whose decision this stamp records when an agent
     *  invokes on the founder's behalf. Recorded in the audit notes only. */
    onBehalfOf?: string | null;
    /** OPR.0.5.0.18 — AMEND/RE-STAMP: re-approve an already-approved scope as a
     *  new reasoned attestation superseding the prior (both preserved in the
     *  append-only audit log; ARCH-SHAPING 9d64ceb6 v2). Atomic: same
     *  frontmatter-first → audit-second → byte-restore ordering; no unapprove
     *  window ever exists. */
    reApprove?: boolean;
    /** REQUIRED with reApprove (a reasoned deliberate act, never an accident). */
    reason?: string | null;
    /** The missions root the CALLER named (`rig scope --workspace`), absolute and
     *  already resolved client-side. When given it is the tree this approval
     *  stamps, so a second worktree of the same repo is stamped where the caller
     *  asked instead of in the daemon's own workspace (#995). Omitted (the TUI,
     *  MCP and pre-#995 clients) ⇒ the daemon's own root, as before. */
    missionsRoot?: string | null;
    /** PLAN-LOCK ONLY — the stamper's EXPLICIT locked-artifact set (slice-relative paths). When
     *  present it REPLACES the derived default entirely: the set is chosen, not inherited. Each path
     *  must exist in the slice directory. Ignored for delivery/mission approvals. */
    lockedArtifacts?: string[] | null;
}
export interface ScopeApproveResult {
    scopeTier: ScopeTier;
    scopeId: string;
    scopePath: string;
    approvalScope: ApprovalScope;
    approvedBy: string;
    approvedAt: string;
    onBehalfOf: string | null;
    actionId: string;
    /** Packet-2 interface cell: only the DELIVERY stamp fires the freeze; the
     *  compose-and-freeze endpoint ships in Packet 2, so P1 always reports
     *  false. The stamp + audit row stand regardless of any render outcome. */
    freezeFired: false;
    /** OPR.0.5.0.18 — true when this result is an amendment (a re-stamp). */
    reApproved: boolean;
    /** The superseded attestation (present only on a re-stamp). */
    priorApprovedBy?: string;
    priorApprovedAt?: string | null;
}
export declare class ScopeApproveError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
/** The pinned audit_notes_json shape (spec-guard blocker 2): a stable,
 *  queryable scope-target identity + the approval scope + delegation
 *  provenance. The audit-browse read path filters on these keys — the pair
 *  is what makes Packet 2's one-query UNVERIFIED-stamp cross-check real. */
export interface ScopeApprovalAuditNotes extends Record<string, unknown> {
    kind: "scope-approval";
    scope_tier: ScopeTier;
    scope_id: string;
    scope_path: string;
    /** The missions root this stamp was written under: the caller's named root
     *  when the request carried one, else the daemon's own (#995). scope_path is
     *  relative to it, so the pair names the file that was stamped. */
    missions_root: string;
    approval_scope: ApprovalScope;
    on_behalf_of: string | null;
}
interface ScopeApproveDeps {
    /** Resolves the live missions root (SliceIndexer.slicesRoot), or null when
     *  the workspace is not configured. */
    missionsRoot: () => string | null;
    actionLog: MissionControlActionLog;
    now?: () => Date;
}
export declare class ScopeApproveService {
    private readonly deps;
    constructor(deps: ScopeApproveDeps);
    /**
     * The missions root this approval writes under: the caller's named root when
     * the request carried one, else the daemon's own (#995).
     *
     * A named root is accepted only as an absolute path to an existing
     * directory, and is canonicalized, so a worktree reached through a symlink
     * names the same root as its target. Every later check — path containment,
     * the node file and its frontmatter id, the no-half-stamp ordering — then
     * applies to that tree unchanged.
     */
    private resolveMissionsRoot;
    approve(input: ScopeApproveInput): ScopeApproveResult;
}
export {};
//# sourceMappingURL=scope-approve.d.ts.map