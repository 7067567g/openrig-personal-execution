export type ResumeType = "claude_id" | "codex_id" | "pi_session_file" | "omp_session_file" | "opencode_session" | "dsh_session";
export interface ResumeTokenValidationOk {
    ok: true;
    resumeType: ResumeType;
    /** The trimmed token to persist. Internal value — never logged/echoed. */
    token: string;
}
export interface ResumeTokenValidationErr {
    ok: false;
    /** Describes the FORMAT problem; NEVER contains the token value. */
    error: string;
}
/** Resume-id type for a runtime, or null when the runtime has no resume token
 *  (terminal / unknown). */
export declare function resumeTypeForRuntime(runtime: string | null): ResumeType | null;
export declare function validateResumeToken(runtime: string | null, rawToken: unknown): ResumeTokenValidationOk | ResumeTokenValidationErr;
//# sourceMappingURL=resume-token-validation.d.ts.map