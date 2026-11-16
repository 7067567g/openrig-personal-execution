interface LaunchChoice {
    nonInterruptive?: boolean;
    launchPosture?: "floor" | "full_bypass" | "auto";
    permissionMode?: string;
}
/** Per-launch overrides only. This choice never changes permissions or native settings files.
 * Claude Code 2.1.282 and Codex 0.153.4 expose these settings on their CLI surfaces.
 */
export declare function nonInterruptiveArgs(runtime: string, choice: LaunchChoice): string[];
export declare function nonInterruptiveArg(runtime: string, choice: LaunchChoice): string;
export declare function nonInterruptiveNotice(runtime: string, choice: LaunchChoice): string | undefined;
export declare function nonInterruptiveSummary(enabled: boolean): string;
export {};
//# sourceMappingURL=non-interruptive.d.ts.map