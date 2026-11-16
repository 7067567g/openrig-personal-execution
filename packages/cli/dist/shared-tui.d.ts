interface SharedTuiClient {
    readonly baseUrl?: string;
    get<T>(path: string): Promise<{
        status: number;
        data: T;
    }>;
}
/** Resolve the terminal on the selected instance, not a remembered tmux name. */
export declare function sharedTuiTarget(client?: SharedTuiClient): Promise<string>;
export declare function attachSharedTui(target: string): Promise<number>;
export {};
//# sourceMappingURL=shared-tui.d.ts.map