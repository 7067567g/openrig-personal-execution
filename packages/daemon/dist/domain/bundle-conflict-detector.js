/**
 * Bundle conflict detector (Item 3 / slice-05 Checkpoint 4.1).
 *
 * Pure function. Compares a bundle's declared identifiers against the daemon's
 * current state and returns a structured conflict report. Callers (route
 * handlers in Checkpoint 4.2) provide the daemon state (listRigs() etc.); the
 * detector itself has no daemon dependencies — fully unit-testable.
 *
 * Fails CLOSED: the conflict list is the source of truth. Missing or ambiguous
 * input is treated as no-conflict-detectable, NOT as bypass — Items 4.2+ will
 * surface ambiguity as a conflict where appropriate. This commit ships the
 * rig-name collision check only; agent / port / managed-app / sibling-primitive
 * checks land in Checkpoint 4.3 + 4.4.
 *
 * Extends, does NOT replace, the existing 409 "install already in progress"
 * guard at /api/bundles/install (concurrency lock) per PRD Item 3 §
 * "extends, does NOT replace".
 */
/**
 * Run the conflict checks for an install candidate. Returns the full conflict
 * list (Checkpoint 4.2 returns it via /install --plan; --apply blocks on
 * non-empty unless --force).
 */
export function detectBundleConflicts(input) {
    const conflicts = [];
    // Rig-name collision: bundle declares a name a running rig already holds.
    // O(n) scan over runningRigs — acceptable for the seat-scale rig counts the
    // daemon manages (tens, not thousands).
    if (input.bundleRigName && input.bundleRigName.length > 0) {
        for (const rig of input.runningRigs) {
            if (rig.name === input.bundleRigName) {
                conflicts.push({
                    kind: "rig_name_collision",
                    bundleRigName: input.bundleRigName,
                    collisionWith: { rigId: rig.rigId, rigName: rig.name },
                    description: `bundle declares rig name '${input.bundleRigName}' but a running rig with this name already exists (rigId: ${rig.rigId})`,
                    resolutions: [
                        `use the existing team (rig ps --rig '${rig.name}' --nodes)`,
                        `stop the running rig first (rig down '${rig.name}') and retry this install to replace the stopped team; the earlier generation is archived`,
                        "cancel the install and keep the existing team; --target chooses a directory, not a new rig name",
                    ],
                });
                break;
            }
        }
    }
    return { conflicts, hasConflicts: conflicts.length > 0 };
}
//# sourceMappingURL=bundle-conflict-detector.js.map