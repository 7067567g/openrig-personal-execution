import { Command } from "commander";
export type DaemonState = "up" | "down" | "unverified";
export interface CrashCartEmit {
    state: DaemonState;
    evidence?: {
        pidState: string;
        probeResult: string;
        failedSignal: string;
    };
    discovery?: unknown;
    refusal?: string;
}
export interface CrashCartCommandDeps {
    /** Produce the verdict (the real wiring: emitCrashCartState with live probes + the C2 read). */
    emit: () => Promise<CrashCartEmit>;
    /** Emit one line (default: stdout). */
    write: (line: string) => void;
}
export declare function crashCartCommand(deps?: Partial<CrashCartCommandDeps>): Command;
//# sourceMappingURL=crash-cart.d.ts.map