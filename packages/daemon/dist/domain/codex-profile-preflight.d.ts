export interface CodexProfileProbeResult {
    ok: boolean;
    profile: string;
    error?: string;
    migrationHint?: string;
}
export declare function verifyCodexProfileLoads(profile: string, exec: (cmd: string) => Promise<string>, timeoutMs?: number, codexHome?: string): Promise<CodexProfileProbeResult>;
//# sourceMappingURL=codex-profile-preflight.d.ts.map