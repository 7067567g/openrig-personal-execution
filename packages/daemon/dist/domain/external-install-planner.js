import { shellQuote } from "../adapters/shell-quote.js";
/**
 * Maps missing requirements to trusted provider install actions.
 * Phase 5 ships Homebrew (darwin) only. All other platforms produce manual_only.
 * install_hints from manifests are display-only — never executed.
 */
export class ExternalInstallPlanner {
    platform;
    constructor(opts) {
        this.platform = opts?.platform ?? process.platform;
    }
    /**
     * Build an install plan from probe results.
     * @param probeResults - results from RequirementsProbeRegistry.probeAll()
     */
    planInstalls(probeResults) {
        const actions = [];
        const alreadyInstalled = [];
        for (const probe of probeResults) {
            if (probe.status === "installed") {
                alreadyInstalled.push(probe.name);
                continue;
            }
            const action = this.mapToAction(probe);
            actions.push(action);
        }
        return {
            actions,
            autoApprovable: actions.filter((a) => a.classification === "auto_approvable"),
            reviewRequired: actions.filter((a) => a.classification === "review_required"),
            manualOnly: actions.filter((a) => a.classification === "manual_only"),
            alreadyInstalled,
        };
    }
    mapToAction(probe) {
        // Unsupported platform probe or unknown (probe failed) -> manual_only
        if (probe.status === "unsupported") {
            return {
                requirementName: probe.name,
                kind: probe.kind,
                provider: null,
                commandPreview: null,
                classification: "manual_only",
                installHints: probe.installHints,
                reason: "no trusted provider for this platform",
            };
        }
        if (probe.status === "unknown") {
            return {
                requirementName: probe.name,
                kind: probe.kind,
                provider: null,
                commandPreview: null,
                classification: "manual_only",
                installHints: probe.installHints,
                reason: "probe failed — cannot determine install action",
            };
        }
        // status === "missing" — try to map to a trusted provider
        if (this.platform === "darwin") {
            return {
                requirementName: probe.name,
                kind: probe.kind,
                provider: "homebrew",
                commandPreview: `brew install ${shellQuote(probe.name)}`,
                classification: "auto_approvable",
                installHints: probe.installHints,
                reason: "trusted Homebrew install",
            };
        }
        // Non-darwin with missing requirement -> manual_only
        return {
            requirementName: probe.name,
            kind: probe.kind,
            provider: null,
            commandPreview: null,
            classification: "manual_only",
            installHints: probe.installHints,
            reason: "no trusted provider for this platform",
        };
    }
}
//# sourceMappingURL=external-install-planner.js.map