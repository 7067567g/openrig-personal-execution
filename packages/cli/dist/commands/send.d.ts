import { Command } from "commander";
import { DaemonConnectionError } from "../client.js";
import type { StatusDeps } from "./status.js";
import { loadHostRegistry } from "../host-registry.js";
import { runCrossHostCommand, type RunCrossHostCommandOpts } from "../cross-host-executor.js";
/**
 * Wrap a `rig send` body with an email-style envelope so the recipient
 * pane has both the sender's identity and a copy-pasteable reply hint.
 * Cross-host sends do NOT wrap locally: the remote rig wraps when it
 * runs the same command, and double-wrapping would nest envelopes.
 *
 * V0.3.1 slice 23 parity contract: `packages/daemon/src/lib/pane-envelope.ts`
 * exports `wrapPaneEnvelope` with BYTE-IDENTICAL output for the same inputs.
 * P18 (deletion atom) REVERSES A1: an env-less `rig send`/`broadcast` no longer
 * refuses at the seat boundary — it DELIVERS carrying the honest `<unknown sender>`
 * fallback (the daemon half delivers-and-labels the header-absent write, so the
 * marker reaches the pane instead of a downstream 401). So this twin RE-GAINS the
 * fallback branch and is byte-identical with wrapPaneEnvelope across the FULL input
 * domain again (resolved AND undefined). The implementations live in separate
 * packages because cli + daemon don't cross-import today. If you update this
 * function, update wrapPaneEnvelope in lockstep.
 */
/** Send/broadcast header envelope metadata (ruling 03c35295) — the BYTE-IDENTICAL twin of the daemon's
 *  pane-envelope EnvelopeMeta. Envelope = machine truth; rendered header = projection. */
export interface EnvelopeScope {
    kind: "dm" | "multi" | "rig-broadcast" | "topology";
    recipients?: string[];
    rig?: string;
    seats?: number;
}
export interface EnvelopeMeta {
    /** ISO-8601, stamped ONCE at transport send-time; render READS it, never re-derives. */
    stampISO?: string;
    scope?: EnvelopeScope;
    /** GHOST-STAGE (g): the SENDER's atom-B occupant generation-uuid, stamped ONCE at transport.
     *  ABSENT ⇒ UNKNOWN → the render OMITS the suffix (never forges). Twin of pane-envelope's field. */
    genUuid?: string;
}
/** The To-line projection + anti-storm scale (header-alone distinguishability). */
export declare function renderToLine(recipient: string, scope?: EnvelopeScope): string;
/** Short glanceable stamp MM-DD HH:MMZ from the transport ISO. */
export declare function renderShortStamp(stampISO: string): string;
export declare function wrapSendBody(sender: string | undefined, recipient: string, body: string, meta?: EnvelopeMeta): string;
/** Ordinary messages require content; explicit key input only requires nonzero bytes. */
export declare function refuseEmptyMessage(body: string, verb: "send" | "broadcast", json?: boolean, explicitInteraction?: boolean): boolean;
export interface SendDeps extends StatusDeps {
    /**
     * Cross-host hooks. Both default to the production loaders/executors; tests
     * inject in-package mocks so no real ssh / no real ~/.ssh / no real network
     * is touched.
     */
    hostRegistryLoader?: () => ReturnType<typeof loadHostRegistry>;
    crossHostRun?: (host: Parameters<typeof runCrossHostCommand>[0], argv: readonly string[], opts?: RunCrossHostCommandOpts) => ReturnType<typeof runCrossHostCommand>;
}
export declare function sendCommand(depsOverride?: SendDeps): Command;
/** B8-2 test seam: the transport-failure renderer, exported for the honesty pins. */
export declare function printTransportFailureForTest(err: DaemonConnectionError, opts?: {
    json?: boolean;
}): void;
//# sourceMappingURL=send.d.ts.map