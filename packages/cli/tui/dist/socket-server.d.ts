import type { ViewState, ViewStateStore } from "./types.js";
/** macOS sun_path caps unix-socket paths at ~104 bytes; guard with margin. */
export declare const MAX_SOCKET_PATH_BYTES = 100;
export declare function describeState(state: ViewState): {
    screen: string;
    drill: string[];
    filter: string | undefined;
    viewTab: import("./types.js").ViewTab;
    timeZone: string;
    timeZoneWarning: string | null;
    timeZoneHelp: boolean;
    recentEvent: import("./types.js").RecentTransitionSnap | undefined;
    address: {
        path: string;
        slice?: string | undefined;
        mission?: string | undefined;
        spec?: string | undefined;
        agent?: string | undefined;
        pod?: string | undefined;
        rig?: string | undefined;
        host?: string | undefined;
        instance: string;
        section: string;
    };
    copyMode: boolean;
    error: string | undefined;
    resolving?: string | undefined;
    notice?: string | undefined;
    ok: boolean;
};
/** Default socket home follows the shipped OPENRIG_HOME convention
 * (openrig-compat: ~/.openrig), herdr-style env override on top. */
export declare function defaultSocketPath(instanceId: string): string;
export interface ControlSocket {
    path: string;
    close(): Promise<void>;
}
interface ControlSocketOptions {
    socketPath: string;
    view: ViewStateStore;
    onMutation?: () => void;
    /** I5 — live command context supplier (from the C3 detector); default standard. */
    currentContext?: () => string;
    /** Standalone terminals can use an independent endpoint on a collision. */
    fallbackOnCollision?: boolean;
}
export declare function createControlSocket(options: ControlSocketOptions): Promise<ControlSocket>;
export {};
//# sourceMappingURL=socket-server.d.ts.map