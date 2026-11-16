/**
 * The LEARNED host-identity sidecar — hosts.yaml's `known_hosts`.
 *
 * `hosts.yaml` is hand-authored (the operator's `~/.ssh/config`); this file is machine-learned
 * (first-contact TOFU from `/healthz` `selfHostId` on probes we already run) and DISPOSABLE —
 * delete it to re-learn. The registry write path canonically rewrites hosts.yaml and drops
 * operator comments, so learned bindings NEVER go there; they live here, keyed by the registry
 * entry's alias (`id`).
 *
 * Failure semantics (the known_hosts lesson — a broken binding must fail LOUDLY):
 * - First observation for an alias: bind silently (TOFU).
 * - A LATER observation that DIFFERS: the stored binding is NEVER silently overwritten; the
 *   contradiction is recorded on the binding and surfaced by every reader (host ls flag, doctor
 *   row, resolution warning). A host's self-id is minted once and never re-keyed, so a changed
 *   observation means a genuine re-key or a mis-registration — both deserve a loud surface.
 * - ABSENCE stays fail-open: an unbound alias resolves exactly as today.
 */
export interface HostBinding {
    hostId: string;
    firstObservedAt: string;
    lastObservedAt: string;
    /** A later observation that CONTRADICTED the stored binding — kept visible, never adopted. */
    conflict?: {
        hostId: string;
        observedAt: string;
    };
}
export interface HostBindingsFile {
    version: 1;
    /** Keyed by the registry entry's alias (`HostEntry.id`). */
    bindings: Record<string, HostBinding>;
}
export declare function defaultHostBindingsPath(): string;
/** Load the sidecar. Fail-open by contract: missing, unreadable, or corrupt → empty bindings
 *  (a broken sidecar must never break resolution; delete it to re-learn). */
export declare function loadHostBindings(path?: string): HostBindingsFile;
export type HostObservationOutcome = {
    outcome: "bound";
    binding: HostBinding;
} | {
    outcome: "confirmed";
    binding: HostBinding;
}
/** The stored binding was NOT changed; the contradiction was recorded on it. */
 | {
    outcome: "conflict";
    binding: HostBinding;
};
/**
 * Record one observation of `observedHostId` for registry alias `alias` (TOFU + loud-conflict).
 * Persists via write-temp-then-rename so a crashed writer never leaves a torn file.
 */
export declare function recordHostObservation(args: {
    alias: string;
    observedHostId: string;
    now?: () => Date;
    path?: string;
}): HostObservationOutcome;
/** One line naming both ids, shared by every loud surface (ls flag detail, doctor row, resolution
 *  warning) so the operator reads the same story everywhere. */
export declare function describeBindingConflict(alias: string, binding: HostBinding): string;
//# sourceMappingURL=host-bindings.d.ts.map