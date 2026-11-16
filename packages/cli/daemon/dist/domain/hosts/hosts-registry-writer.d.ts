import { type HostEntry } from "./hosts-registry-reader.js";
export type AddHostResult = {
    ok: true;
    path: string;
    entry: HostEntry;
} | {
    ok: false;
    error: string;
};
export declare function addHostEntry(rawEntry: Record<string, unknown>, path?: string): AddHostResult;
//# sourceMappingURL=hosts-registry-writer.d.ts.map