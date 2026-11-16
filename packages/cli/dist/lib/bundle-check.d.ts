interface Check {
    ruleId: string;
    status: "pass" | "finding" | "not_checked";
    reason: string;
    path?: string;
}
/** Advisory filesystem reads only. No daemon, bundler, preflight, provider or launch. */
export declare function checkBundleFolder(folder: string): Promise<{
    standardVersion: string;
    checks: Check[];
}>;
export {};
//# sourceMappingURL=bundle-check.d.ts.map