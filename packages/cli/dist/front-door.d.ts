interface FrontDoorPermissionDiagnostic {
    transport: {
        state: "healthy" | "connect" | "timeout" | "response";
        detail?: string;
    };
    cwdRead: {
        state: "visible" | "denied" | "unknown";
    };
    commandPath: {
        state: "available" | "missing" | "unknown";
    };
    enforcement: {
        axis: "permission" | "sandbox" | "resource_trust" | "not_applicable";
        state: "aligned" | "drift" | "unknown";
        expected: string | null;
        effective: string | {
            defaultMode: string;
        } | null;
        sourcePath: string | null;
        reason?: string;
    };
    observedAt: string;
}
export type FrontDoorProbeResult = {
    state: "ready";
} | {
    state: "diagnostic";
    diagnostic: FrontDoorPermissionDiagnostic;
};
type LegacyTransportProbeResult = {
    state: "connect" | "timeout" | "response";
    message: string;
};
interface FrontDoorProbeClient {
    get(path: string, options?: {
        timeoutMs?: number;
    }): Promise<{
        status: number;
        data: unknown;
    }>;
}
/** Monorepo-first, bundled-fallback TUI entry resolution — the exact
 * resolveDaemonPath pattern (see daemon-lifecycle.ts): a dev checkout's
 * `packages/tui/dist` is the source of truth; an npm-install layout ships
 * the bundled copy next to the cli. Null = not found (caller degrades). */
export declare function resolveTuiPath(baseDir: string, exists?: (p: string) => boolean): string | null;
export declare const USAGE_LINES: string[];
export interface FrontDoorIo {
    stdinIsTTY?: boolean;
    stdoutIsTTY?: boolean;
    out?: (line: string) => void;
    err?: (line: string) => void;
    exit?: (code: number) => void;
    /** Typed daemon/current-seat probe (legacy booleans remain accepted for injected callers). */
    probeDaemon?: () => Promise<boolean | FrontDoorProbeResult | LegacyTransportProbeResult>;
    /** launch the TUI and resolve with its exit code */
    launchTui?: () => Promise<number>;
}
/**
 * Managed seats request the strict current-seat diagnostic. Unmanaged shells
 * keep the cheap health-only path. Transport classes remain distinct.
 */
export declare function probeFrontDoor(input?: {
    client?: FrontDoorProbeClient;
    env?: NodeJS.ProcessEnv;
}): Promise<FrontDoorProbeResult>;
/**
 * The OWNED mission-control path, factored out so `rig tui` is a true ALIAS (not a
 * mirror) of what bare `rig` does: probe the daemon, then either launch the TUI and
 * exit with its code, or print the friendly first-impression degrade. Shared by
 * runFrontDoor (bare `rig`) and the `tui` subcommand — one launch path, no duplication.
 */
export declare function openMissionControl(io?: FrontDoorIo): Promise<void>;
/**
 * Returns true when the front door OWNED the invocation (TUI launched or a
 * degrade message printed + exit requested); false to fall through to the
 * normal commander program (args present, or a non-TTY stream).
 */
export declare function runFrontDoor(argv: readonly string[], io?: FrontDoorIo): Promise<boolean>;
export {};
//# sourceMappingURL=front-door.d.ts.map