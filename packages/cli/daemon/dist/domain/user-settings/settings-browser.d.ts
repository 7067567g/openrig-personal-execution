import { type SettingsStore } from "./settings-store.js";
type Value = string | number | boolean | null;
type State = "available" | "missing" | "malformed" | "unavailable";
export interface BrowserEntry {
    key: string;
    group: "general" | "slack" | "people" | "hosts" | "health";
    value: Value;
    defaultValue: Value;
    defaultKnown: boolean;
    subject?: string;
    source: "env" | "file" | "default" | "unreported" | "unavailable";
    visibility: "shown" | "withheld" | "unavailable";
    reason: string | null;
    scope: string;
    application: string;
}
interface BrowserSource {
    id: string;
    state: State;
    path: string | null;
    detail: string;
}
/** Additive safe view of existing owners. No mutation, host probe, provider call or repair. */
export declare function settingsBrowser(store: SettingsStore, gateway?: Record<string, unknown> | null, home?: string): {
    observedAt: string;
    home: string | null;
    sources: BrowserSource[];
    entries: BrowserEntry[];
    exclusions: string[];
    readOnly: boolean;
};
export {};
//# sourceMappingURL=settings-browser.d.ts.map