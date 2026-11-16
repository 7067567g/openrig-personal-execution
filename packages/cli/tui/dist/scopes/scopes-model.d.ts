import type { ExplorerRow } from "../types.js";
import type { ContentLine } from "../detail.js";
export interface ScopeDropRef {
    file: string;
    artifactType: string | null;
    verdict: string | null;
    media: string[];
}
export interface ScopeContractItem {
    id?: string;
    source?: {
        file: string;
        line: number;
    };
    index: number;
    text: string;
    paired: boolean;
    drops: ScopeDropRef[];
}
export interface ScopeLocksSnap {
    spec: {
        by: string;
        at: string;
    } | null;
    delivery: {
        by: string;
        at: string;
    } | null;
}
export interface ReadinessSnap {
    configured: boolean;
    state: string;
    revision: string;
    issues?: string[];
    /** The authored judgment policy; null when none is readable. `configured` alone also covers a leftover judgments
     * directory or a failed policy read. Absent from an older daemon, which is read as no policy. */
    policy?: {
        judges: string[];
    } | null;
    history?: Array<{
        ref: string;
        id: string;
        verdict: string;
        previous: string | null;
    }>;
    items: Array<{
        id: string;
        index: number;
        text: string;
        state: string;
        reason: string;
        judgment: {
            id: string;
            actor?: string;
            at?: string;
            verdict?: string;
            previous?: string | null;
            subject?: {
                kind: string;
                ref: string;
                comparison?: string;
            };
            evidence?: Array<{
                ref: string;
                sha256: string;
            }>;
        } | null;
    }>;
}
export interface SliceScopeSnap {
    error?: string;
    sourcePath?: string;
    readiness?: ReadinessSnap;
    dirName: string;
    id: string | null;
    displayName: string;
    status: string | null;
    stage: string | null;
    locks: ScopeLocksSnap;
    proof: {
        paired: number;
        total: number;
    };
    intent: string;
    miniRequirements: string[];
    proofContract: ScopeContractItem[];
    narrative: string | null;
    specShaShort: string | null;
    prdExists: boolean;
}
export interface MissionScopesSnap {
    mission: string;
    slices: SliceScopeSnap[];
    error?: string;
}
/** Slice state glyph (mock: ● building/spec · ✓ delivery-locked · ⊙ other/idle). */
export declare function sliceGlyph(s: SliceScopeSnap): string;
/** The founder lock-glyph form: `proof: N/M 🔒` ONLY when delivery-locked — no del token,
 *  no unproven suffix; the visible COUNT carries the honesty (4/6 🔒 shows partial). */
export declare function proofBadge(s: SliceScopeSnap): string;
export declare function scopesExplorerRows(scopes: readonly MissionScopesSnap[] | undefined, expanded: ReadonlySet<string>, indent: string): ExplorerRow[];
/** Render the authoritative read model, including invalidated and corrected receipts.
 * Optional fields keep an older daemon's incomplete projection explicitly unknown. */
export declare function proofProvenanceLines(proof: ReadinessSnap | null | undefined, width: number): ContentLine[];
export interface ScopeContentOpts {
    collapseReqs: boolean;
    narrative: boolean;
    width: number;
    executionStrip?: ContentLine[];
}
/** Compact identity/status/provenance block shared by every route into the
 * canonical slice detail. Keeping it here prevents Explorer and mission-graph
 * navigation from growing separate slice pages again. */
export declare function scopeIdentityLines(detail: SliceScopeSnap, mission: string | null, width: number): ContentLine[];
/** The authored half of canonical slice detail. Exported so both Explorer and
 * mission-graph routes can use one operational page without copying the
 * Intent/Requirements/Proof contract renderer. Navigation chrome stays with
 * the owning page. */
export declare function scopeContractLines(detail: SliceScopeSnap, opts: Pick<ScopeContentOpts, "collapseReqs" | "narrative" | "width">): ContentLine[];
export declare function scopesContentLines(detail: SliceScopeSnap | null, mission: string | null, opts: ScopeContentOpts): ContentLine[];
//# sourceMappingURL=scopes-model.d.ts.map