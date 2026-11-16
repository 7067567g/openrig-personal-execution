// OPR.0.5.5.20 — DAEMON BIND PROVENANCE: the pure bind-plan resolver. Bind intent
// reaches the daemon ONLY through the dedicated OPENRIG_BIND_HOST surface; the
// overloaded routing env (OPENRIG_HOST/RIGGED_HOST — a client endpoint any managed
// environment may inject) can NEVER select the single-bind branch. The lived cost of
// the old conflation: the parent daemon inherited OPENRIG_HOST=127.0.0.1 from a
// maintenance command run in a managed environment and silently lost its Tailscale
// listener (operator baton qitem-20260827070400). This re-grounds the
// auth-bearer-tailscale-trust ruling — explicit opt-in vs default — on a channel that
// managed environments never inject; it does not overturn it.
export function resolveBindPlan(input) {
    const bindHost = input.bindHostEnv?.trim() || undefined;
    const routingHost = input.routingHostEnv?.trim() || undefined;
    const tailscaleDetected = input.tailscaleIp !== null;
    if (bindHost) {
        return { mode: "explicit", hosts: [bindHost], tailscaleDetected };
    }
    const hosts = input.tailscaleIp ? ["127.0.0.1", input.tailscaleIp] : ["127.0.0.1"];
    return {
        mode: "default",
        hosts,
        tailscaleDetected,
        ...(routingHost ? { ignoredRoutingHost: routingHost } : {}),
    };
}
//# sourceMappingURL=bind-plan.js.map