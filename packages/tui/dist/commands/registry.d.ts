import type { Action, SectionDef, FleetSnapshot, ViewState, ViewTab } from "../types.js";
export interface CompletionContext {
    state: ViewState;
    snapshot: FleetSnapshot;
}
export declare function availableTabs(state: ViewState, snap: FleetSnapshot): ViewTab[];
export interface CommandEntry {
    /** Canonical verb (or prefix glyph for prefix-form commands). */
    name: string;
    /** First-class alternatives — the palette and grammar match these equally (PM pin 5). */
    aliases: string[];
    /** Human-readable argument shape, e.g. "<view>" — serialized verbatim to every surface. */
    args: string;
    description: string;
    /** Availability context (PM pin 3): composes with the C3 detector states downstream. */
    context: "standard" | "always";
    /** Prefix-form commands (`:` jump, `/` filter) parse structurally, not by verb token. */
    prefix?: boolean;
    /** A canonical parseable invocation — the parity suite proves it yields a non-error action. */
    sample: string;
    /** Build the action from the argument remainder (verb commands only). */
    build?: (name: string, ctx: BuildCtx) => Action;
    complete?: (ctx: CompletionContext) => readonly string[];
}
export interface BuildCtx {
    sections: readonly SectionDef[];
}
export declare const COMMAND_REGISTRY: readonly CommandEntry[];
/** Verb → entry map with aliases first-class (PM pin 5). */
export declare const VERB_TABLE: ReadonlyMap<string, CommandEntry>;
/** The unknown-verb error listing — SERIALIZED from the registry (never hand-maintained). */
export declare function unknownCommandMessage(verb: string): string;
/** ONE availability rule (I3 palette + I4 socket share it): "always" satisfies any
 *  context; otherwise the entry's context must equal the current one. */
export declare function evaluateAvailability(entry: CommandEntry, currentContext: string): {
    available: boolean;
    reason?: string;
};
/** I4 — the socket "commands" OBSERVE projection: the data contract + LIVE availability.
 *  Serialized from the ONE registry (PM pin 2), evaluated per-session (PM pin 3). */
export declare function serializeCommands(currentContext: string): Array<{
    name: string;
    aliases: string[];
    args: string;
    description: string;
    context: string;
    sample: string;
    available: boolean;
    reason?: string;
}>;
/** I5 — the C3 detector state → command context mapping (composes PM pin 3 with the
 *  crash-cart detector): up/absent = the standard shell; down = the crash-cart cockpit;
 *  unverified = its own honest context (nothing pretends the daemon is up OR down). */
export declare function currentCommandContext(daemonState: "up" | "down" | "unverified" | null | undefined): string;
//# sourceMappingURL=registry.d.ts.map