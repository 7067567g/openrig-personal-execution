export declare const QUEUED_PLACEHOLDER: string;
/** The same composer region used by the startup Enter guard. No transcript fallback. */
export declare function composerRegion(pane: string | null, runtime?: string | null): {
    body: string | null;
    markerLine: number | null;
    closingRuleLine: number | null;
    capturedLines: number;
};
/** An echoed turn or a partial/opaque composer stays unverified. */
export declare function inspectStartupStagedText(pane: string | null, expected: string, runtime?: string | null): "staged" | "clear" | "unverified";
export declare const COLLAPSED_PASTE: RegExp;
/** Whether the composer holds only Claude's collapsed label for a paste with the expected text's newline count. */
export declare function startupOwnCollapsedPaste(pane: string | null, expected: string, runtime?: string | null): boolean;
export interface StartupSubmissionEvidence {
    normalization: "whitespace-stripped-utf8";
    expected: {
        bytes: number;
        sha256: string;
    };
    observed: {
        bytes: number;
        sha256: string;
    } | null;
    /** One-based positions in this capture, not absolute terminal rows. */
    markerLine: number | null;
    closingRuleLine: number | null;
    capturedLines: number;
    captureScrollbackLines: number;
    /** Zero-based UTF-8 byte offset; null when equal or no valid region exists. */
    firstDifferenceByte: number | null;
    /** Diagnostic only; absent for unavailable captures or an excluded selector. */
    reason?: "unrecognized_composer_boundary" | "extracted_text_mismatch";
    windowsOmitted: "unclassified-startup-text";
}
export interface StartupSubmissionDiagnostic {
    startupAttemptId: string;
    /** One-based order among this orchestrator's interactive sends. */
    sendOrder: number;
    source: "initial_identity" | "restore_preload" | "post_launch_file" | "challenge" | "startup_proof_instruction" | "after_files" | "after_ready";
    /** Zero-based index in the authored action list, when applicable. */
    actionIndex?: number;
    /** `look` is set only when our collapsed paste was looked at again: 0 for the first look, n for the last. */
    observations: Array<StartupSubmissionEvidence & {
        phase: "initial" | "guarded_retry" | "after_retry";
        look?: number;
    }>;
    /** Transport result only; ok does not assert model consumption. */
    retry: "not_run" | "ok" | "refused_or_failed" | "threw";
}
/** No excerpts: every startup source accepts arbitrary, potentially credential-bearing text.
 * Fixed-size metadata per capture (at most three per send), never a pane/prompt dump.
 * Diagnostics must not turn a delivery decision into a failure. */
export declare function startupSubmissionEvidence(pane: string | null, expected: string, captureScrollbackLines: number, runtime?: string | null): StartupSubmissionEvidence | undefined;
//# sourceMappingURL=startup-submission-evidence.d.ts.map