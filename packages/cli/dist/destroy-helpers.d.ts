export declare const DESTROY_CONFIRM_TOKEN = "destroy-openrig-state";
export type DestroyScope = "state" | "all";
export interface DestroyRuntimeConfig {
    stateRoot: string;
    dbPath: string;
    transcriptsPath: string;
    daemonHost: string;
    daemonPort: number;
}
export interface DestroyTarget {
    path: string;
    kind: "state_root" | "db_file" | "db_shm" | "db_wal" | "transcripts_dir";
    backupPath?: string;
}
export interface DestroyPlan {
    scope: DestroyScope;
    backup: boolean;
    stateRoot: string;
    daemonHost: string;
    daemonPort: number;
    managedTmuxSessions: string[];
    targets: DestroyTarget[];
    warnings: string[];
}
export interface DestroyResult {
    scope: DestroyScope;
    backup: boolean;
    stateRoot: string;
    backupPaths: string[];
    daemonStopped: boolean;
    portCleared: boolean;
    stateRecreated: boolean;
    tmuxKilled: number;
    tmuxMissing: number;
    warnings: string[];
}
export interface ListenerInspection {
    kind: "openrig" | "other_http" | "unreachable";
    healthy?: boolean;
    detail?: string;
}
export interface DestroyDeps {
    stopDaemon: () => Promise<void>;
    inspectListener: (host: string, port: number) => Promise<ListenerInspection>;
    findListeningPid: (port: number) => number | null;
    killProcess: (pid: number) => void;
    exists: (path: string) => boolean;
    renamePath: (from: string, to: string) => void;
    removePath: (path: string) => void;
    mkdirp: (path: string) => void;
    listManagedTmuxSessions: (dbPath: string) => string[];
    killTmuxSession: (sessionName: string) => boolean;
    sleep: (ms: number) => Promise<void>;
    now: () => Date;
}
export declare function isWithinPath(candidate: string, root: string): boolean;
export declare function buildBackupPath(targetPath: string, exists: (path: string) => boolean, now?: Date): string;
export declare function listManagedTmuxSessionsFromDb(dbPath: string): string[];
export declare function buildDestroyPlan(scope: DestroyScope, backup: boolean, config: DestroyRuntimeConfig, deps: Pick<DestroyDeps, "exists" | "listManagedTmuxSessions" | "now">): DestroyPlan;
export declare function executeDestroy(plan: DestroyPlan, deps: DestroyDeps): Promise<DestroyResult>;
export declare function findListeningPidWithLsof(port: number): number | null;
export declare function killTmuxSessionWithCli(sessionName: string): boolean;
//# sourceMappingURL=destroy-helpers.d.ts.map