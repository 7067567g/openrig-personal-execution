export interface CmuxTransport {
    request(method: string, params?: unknown): Promise<unknown>;
    close(): void;
}
export type CmuxTransportFactory = () => Promise<CmuxTransport>;
export interface CmuxStatus {
    available: boolean;
    capabilities: Record<string, boolean>;
}
export interface CmuxWorkspace {
    id: string;
    name: string;
}
export interface CmuxSurface {
    id: string;
    title: string;
    type: string;
}
export type CmuxResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    code: string;
    message: string;
};
interface CmuxAdapterOptions {
    timeoutMs: number;
}
export declare class CmuxAdapter {
    private factory;
    private options;
    private status;
    protected transport: CmuxTransport | null;
    constructor(factory: CmuxTransportFactory, options: CmuxAdapterOptions);
    connect(): Promise<void>;
    getStatus(): CmuxStatus;
    isAvailable(): boolean;
    listWorkspaces(): Promise<CmuxResult<CmuxWorkspace[]>>;
    listSurfaces(workspaceId?: string): Promise<CmuxResult<CmuxSurface[]>>;
    focusSurface(surfaceId: string, workspaceId?: string): Promise<CmuxResult<void>>;
    sendText(surfaceId: string, text: string, workspaceId?: string): Promise<CmuxResult<void>>;
    currentWorkspace(): Promise<CmuxResult<string>>;
    createTerminalSurface(workspaceId: string): Promise<CmuxResult<string>>;
    splitSurface(surfaceId: string, direction: "left" | "right" | "up" | "down", workspaceId?: string): Promise<CmuxResult<string>>;
    /**
     * `equalized` echoes cmux's own verdict: true = frames were rebalanced,
     * false = cmux made no change (nothing to equalize, or the workspace was
     * still settling). Callers MUST read it — a discarded false is exactly the
     * silent 2:1:1 grid the VM diagnostic caught.
     */
    equalizeSplits(workspaceId?: string): Promise<CmuxResult<{
        equalized: boolean;
    }>>;
    createWorkspace(name: string, cwd?: string): Promise<CmuxResult<string>>;
    closeWorkspace(workspaceId: string): Promise<CmuxResult<void>>;
    listPaneSurfaces(paneId: string, workspaceId?: string): Promise<CmuxResult<CmuxSurface[]>>;
    /** Query cmux for agent PIDs (sidebar metadata). Returns Map<pid, { runtime, pid }>. */
    queryAgentPIDs(): Promise<CmuxResult<Map<number, {
        runtime: string;
        pid: number;
    }>>>;
}
export {};
//# sourceMappingURL=cmux.d.ts.map