import { BUILT_IN_RUNTIMES, isAgentAppRuntime } from "./built-in-runtimes.js";
export { BUILT_IN_RUNTIMES, isAgentAppRuntime };
export declare const AGENT_APP_PRESET_FORMAT = 1;
export interface AgentAppPreset {
    name: string;
    command: string;
    maintainer: string;
    limits: string[];
    path: string;
}
export type AgentAppPresetLookup = {
    ok: true;
    preset: AgentAppPreset;
} | {
    ok: false;
    kind: "missing" | "incompatible";
    path: string;
    message: string;
};
export declare function agentAppsDir(): string;
/** The installed preset for a community agent app, or why there isn't a usable one. */
export declare function loadAgentAppPreset(name: string, dir?: string): AgentAppPresetLookup;
/** Every preset file in the directory, usable or not, sorted by name. */
export declare function listAgentAppPresets(dir?: string): AgentAppPresetLookup[];
/** What a seat on a community agent app shows about it. */
export interface AgentAppLabel {
    app: string;
    community: true;
    testedByOpenRig: false;
    maintainer: string | null;
    limits: string[];
    identity: "not confirmed";
    needsInput: "from the screen only: no app prompt pattern";
    /** Set when the preset is missing or can't be used. */
    presetError?: string;
}
export declare function agentAppLabel(runtime: string, dir?: string): AgentAppLabel;
//# sourceMappingURL=agent-app-presets.d.ts.map