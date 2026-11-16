import type { FileWriteService } from "../files/file-write-service.js";
import type { AllowlistRoot } from "../files/path-safety.js";
import type { ComposedSliceReview } from "./types.js";
/** The frozen single-file HTML for a composed slice review — the ONE
 *  INTENT → PLAN → DELIVERED stack (CORRECTIVE §3.1), mirrored statically. */
export declare function renderFrozenSliceHtml(composed: ComposedSliceReview, sliceDir: string, mediaRefs: string[]): string;
export declare function frozenFileName(scopeId: string | null, fallbackName: string, approvedAtIso: string | null): string;
export type FreezeOutcome = {
    ok: true;
    path: string;
    alreadyFrozen: boolean;
} | {
    ok: false;
    error: "stamp_missing" | "not_found" | "allowlist_missing" | "write_failed";
    message: string;
    hint?: string;
};
/** Maps an absolute dir into (allowlist root, relative path) or null. */
export declare function resolveAllowlisted(allowlist: AllowlistRoot[], absDir: string): {
    root: string;
    rel: string;
} | null;
export declare function freezeSliceExport(opts: {
    composed: ComposedSliceReview;
    sliceDir: string;
    mediaRefs: string[];
    allowlist: AllowlistRoot[];
    writeService: FileWriteService;
    actor: string;
    /** P21 §4 era-stamp for the freeze audit row: `transport:v1` (transport-derived) or null
     *  (the UI named-deferral / claimed-era path). Threaded to the createAtomic audit. */
    identityProvenance?: string | null;
}): FreezeOutcome;
//# sourceMappingURL=freeze.d.ts.map