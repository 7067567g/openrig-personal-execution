/**
 * Thin policy gate for install plan entries.
 * Processes plan.actionable for classification-based approval,
 * and plan.conflicts as always-rejected. Does not double-process
 * entries that appear in both arrays.
 */
export function applyPolicy(plan, options = {}) {
    const approved = [];
    const rejected = [];
    // Track processed entry identities to prevent double-rejection
    const processed = new Set();
    // Conflicts are always rejected first
    for (const entry of plan.conflicts) {
        const key = `${entry.exportType}:${entry.exportName}`;
        if (!processed.has(key)) {
            processed.add(key);
            rejected.push({
                entry,
                reason: "Conflicts must be resolved before install",
            });
        }
    }
    // Actionable entries — classify
    for (const entry of plan.actionable) {
        const key = `${entry.exportType}:${entry.exportName}`;
        if (processed.has(key))
            continue; // Already handled as conflict
        switch (entry.classification) {
            case "safe_projection":
                approved.push(entry);
                break;
            case "managed_merge":
                if (options.allowMerge) {
                    approved.push(entry);
                }
                else {
                    rejected.push({
                        entry,
                        reason: "managed_merge requires allowMerge flag",
                    });
                }
                break;
            case "config_mutation":
                rejected.push({ entry, reason: "Deferred to Phase 5" });
                break;
            case "external_install":
                rejected.push({ entry, reason: "Deferred to Phase 5" });
                break;
            case "manual_only":
                rejected.push({ entry, reason: "Manual merge not supported in Phase 4" });
                break;
        }
    }
    return { approved, rejected };
}
//# sourceMappingURL=install-policy.js.map