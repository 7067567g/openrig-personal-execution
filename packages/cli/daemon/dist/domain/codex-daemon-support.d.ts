export type CodexDaemonSupport = {
    kind: "supported";
} | {
    kind: "legacy";
} | {
    kind: "unknown";
    detail: string;
};
/** Detects support for the Codex a seat in `cwd` would run. */
export type CodexDaemonSupportDetector = (cwd: string) => Promise<CodexDaemonSupport>;
/** Classifies one `codex --help` run; `runHelp` resolves with its output or rejects. */
export declare function probeCodexDaemonSupport(runHelp: () => Promise<string>): Promise<CodexDaemonSupport>;
/** The production detector: runs `codex --help` asynchronously, so the daemon keeps serving. */
export declare function codexDaemonSupportProbe(launchPath?: string, timeoutMs?: number, codexHome?: string): CodexDaemonSupportDetector;
export declare function unknownDaemonSupportMessage(detail: string): string;
//# sourceMappingURL=codex-daemon-support.d.ts.map