import { DaemonClient } from "./daemon-client.js";
import { type CrashCartRenderOpts } from "./crash-cart/from-emit.js";
import { type LocalReadingState, type LocalRequest, type LocalResult } from "./local-reading.js";
import type { Action } from "./types.js";
export interface StartupSeat {
    logicalId: string;
    nodeId: string;
    runtime: string;
    model: string | null;
    revision: string;
    hasHistory: boolean;
    intendedAction: string;
    reason?: string;
    freshRequired: boolean;
    tokenState: string;
    freshAllowed?: boolean;
    prerequisite?: string;
    contextPending?: boolean;
    observed: {
        state: string;
        detail: string;
        sessionName: string;
    };
}
interface StartupRig {
    rigId: string;
    rigName: string;
    seats: StartupSeat[];
}
export interface StartupState {
    connection: "probing" | "up" | "down" | "unverified";
    local?: LocalReadingState;
    open: boolean;
    busy: boolean;
    page: "probe" | "down" | "unavailable" | "rigs" | "seats" | "kernel" | "confirm";
    target: string;
    home: string;
    notice: string;
    detail: string;
    expanded: boolean;
    selected: number;
    scroll: number;
    rigs: Array<{
        id: string;
        name: string;
    }>;
    rig?: StartupRig;
    probe?: CrashCartRenderOpts;
    freshBlocked?: string;
    prerequisites?: {
        codex: string;
        claudeCode: string;
    };
    consent?: {
        rigId: string;
        seat: StartupSeat;
    };
}
export interface StartupDeps {
    client: DaemonClient;
    home: string;
    probe: () => Promise<string>;
    startDaemon: () => Promise<void>;
    onChange: () => void;
    onHelp?: () => void;
    readLocal?: (request: LocalRequest) => Promise<LocalResult>;
    onNative?: (seat: StartupSeat) => Promise<void>;
    onWork: (rig?: Pick<StartupRig, "rigId" | "rigName">, seat?: StartupSeat) => void;
}
export declare class StartupController {
    private readonly deps;
    readonly state: StartupState;
    private local?;
    private automaticEntry;
    /** Any user input, including Help and a control-socket command, owns navigation. */
    interacted(): void;
    constructor(deps: StartupDeps);
    private changed;
    private run;
    open(): Promise<void>;
    refresh(): Promise<void>;
    private readRig;
    key(key: string): Promise<void>;
    private launch;
}
export declare function startupLines(s: StartupState): Array<{
    text: string;
    action?: Action;
}>;
export {};
//# sourceMappingURL=startup.d.ts.map