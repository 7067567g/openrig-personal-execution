/** Sorted, de-duplicated, blank-free — so ordering never manufactures a delta. */
function normalize(values) {
    return Array.from(new Set(values.filter((v) => typeof v === "string" && v.trim() !== ""))).sort();
}
function missing(from, against) {
    const present = new Set(against);
    return from.filter((v) => !present.has(v));
}
export function compareSpecToLive(spec, live) {
    const specPods = normalize(spec.pods);
    const specSeats = normalize(spec.seats);
    const livePods = normalize(live.pods);
    const liveSeats = normalize(live.seats);
    const podsMissingFromSpec = missing(livePods, specPods);
    const seatsMissingFromSpec = missing(liveSeats, specSeats);
    const podsMissingFromLive = missing(specPods, livePods);
    const seatsMissingFromLive = missing(specSeats, liveSeats);
    const conforms = podsMissingFromSpec.length === 0 &&
        seatsMissingFromSpec.length === 0 &&
        podsMissingFromLive.length === 0 &&
        seatsMissingFromLive.length === 0;
    const result = {
        conforms,
        spec: { pods: specPods.length, seats: specSeats.length },
        live: { pods: livePods.length, seats: liveSeats.length },
        podsMissingFromSpec,
        seatsMissingFromSpec,
        podsMissingFromLive,
        seatsMissingFromLive,
        message: null,
    };
    if (conforms)
        return result;
    // Name the actual delta. A generic "topology may differ" is the caution a reader learns to skip.
    const parts = [
        `spec declares ${result.spec.pods} pods/${result.spec.seats} seats; live rig has ${result.live.pods}/${result.live.seats}`,
    ];
    if (podsMissingFromSpec.length)
        parts.push(`pods running but ABSENT FROM THE SPEC: ${podsMissingFromSpec.join(", ")}`);
    if (seatsMissingFromSpec.length)
        parts.push(`seats absent from the spec: ${seatsMissingFromSpec.join(", ")}`);
    if (podsMissingFromLive.length)
        parts.push(`pods declared but NOT RUNNING: ${podsMissingFromLive.join(", ")}`);
    if (seatsMissingFromLive.length)
        parts.push(`seats declared but not running: ${seatsMissingFromLive.join(", ")}`);
    result.message = parts.join("; ");
    return result;
}
/** Pods and seats as the SPEC declares them. */
export function topologyFromRigSpec(spec) {
    const pods = [];
    const seats = [];
    for (const pod of spec.pods ?? []) {
        if (!pod?.id)
            continue;
        pods.push(pod.id);
        for (const member of pod.members ?? []) {
            if (member?.id)
                seats.push(`${pod.id}.${member.id}`);
        }
    }
    return { pods, seats };
}
/**
 * Pods and seats as the DAEMON is actually running them, derived from node logical ids
 * (`<pod>.<member>`). Malformed or empty ids are skipped rather than guessed at — an id we cannot
 * parse is not evidence of a pod.
 */
export function topologyFromLiveLogicalIds(logicalIds) {
    const pods = [];
    const seats = [];
    for (const id of logicalIds) {
        if (typeof id !== "string")
            continue;
        const trimmed = id.trim();
        const dot = trimmed.indexOf(".");
        if (dot <= 0 || dot === trimmed.length - 1)
            continue;
        const pod = trimmed.slice(0, dot);
        if (!pods.includes(pod))
            pods.push(pod);
        seats.push(trimmed);
    }
    return { pods, seats };
}
/**
 * Seats as a LEGACY (v1) spec declares them — a flat `nodes:` list with no pods.
 *
 * A v1 spec exports through the same create endpoint and produces the same confidently-wrong
 * artifact, so it needs the same comparison. It does not need a second comparator: a legacy rig is
 * just a topology with no pod level, and `compareSpecToLive` already handles an empty pod list.
 */
export function topologyFromLegacyRigSpec(spec) {
    const seats = [];
    for (const node of spec.nodes ?? []) {
        if (typeof node?.id === "string" && node.id.trim() !== "")
            seats.push(node.id.trim());
    }
    return { pods: [], seats };
}
/**
 * Seats as the daemon is running them, read FLAT — the legacy counterpart to
 * `topologyFromLiveLogicalIds`.
 *
 * For a legacy rig a node's `logical_id` IS the spec's `node.id`; there is no `<pod>.<member>` to
 * split. Reusing the pod-aware reader here would parse every flat id as malformed and report an
 * empty live rig, which reads as "nothing is running" — a false absence, and the most dangerous
 * possible answer for a guard whose whole job is noticing what would be dropped.
 */
export function topologyFromLiveNodeIds(logicalIds) {
    const seats = [];
    for (const id of logicalIds) {
        if (typeof id !== "string")
            continue;
        const trimmed = id.trim();
        if (trimmed !== "")
            seats.push(trimmed);
    }
    return { pods: [], seats };
}
/** The one-line export banner. Null when there is nothing to say. */
export function bundleExportWarning(result) {
    if (result.message === null)
        return null;
    return `WARNING: this bundle describes the SPEC, not the live rig — ${result.message}. The bundle will instantiate ${result.spec.pods} pods/${result.spec.seats} seats.`;
}
//# sourceMappingURL=spec-live-conformance.js.map