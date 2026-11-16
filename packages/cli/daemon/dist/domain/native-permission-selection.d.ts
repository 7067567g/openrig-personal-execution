/** Native permission choices are future-launch settings, not work posture. */
export interface NativePermissionSelection {
    runtime: "codex" | "claude-code";
    mode: string;
}
/** Missing managed-launch wiring must never fall back to daemon-local help. */
export declare function unresolvedClaudePermissionModes(): Promise<string[] | null>;
export declare function validateNativePermissionSelection(runtime: string, mode: string, supportedClaudeModes?: readonly string[] | null): NativePermissionSelection;
export declare function permissionBindingOverride(selection: NativePermissionSelection | null): {
    launchPosture?: "floor" | "full_bypass";
    permissionMode?: string;
};
//# sourceMappingURL=native-permission-selection.d.ts.map