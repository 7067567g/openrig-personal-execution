// OPR.0.5.3.5 Q3 harness bridge (mini-req 8, amended per desk ruling 9103302d):
// slice-05's behavior probes execute in the SAME live-model eval harness as
// slice-07's selection/loading cases, as the "behavior" case CATEGORY — one
// harness, one runner, one grading door; two runners would fork the eval
// convention itself (the drift class this release keeps killing).
//
// This bridge is DATA-SHAPED on purpose: it compiles atom probes (mini-req 1
// metadata) into plain eval-case objects that the harness validates through
// ITS OWN schema at load time — exactly how the authored YAML cases travel.
// No import from the harness's modules, so the product side and the
// test-system side stay decoupled by data (the schema's own stated design:
// "no cross-package TS import"), and the one-harness property is preserved
// by construction rather than by discipline.
export function compileAtomProbesToEvalCases(manifest, packRef) {
    const cases = [];
    const skipped = [];
    for (const atom of manifest.atoms ?? []) {
        if (!atom.probe)
            continue;
        if (!atom.probe.expectedPatterns || atom.probe.expectedPatterns.length === 0) {
            skipped.push({
                atomId: atom.id,
                reason: "probe has no expectedPatterns — the harness's deterministic door requires at least one compilable pattern; author them on the atom's probe",
            });
            continue;
        }
        cases.push({
            id: `${packRef}/${atom.id}`,
            name: atom.probe.expect,
            category: "behavior",
            prompt: atom.probe.prompt,
            expectedPatterns: atom.probe.expectedPatterns,
            rubric: atom.probe.rubric ?? atom.probe.expect,
        });
    }
    return { cases, skipped };
}
//# sourceMappingURL=probe-eval-bridge.js.map