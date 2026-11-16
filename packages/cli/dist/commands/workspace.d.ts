import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface WorkspaceDeps extends StatusDeps {
}
export declare function parseMaxFilesStrict(raw: string): number;
export declare function workspaceCommand(depsOverride?: WorkspaceDeps): Command;
interface DoctorCheckResult {
    check: string;
    status: "ok" | "warn" | "fail";
    message: string;
    fixHint?: string;
    evidence?: Record<string, unknown>;
}
interface DoctorReport {
    workspaceRoot: string;
    checks: DoctorCheckResult[];
    summary: {
        ok: number;
        warn: number;
        fail: number;
    };
    daemonResolvedAt: string;
}
export declare function renderHumanDoctorReport(report: DoctorReport): void;
export {};
//# sourceMappingURL=workspace.d.ts.map