/** The optional digest field carried beside `evidence_ref`. */
export declare const EVIDENCE_DIGEST_KEY = "evidence_digest";
/** The durable artifact pointer this gate verifies. */
export declare const EVIDENCE_REF_KEY = "evidence_ref";
export type EvidenceRejectionCode = "evidence_ref_invalid" | "evidence_ref_missing" | "evidence_ref_unreadable" | "evidence_ref_not_file" | "evidence_digest_invalid" | "evidence_digest_without_ref" | "evidence_digest_mismatch";
export type EvidenceCheckResult = 
/** No `evidence_ref`/`evidence_digest` was declared: legacy path, no gate. */
{
    status: "absent";
}
/** The file exists and the optional digest (if any) matched. */
 | {
    status: "verified";
    ref: string;
    path: string;
    sha256: string;
    declaredDigest: string | null;
}
/** The declaration is present but not a verifiable, current artifact. */
 | {
    status: "rejected";
    code: EvidenceRejectionCode;
    message: string;
    details: Record<string, unknown>;
};
/**
 * Normalize an optional digest. `undefined`/`null` = not declared.
 * A `sha256:` prefix and upper-case hex are accepted; the stored value is
 * lower-case bare hex so the trail has one canonical spelling.
 */
export declare function normalizeEvidenceDigest(value: unknown): string | null | undefined;
/**
 * Verify the file declaration carried by `closureEvidence`.
 *
 * Throw-free: the projector maps `rejected` to its structured error class so
 * the HTTP route can keep one error-mapping home.
 */
export declare function verifyClosureEvidenceFile(input: {
    closureEvidence?: Record<string, unknown> | null;
    /** Directory a relative `evidence_ref` resolves against (the spec's dir). */
    baseDir: string;
}): EvidenceCheckResult;
//# sourceMappingURL=workflow-evidence.d.ts.map