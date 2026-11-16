import type { TerminalOpenResult } from "../daemon-client.js";
export declare function terminalWindowNotice(view: string, result: TerminalOpenResult): string;
/** Reuse the installed CLI's desktop selection and fallback, preserving this TUI's daemon. */
export declare function openTerminalInWindow(view: string, endpoint: string, cliEntry?: string, expectedPlan?: string, onUnavailable?: () => void): Promise<TerminalOpenResult>;
//# sourceMappingURL=open-window.d.ts.map