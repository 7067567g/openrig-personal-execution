/** Send/broadcast header envelope metadata (ruling 03c35295). The ENVELOPE carries the machine truth;
 *  the rendered header is a PROJECTION of it. Both twins (this + cli wrapSendBody) share this shape. */
export interface EnvelopeScope {
    /** dm = a single recipient; multi = a named recipient set; rig-broadcast/topology = scaled broadcasts. */
    kind: "dm" | "multi" | "rig-broadcast" | "topology";
    /** multi: the full recipient list (WHO got it). */
    recipients?: string[];
    /** rig-broadcast: the rig + seat count (the anti-storm scale). */
    rig?: string;
    seats?: number;
}
export interface EnvelopeMeta {
    /** ISO-8601, stamped ONCE at the transport layer at send-time. Render READS it; never re-derives
     *  (the 51-02 wall-clock-in-projection forbids computing it at read). */
    stampISO?: string;
    scope?: EnvelopeScope;
    /** GHOST-STAGE (g): the SENDER's atom-B occupant generation-uuid, resolved ONCE at the transport
     *  layer at send-time (same seam as stampISO). Lets a recipient attribute a delayed lifecycle
     *  message to the composing generation rather than inheriting it as the current occupant's.
     *  ABSENT ⇒ UNKNOWN (cross-host --from relay whose sender isn't local, or pre-tenure daemon) —
     *  the render omits it, never forges a generation. Render is a PROJECTION of this machine truth. */
    genUuid?: string;
}
/** The To-line projection + anti-storm scale (header-alone distinguishability, ruling pin 2). */
export declare function renderToLine(recipient: string, scope?: EnvelopeScope): string;
/** Short glanceable stamp MM-DD HH:MMZ (12 chars) from the transport ISO (ruling pin 3). */
export declare function renderShortStamp(stampISO: string): string;
/** GHOST-STAGE (h): a delivery is FLAGGED as delayed only once its compose→write gap crosses this
 *  threshold. 10s is clearly beyond idle-wait jitter — unambiguously "this waited" — so sub-threshold
 *  gaps render nothing (measured-telemetry: a flag, not sub-second noise). ONE named constant. */
export declare const DELIVERED_LATENCY_FLAG_MS = 10000;
/** GHOST-STAGE (h): append the relative delivered-latency segment to the Sent: line at the WRITE
 *  moment (daemon-side only — the CLI composes, it never delivers to a pane, so there is no compose
 *  twin for this). `deltaMs` is (write-time − the Sent: stampISO): how long the message waited since
 *  it was composed. Only a genuinely delayed delivery (deltaMs ≥ DELIVERED_LATENCY_FLAG_MS) renders a
 *  segment; whole seconds, in the g gen-suffix style (' · delivered +12s'). sent-ISO + this delta
 *  gives absolute delivered time for free. CONTAINMENT (the ' · delivered ' twin of g's ' · gen '):
 *  the segment is appended ONLY to the Sent: line WITHIN the header block (before the first "\n---\n"),
 *  so a body line that itself contains ' · delivered …' can never be mistaken for the real stamp. No
 *  Sent: line (unenveloped / meta-less send) ⇒ returned unchanged. */
export declare function appendDeliveredSegment(envelope: string, deltaMs: number): string;
/** Wrap a tmux-pane body with the canonical From/To envelope. The
 *  recipient pane sees both the sender's identity and a reply hint.
 *  Cross-host nudges should NOT double-wrap: the remote rig wraps
 *  when it processes the same command (matches `wrapSendBody`'s
 *  cross-host carve-out).
 *  `meta` (ruling 03c35295) projects the recipient scale + a transport-stamped timestamp; ABSENT ⇒
 *  today's exact DM envelope (backward-compat until every sender surface threads it). */
export declare function wrapPaneEnvelope(sender: string | undefined, recipient: string, body: string, meta?: EnvelopeMeta): string;
//# sourceMappingURL=pane-envelope.d.ts.map