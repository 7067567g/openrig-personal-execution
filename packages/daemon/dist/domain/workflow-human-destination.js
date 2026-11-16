import { loadHumanRegistry, resolveRegisteredHumanAddress } from "./gateway/human-registry.js";
import { SettingsStore } from "./user-settings/settings-store.js";
export class WorkflowHumanDestinationError extends Error {
    details;
    code = "workflow_human_destination_unavailable";
    constructor(details, message) {
        super(message);
        this.details = details;
        this.name = "WorkflowHumanDestinationError";
    }
}
/** The existing operator selection, resolved afresh only when a human is needed. */
export function resolveWorkflowHumanDestination(configured = () => new SettingsStore().resolveOne("workspace.operator_seat_name").value, registry = loadHumanRegistry) {
    let selected;
    let loaded;
    try {
        selected = configured();
        loaded = registry();
    }
    catch (error) {
        throw new WorkflowHumanDestinationError({ state: "unavailable" }, `Workflow human selection is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!loaded.ok) {
        throw new WorkflowHumanDestinationError({ state: "registry-unavailable" }, loaded.error);
    }
    const addresses = loaded.entities.map((human) => human.address);
    if (typeof selected === "string" && selected.trim()) {
        const address = resolveRegisteredHumanAddress(selected.trim(), loaded.entities);
        if (address)
            return address;
        throw new WorkflowHumanDestinationError({ state: "unregistered", selected, addresses }, "workspace.operator_seat_name does not select a registered human. Inspect rig gateway human list --json and select the intended registered address.");
    }
    if (addresses.length === 1)
        return addresses[0];
    throw new WorkflowHumanDestinationError({ state: addresses.length ? "ambiguous" : "missing", addresses }, "Workflow human fallback needs one registered human. Inspect rig gateway human list --json; when several exist, explicitly select workspace.operator_seat_name. No human destination was invented.");
}
export function workflowHumanDestination(selection = resolveWorkflowHumanDestination) {
    return typeof selection === "function" ? selection() : selection;
}
//# sourceMappingURL=workflow-human-destination.js.map