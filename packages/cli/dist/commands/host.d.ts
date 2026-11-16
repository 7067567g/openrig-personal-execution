import { Command } from "commander";
import { type HostEntry } from "../host-registry.js";
import { type CrossHostResult } from "../cross-host-executor.js";
import { type HostObservationOutcome } from "../host-bindings.js";
/** The largest poll deadline honored: the 32-bit signed millisecond cap that
 *  Node timers and `rig ask --wake-timeout` already use (2_147_483_647 ms,
 *  ~24.8 days). Node runs a delay above it after 1 ms, and an `Infinity`
 *  deadline would make the retry loop in `pair` never exit. */
export declare const MAX_PAIR_TIMEOUT_MS = 2147483647;
/** Resolve `--timeout <seconds>` to a bounded millisecond offset. Preserves
 *  today's accepted values — a blank value or `0` keeps the 600 s default, a
 *  negative value keeps the 1 s floor — and clamps a non-finite or
 *  millisecond-overflowing value to `MAX_PAIR_TIMEOUT_MS`, so the wait can
 *  never be infinite. */
export declare function resolvePairTimeoutMs(raw: string | undefined): number;
export type CheckStatus = "pass" | "fail" | "unknown";
export interface CheckRow {
    step: string;
    status: CheckStatus;
    detail: string;
    /** Actionable next step; REQUIRED for fail, encouraged for unknown. */
    fix?: string;
}
export interface DoctorDeps {
    run: (host: HostEntry, argv: readonly string[]) => Promise<CrossHostResult>;
    httpGet: (url: string, headers?: Record<string, string>) => Promise<{
        status: number;
        body: string;
    }>;
    /** OPR.0.4.6.MH1 FR-6: bounded JSON POST for the pair handshake.
     *  Optional so existing DoctorDeps fixtures keep compiling; the pair
     *  verb falls back to plain fetch when absent. */
    httpPost?: (url: string, body: unknown) => Promise<{
        status: number;
        body: string;
    }>;
    /** TCP connect probe: "open" (connected) | "closed" (refused/filtered/timeout) | "unknown" (probe itself failed). */
    tcpProbe: (target: string, port: number, timeoutMs: number) => Promise<"open" | "closed" | "unknown">;
    /** Slice 14 Source-1: record an observed `/healthz` selfHostId for a registry alias in the learned
     *  sidecar (TOFU + loud-conflict). Optional so existing fixtures keep compiling AND unit runs never
     *  write the real sidecar — absent means learning is skipped, which is the fail-open contract. */
    learnHostBinding?: (alias: string, observedHostId: string) => HostObservationOutcome;
}
/** FR-1 doctor legs — each failing step maps to a DISTINCT actionable error:
 *  "SSH works but daemon is down" ≠ "daemon works but registry is wrong" ≠
 *  "remote rig binary missing/old". */
/** OPR.0.4.6.MH1 FR-3 — the coarse ls status word: a BOUNDED tcp dial
 *  against the host's transport endpoint (ssh: target:22; http: the
 *  URL's host:port). Coarse by design (the kubectl STATUS / docker
 *  context ls precedent): reachable | unreachable | unknown — never a
 *  hang (hard timeout), never a guess (dial failure = unreachable,
 *  probe error/unparseable endpoint = unknown). */
export declare function probeHostStatus(host: HostEntry, tcpProbe: DoctorDeps["tcpProbe"], timeoutMs?: number): Promise<"reachable" | "unreachable" | "unknown">;
export declare function doctorLegs(host: HostEntry, deps: DoctorDeps): Promise<CheckRow[]>;
/** FR-2 — THE one built-in posture profile (arch R13-2b: a named constant
 *  table, no framework). Every item is three-valued; UNKNOWN is never
 *  smoothed to pass, and every non-pass carries its fix. */
export declare const POSTURE_PROFILE_ID = "product-factory-vps";
export declare function postureCheck(host: HostEntry, deps: DoctorDeps, opts?: {
    publicAddr?: string;
}): Promise<CheckRow[]>;
export declare const POSTURE_ITEM_IDS: readonly ["nonroot-openrig-user", "root-ssh-disabled", "key-only-ssh", "ufw-default-deny-incoming", "tailnet-ingress-allowed", "tailscale-minimal-trust", "daemon-bind-not-public", "public-daemon-port-unreachable", "public-ssh-unreachable-or-accepted"];
export declare function hostCommand(doctorDepsOverride?: DoctorDeps): Command;
//# sourceMappingURL=host.d.ts.map