import type { StructuredTranscript, SourceRuntime } from "./types.js";
export interface WritePacketOptions {
    /** Absolute path of the target packet directory. MUST NOT exist. */
    targetDir: string;
    /** Parsed source structured representation. */
    structured: StructuredTranscript;
    /** Runtime kind of the source seat. */
    sourceRuntime: SourceRuntime;
    /** Target rig name (operator-supplied). */
    targetRig: string;
    /** Target runtime kind (operator-supplied). */
    targetRuntime: SourceRuntime;
    /** Target workspace root (absolute path). */
    targetWorkspaceRoot: string;
    /** Default target repo (absolute path or null). */
    defaultTargetRepo: string | null;
    /** Path/URI to role guidance for the restored seat. */
    rolePointer: string;
    /** One-paragraph human-readable summary of current work. */
    currentWorkSummary: string;
    /** Who the restored seat hands off to next; "self" if continuing. */
    nextOwner: string;
    /** Caveats list (cross-runtime quirks, redaction notes, etc.). */
    caveats: string[];
    /** Explicit statement of restored-seat authority. */
    authorityBoundaries: string;
    /** Ordered source-trust ranking (subset of contract enum). */
    sourceTrustRanking: string[];
    /** Source session id. */
    sourceSessionId: string;
    /**
     * Source rig name. Per M2c-CLI R2: passed explicitly by the CLI adapter
     * (computed from parsed session_meta `<seat>@<rig>` split or operator
     * --source-rig-override). The writer does NOT derive this from
     * sourceSessionId — that hidden derivation was the M2c-CLI R1 bug.
     */
    sourceRig: string;
    /** Source cwd (absolute path). */
    sourceCwd: string;
    /** Generator version identifier (e.g., "rig-restore-packet@0.1.0"). */
    generatorVersion: string;
    /** Whether to include the full transcript.md file. */
    includeFullTranscript: boolean;
}
export interface WritePacketResult {
    targetDir: string;
    files: string[];
    summaryPath: string;
}
/**
 * Write a v0 restore packet directory atomically.
 *
 * Atomic guarantee: if any step fails (including schema validation of
 * restore-summary.json), the targetDir is never created and any
 * intermediate tempdir is removed. Operators see either a complete
 * valid packet at targetDir, or no packet at all.
 */
export declare function writePacket(opts: WritePacketOptions): Promise<WritePacketResult>;
//# sourceMappingURL=packet-writer.d.ts.map