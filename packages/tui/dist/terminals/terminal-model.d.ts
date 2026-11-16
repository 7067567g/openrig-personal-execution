import type { DaemonClient } from "../daemon-client.js";
import type { ExplorerRow, FleetSnapshot, ViewState } from "../types.js";
import { type ContentLine } from "../detail.js";
export interface TerminalEntry {
    view: string;
    name: string;
    kind: "saved" | "derived";
    members: string[];
    readinessUnverified?: boolean;
    ready: number;
    absent: number;
    degraded: number;
    pages: number;
}
export interface TerminalPreview {
    view: string;
    provider: string;
    planId: string;
    status: {
        available: boolean;
    };
    composed: {
        id: string;
        pages: Array<Array<{
            seat: string;
            label: string;
            readOnly: boolean;
            paneCommand: string;
        }>>;
        opened: Array<{
            seat: string;
        }>;
        absent: Array<{
            seat: string;
            reason: string;
        }>;
        degraded: Array<{
            seat: string;
            reason: string;
        }>;
    };
    grids: Array<{
        columns: number;
        rows: number;
        blanks: number;
    }>;
}
export interface TerminalRead {
    catalog: TerminalEntry[];
    catalogLoaded?: boolean;
    daemonTarget?: string;
    preview: TerminalPreview | null;
    error?: string;
}
export declare function readTerminals(client: DaemonClient, view?: string | null): Promise<TerminalRead>;
export declare function terminalExplorerRows(state: ViewState, snap: FleetSnapshot): ExplorerRow[];
export declare function terminalLines(state: ViewState, snap: FleetSnapshot, width: number): ContentLine[];
//# sourceMappingURL=terminal-model.d.ts.map