import { Command } from "commander";
import type { StatusDeps } from "./status.js";
import { type WindowDeps } from "../terminal-window.js";
export interface TerminalDeps extends StatusDeps {
    windowDeps?: WindowDeps;
}
/** The one shared open-result shape (mirrors the daemon `OpenViewResult`). */
export interface OpenViewResult {
    provider: string;
    ok: boolean;
    opened: string[];
    absent: {
        seat: string;
        host: string | null;
        reason: string;
    }[];
    degraded: {
        seat: string;
        host: string;
        reason: string;
    }[];
    pages: number;
    error?: string;
    code?: string;
    notes?: string[];
    window?: {
        app: string;
        surface: string;
    };
    reusedWorkspace?: {
        id: string;
        tabId: string;
        view: string;
    };
    /** On window failures, false means no desktop launch was attempted. */
    windowAttempted?: boolean;
}
export declare function terminalCommand(depsOverride?: TerminalDeps): Command;
//# sourceMappingURL=terminal.d.ts.map