export declare const CMUX_SETTINGS_DISCLOSURE_PATH = "~/.config/cmux/settings.json";
export declare const CMUX_DEFAULT_SOCKET_CONTROL_MODE = "cmuxOnly";
export interface CmuxSettingsReadResult {
    mode: string;
    source: "settings" | "default";
    error?: string;
}
export declare function resolveCmuxSettingsPath(homeDir?: string): string;
export declare function isCmuxSocketControlCompatible(mode: string | null): boolean;
export declare function readCmuxSocketControlModeFromText(text: string | null): CmuxSettingsReadResult;
export declare function upsertCmuxSocketControlMode(text: string | null, mode: string): {
    content: string;
    changed: boolean;
};
//# sourceMappingURL=cmux-config.d.ts.map