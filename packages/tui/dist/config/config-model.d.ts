import { type ContentLine } from "../detail.js";
import type { FleetSnapshot, ViewState } from "../types.js";
export interface ConfigEntry {
    key: string;
    group: "general" | "slack" | "people" | "hosts" | "health";
    value: string | number | boolean | null;
    defaultValue: string | number | boolean | null;
    defaultKnown?: boolean;
    subject?: string;
    source: string;
    visibility: "shown" | "withheld" | "unavailable";
    reason: string | null;
    scope: string;
    application: string;
}
export interface ConfigRead {
    observedAt: string;
    home: string | null;
    readOnly: boolean;
    sources: Array<{
        id: string;
        state: string;
        path: string | null;
        detail: string;
    }>;
    entries: ConfigEntry[];
    exclusions: string[];
}
export declare const CONFIG_CATEGORIES: readonly [{
    readonly id: "instance";
    readonly label: "Instance & work";
}, {
    readonly id: "context";
    readonly label: "Context & skills";
}, {
    readonly id: "display";
    readonly label: "Display & terminals";
}, {
    readonly id: "waiting";
    readonly label: "Workflows & waiting";
}, {
    readonly id: "recovery";
    readonly label: "Recovery & snapshots";
}, {
    readonly id: "activity";
    readonly label: "Activity & retention";
}, {
    readonly id: "agents";
    readonly label: "Agents & runtime";
}, {
    readonly id: "slack";
    readonly label: "Slack & people";
}, {
    readonly id: "all";
    readonly label: "All settings / search";
}, {
    readonly id: "sources";
    readonly label: "Sources & coverage";
}];
export declare function configCategory(entry: ConfigEntry): string;
export declare function configLabel(entry: ConfigEntry): string;
export declare function configEntries(read: ConfigRead | null, category: string, query?: string): ConfigEntry[];
export declare function configValue(entry: ConfigEntry, defaultValue?: boolean): string;
export declare function configListLines(entries: ConfigEntry[], width: number, selectedKey?: string): ContentLine[];
export declare function configDetailLines(read: ConfigRead | null, key: string, width: number): ContentLine[];
export declare function configSourceLines(read: ConfigRead | null, width: number): ContentLine[];
/** Settings use the normal explorer, content targets, wrapping and history. */
export declare function configLines(state: ViewState, snap: FleetSnapshot, width: number): ContentLine[];
//# sourceMappingURL=config-model.d.ts.map