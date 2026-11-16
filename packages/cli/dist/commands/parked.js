import { Command } from "commander";
function verdictWord(parked) {
    return parked === true ? "PARKED" : parked === false ? "not parked" : "INDETERMINATE";
}
function renderSeat(d) {
    console.log(`${d.sessionName}: ${verdictWord(d.parked)} — ${d.reason}`);
    console.log(`  activity: ${d.activity.value}${d.activity.needsInput.count > 0 ? ` (needs-input x${d.activity.needsInput.count}: ${d.activity.needsInput.reason})` : ""} [decided by ${d.activity.decidedBy ?? "nothing — unknown"}; confidence ${d.confidence.activity}]`);
    console.log(`  obligations: ${d.obligations.openCount} open, ${d.obligations.heldCount} held [${d.obligations.scope}; ${d.obligations.complete ? "complete" : `MAY BE TRUNCATED at ${d.obligations.limit}`}]`);
    for (const item of d.obligations.items.slice(0, 10)) {
        console.log(`    - ${item.state} ${item.qitemId}${item.summary ? ` — ${item.summary}` : ""}`);
    }
    if (d.obligations.items.length > 10)
        console.log(`    … and ${d.obligations.items.length - 10} more`);
    for (const item of d.obligations.held ?? []) {
        const wake = item.wake;
        const wakeText = wake
            ? `${wake.kind} ${wake.ref}: ${wake.unconsumed ? `FIRED but unconsumed${wake.deliveryStatus ? ` (${wake.deliveryStatus})` : ""}` : wake.live ? "live" : "not live"}`
            : "no recorded wake";
        console.log(`    - HELD ${item.qitemId}${item.summary ? ` — ${item.summary}` : ""} [${wakeText}]`);
        if (!item.healthy && !(wake?.live && !wake.unconsumed)) {
            console.log("      Remedy: attach a live watchdog id, arm an atomic timer, or name a live blocker qitem; deferred/not-imminent work with a workspace home belongs in its mission/slice.");
        }
    }
}
export function parkedCommand() {
    return new Command("parked")
        .description("Are we parked? Derived diagnosis: stopped seats owing work; HELD is healthy only while its recorded wake is live")
        .argument("[seat]", "Seat node id or canonical session name; omit to diagnose the whole rig")
        .option("--rig <rig>", "Rig scope (defaults to your seat's rig from OPENRIG_SESSION_NAME; a seat argument carrying @rig self-scopes)")
        .option("--json", "Full diagnosis as JSON")
        .action(async (seat, opts) => {
        const { DaemonClient } = await import("../client.js");
        const client = new DaemonClient();
        // WAVE-O B2: the diagnosis is rig-scoped — carry the coordinate. A seat@rig
        // argument self-scopes; otherwise --rig, then the shell's own seat identity.
        // With none resolvable the daemon's teaching refusal is surfaced verbatim.
        const params = new URLSearchParams();
        if (seat)
            params.set("seat", seat);
        if (!seat?.includes("@")) {
            const envSession = process.env["OPENRIG_SESSION_NAME"];
            const rig = opts.rig ?? (envSession?.includes("@") ? envSession.split("@")[1] : undefined);
            if (rig)
                params.set("rig", rig);
        }
        const qs = params.toString();
        let data;
        try {
            const res = await client.get(`/api/activity/parked${qs ? `?${qs}` : ""}`);
            data = res.data;
        }
        catch (err) {
            console.error(`refused: the parked diagnosis is derived LIVE from the oracle and the queue — it needs a reachable daemon (${err.message}).`);
            process.exitCode = 1;
            return;
        }
        if (!data.ok) {
            console.error(`refused: ${data.error}`);
            process.exitCode = 1;
            return;
        }
        if (opts.json) {
            console.log(JSON.stringify(data));
            return;
        }
        if (data.seat) {
            if (data.scope)
                console.log(`scope: rig ${data.scope.rig} (from ${data.scope.resolvedFrom})`);
            renderSeat(data.seat);
            return;
        }
        const rig = data.rig;
        console.log(`rig: ${verdictWord(rig.parked)} — ${rig.reason}`);
        if (rig.scope)
            console.log(`scope: rig ${rig.scope.rig} (from ${rig.scope.resolvedFrom})`);
        for (const d of rig.seats) {
            if (d.parked === false)
                continue; // the interesting cells are parked + indeterminate
            renderSeat(d);
        }
    });
}
//# sourceMappingURL=parked.js.map