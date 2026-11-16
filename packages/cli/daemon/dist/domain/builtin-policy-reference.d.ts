export declare const BUILTIN_POLICY_NAMES: readonly ["locked", "standard", "open", "yolo", "auto"];
export interface MaterializeBuiltinPolicyReferenceDeps {
    /** the packaged source dir (…/policies/builtin next to the daemon dist) */
    bundledDir: string;
    /** the stable target dir ($OPENRIG_HOME/reference/policies/builtin) */
    targetDir: string;
}
export interface MaterializeBuiltinPolicyReferenceResult {
    written: string[];
    skipped: string[];
}
export declare function materializeBuiltinPolicyReference(deps: MaterializeBuiltinPolicyReferenceDeps): MaterializeBuiltinPolicyReferenceResult;
//# sourceMappingURL=builtin-policy-reference.d.ts.map