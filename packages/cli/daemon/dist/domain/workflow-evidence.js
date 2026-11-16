// Closure evidence file gate — the schema-free half of the evidence gate.
//
// A workflow step closes with `closureEvidence.evidence_ref` pointing at the
// artifact the owner produced. Historically the daemon checked only that the
// field was a non-empty string; a packet could advance while the named file
// never existed, and nothing noticed if the file changed after closure.
//
// This module is deliberately small and pure: resolve the pointer, require a
// regular file, and (optionally) compare its sha256. It owns no table, no
// migration and no configuration key. `WorkflowProjector.project()` calls it
// BEFORE any queue/trail/frontier write, so a rejection leaves state untouched.
//
// Resolution contract: absolute refs are used as-is; a relative ref resolves
// against the directory of the workflow spec that declared the step. For a
// lifecycle-compiled workflow that directory is the mission root, because the
// runtime caches the generated spec under `mission.yaml`.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
/** The optional digest field carried beside `evidence_ref`. */
export const EVIDENCE_DIGEST_KEY = "evidence_digest";
/** The durable artifact pointer this gate verifies. */
export const EVIDENCE_REF_KEY = "evidence_ref";
const SHA256_HEX = /^[0-9a-f]{64}$/i;
/**
 * Normalize an optional digest. `undefined`/`null` = not declared.
 * A `sha256:` prefix and upper-case hex are accepted; the stored value is
 * lower-case bare hex so the trail has one canonical spelling.
 */
export function normalizeEvidenceDigest(value) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    const bare = trimmed.toLowerCase().startsWith("sha256:") ? trimmed.slice("sha256:".length).trim() : trimmed;
    return SHA256_HEX.test(bare) ? bare.toLowerCase() : null;
}
/**
 * Verify the file declaration carried by `closureEvidence`.
 *
 * Throw-free: the projector maps `rejected` to its structured error class so
 * the HTTP route can keep one error-mapping home.
 */
export function verifyClosureEvidenceFile(input) {
    const evidence = input.closureEvidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence))
        return { status: "absent" };
    const rawRef = evidence[EVIDENCE_REF_KEY];
    const rawDigest = evidence[EVIDENCE_DIGEST_KEY];
    if (rawRef === undefined && rawDigest === undefined)
        return { status: "absent" };
    const baseDir = resolve(input.baseDir);
    if (rawRef === undefined || rawRef === null || (typeof rawRef === "string" && rawRef.trim() === "")) {
        if (rawDigest !== undefined && rawDigest !== null) {
            return {
                status: "rejected",
                code: "evidence_digest_without_ref",
                message: "closureEvidence.evidence_digest was supplied without an evidence_ref; a digest needs a file to describe.",
                details: { baseDir },
            };
        }
        return { status: "absent" };
    }
    if (typeof rawRef !== "string") {
        return {
            status: "rejected",
            code: "evidence_ref_invalid",
            message: `closureEvidence.evidence_ref must be a file path string, got ${rawRef === null ? "null" : typeof rawRef}.`,
            details: { baseDir, evidenceRef: rawRef },
        };
    }
    const ref = rawRef.trim();
    const digest = normalizeEvidenceDigest(rawDigest);
    if (rawDigest !== undefined && digest === null) {
        return {
            status: "rejected",
            code: "evidence_digest_invalid",
            message: "closureEvidence.evidence_digest must be a sha256 hex digest (64 hex characters, optionally prefixed with \"sha256:\").",
            details: { baseDir, evidenceRef: ref, evidenceDigest: rawDigest },
        };
    }
    const path = isAbsolute(ref) ? ref : resolve(baseDir, ref);
    let stat;
    try {
        stat = statSync(path);
    }
    catch (err) {
        const cause = err.code ?? "unknown";
        return {
            status: "rejected",
            code: "evidence_ref_missing",
            message: `closureEvidence.evidence_ref "${ref}" resolves to "${path}", which does not exist (cause: ${cause}). Produce the artifact before advancing or completing the step, or correct the reference.`,
            details: { baseDir, evidenceRef: ref, resolvedPath: path, cause },
        };
    }
    if (!stat.isFile()) {
        return {
            status: "rejected",
            code: "evidence_ref_not_file",
            message: `closureEvidence.evidence_ref "${ref}" resolves to "${path}", which exists but is not a regular file. Point at the artifact itself, not a directory or device.`,
            details: { baseDir, evidenceRef: ref, resolvedPath: path },
        };
    }
    let bytes;
    try {
        bytes = readFileSync(path);
    }
    catch (err) {
        const cause = err.code ?? "unknown";
        return {
            status: "rejected",
            code: "evidence_ref_unreadable",
            message: `closureEvidence.evidence_ref "${ref}" resolves to "${path}" but the daemon could not read it (cause: ${cause}). Fix the file permissions or point at a readable artifact.`,
            details: { baseDir, evidenceRef: ref, resolvedPath: path, cause },
        };
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (digest !== undefined && digest !== sha256) {
        return {
            status: "rejected",
            code: "evidence_digest_mismatch",
            message: `closureEvidence.evidence_ref "${ref}" no longer matches its declared digest: the file at "${path}" has sha256 ${sha256}, but closureEvidence.evidence_digest is ${digest}. The artifact changed after the digest was taken; re-verify and declare the current digest.`,
            details: { baseDir, evidenceRef: ref, resolvedPath: path, expectedDigest: digest, actualDigest: sha256 },
        };
    }
    return { status: "verified", ref, path, sha256, declaredDigest: digest ?? null };
}
//# sourceMappingURL=workflow-evidence.js.map