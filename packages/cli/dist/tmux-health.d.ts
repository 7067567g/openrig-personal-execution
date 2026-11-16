export interface TmuxProbeResult {
    installed: boolean;
    available: boolean;
    version: string | null;
    detail: string | null;
    code: "available" | "no_server" | "not_installed" | "unhealthy";
}
export declare function isTmuxNoServerMessage(message: string): boolean;
export declare function buildTmuxControlFailure(message: string): {
    message: string;
    reason: string;
    fix: string;
};
export declare function probeTmuxControl(exec: (cmd: string) => string): TmuxProbeResult;
export declare function probeTmuxControlAsync(exec: (cmd: string) => Promise<string>): Promise<TmuxProbeResult>;
//# sourceMappingURL=tmux-health.d.ts.map