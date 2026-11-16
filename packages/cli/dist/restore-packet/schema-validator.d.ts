export interface ValidationError {
    field: string;
    value: string;
    rule: string;
    severity: "error" | "warning";
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}
export declare const RESTORE_SUMMARY_SCHEMA: Record<string, unknown>;
export declare function validateRestoreSummary(summary: unknown): ValidationResult;
//# sourceMappingURL=schema-validator.d.ts.map