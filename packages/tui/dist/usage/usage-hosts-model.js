import { sectionRule, wrapDetailLines } from "../detail.js";
import { allowanceLines, failureText, identityLabel, seatLines, str } from "./usage-model.js";
export const USAGE_HOSTS_HEADER = "registered hosts, as this daemon reads them · not proof of the login a running session uses";
export const USAGE_HOSTS_HINT = "This view shows what the hosts already hold. It never starts a refresh or reads the logins. To read them now: rig provider status --all-hosts --refresh [--provider codex|claude]";
const indent = (lines, pad) => lines.map((l) => ({ ...l, text: pad + l.text }));
function hostLines(h) {
    const transport = h["status"] === "ok" ? "answered" : `${str(h["status"])}${h["error"] ? ` (${h["error"]})` : ""}`;
    const usage = h["usage"] === "served" ? "usage windows served" : `usage ${str(h["usage"])}${h["usageReason"] ? `: ${h["usageReason"]}` : ""}`;
    const lines = [{ text: `  ${str(h["hostId"])}  ${transport} · ${usage}${h["readAt"] ? ` · read ${h["readAt"]}` : ""}` }];
    for (const leg of Object.values((h["lastRefresh"] ?? {}))) {
        lines.push({ text: leg["outcome"] === "failed"
                ? `    refresh from here (${str(leg["provider"])}) failed at ${str(leg["at"])}: ${failureText(leg)}; this host's earlier observations are kept`
                : `    refresh from here (${str(leg["provider"])}) answered at ${str(leg["at"])}` });
    }
    return lines;
}
function groupLines(g) {
    const observations = g["observations"] ?? [];
    const hosts = [...new Set(observations.map((o) => str(o["hostId"])))];
    const id = observations[0]?.["row"]?.["identity"];
    const linkage = g["linkage"] === "same" ? `the same allowance on ${hosts.length} hosts: ${hosts.join(", ")}`
        : g["linkage"] === "conflict" ? `the same allowance on ${hosts.length} hosts, disagreeing: ${hosts.join(", ")}`
            : g["linkage"] === "single" ? `observed on ${hosts[0] ?? "unknown"}`
                : `linkage unknown; observed on ${hosts.join(", ")}`;
    const lines = [{ text: `  ${str(g["provider"])}  ${id ? `${identityLabel(id)} · bucket ${str(id["limitId"])}` : "not read yet"}  [${linkage}]` }];
    for (const note of g["notes"] ?? [])
        lines.push({ text: `    ! ${note}` });
    for (const o of observations) {
        lines.push({ text: `    on ${str(o["hostId"])} (read ${str(o["readAt"])}):` });
        lines.push(...indent(allowanceLines((o["row"] ?? {})), "    "));
    }
    return lines;
}
export function usageHostsLines(snap, width) {
    const lines = [{ text: "System · Usage across hosts" }, { text: `  ${USAGE_HOSTS_HEADER}` }, { text: `  ${USAGE_HOSTS_HINT}` }];
    const read = snap.usageHosts;
    if (!read)
        return wrapDetailLines([...lines, { text: "" }, { text: "  Not read yet." }], width);
    if (!("view" in read.status)) {
        const failure = read.status;
        lines.push({ text: "" }, failure.status === 404
            ? { text: "  This daemon doesn't serve usage across hosts (HTTP 404)." }
            : failure.status === 409 && failure.message
                ? { text: `  ${failure.message}` }
                : { text: `  Usage across hosts unavailable: ${failure.error}. Nothing is inferred from the missing read.` });
        return wrapDetailLines(lines, width);
    }
    const view = read.status.view;
    lines.push(sectionRule("Hosts", width));
    for (const h of view["hosts"] ?? [])
        lines.push(...hostLines(h));
    for (const s of view["skipped"] ?? [])
        lines.push({ text: `  ${str(s["hostId"])}  skipped: ${str(s["reason"])}` });
    const registry = (view["registry"] ?? {});
    if (registry["state"] !== "read")
        lines.push({ text: `  host registry ${str(registry["state"])}${registry["note"] ? `: ${registry["note"]}` : ""}` });
    lines.push(sectionRule("Allowances · one entry per allowance; each host's observation as that host served it, never summed", width));
    const groups = view["items"] ?? [];
    if (groups.length === 0)
        lines.push({ text: "  No usage rows served." });
    for (const g of groups)
        lines.push(...groupLines(g));
    for (const s of view["seatAccounts"] ?? []) {
        lines.push(sectionRule(`Seats on ${str(s["hostId"])} · configured account (not proof of the login a running session uses)`, width));
        const seats = s["seats"] ?? [];
        if (seats.length === 0)
            lines.push({ text: "  No seats served." });
        for (const r of seats)
            lines.push(...seatLines(r, { differsFirst: true }));
    }
    return wrapDetailLines(lines, width);
}
//# sourceMappingURL=usage-hosts-model.js.map