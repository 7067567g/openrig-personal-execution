export declare const HUMAN_ENTITY_CLASSES: Set<string>;
export declare const HUMAN_CONNECTOR_KINDS: Set<string>;
export declare const HUMAN_BINDING_ROLES: Set<string>;
export declare const HUMAN_DELIVERY_CLASSES: Set<string>;
export declare const ENTITY_ID_PATTERN: RegExp;
export declare const ADDRESS_DOMAIN = "external";
export declare const HANDLE_PATTERN: RegExp;
export declare const HUMAN_AVAILABILITY_MODES: Set<string>;
export interface HumanConnectorBinding {
    kind: "slack";
    connectorRef: string;
    /** POINTER at the connector's vault (secrets-on-connector) — NEVER the secret. */
    secretsRef: string;
    /** Per-BINDING routing: EXACTLY ONE primary per entity = the default channel. */
    role: "primary" | "secondary";
    /** A6 v3: the platform-native id of this human on the connector (e.g. Slack user id).
     *  OPTIONAL — a handle-less binding is OUTBOUND-ONLY (delivery works; it is NOT
     *  inbound-resolvable, so an inbound event on it fails admission LOUDLY). REQUIRED to be
     *  inbound-resolvable. UNIQUE per kind across ALL bindings of ALL humans (one platform id =
     *  exactly one human; a duplicate is a registration conflict, REFUSED). */
    handle?: string;
}
export interface HumanPrefs {
    /** Per-ENTITY loudness — a SELECTION from the notifications register (spec §6);
     *  A3 carries it, never redefines it. Forward-compatible if the register grows. */
    deliveryClass: "A" | "B" | "C" | "D";
    /** The AWAY preset (optional; LEGACY spelling — availability=away supersedes).
     *  Read via the engine's resolveAvailability: consulted only when
     *  `availability` is whole-field-absent. */
    away?: boolean;
    /** OPR.0.5.6.1 — availability mode (available | focus | away | off). */
    availability?: "available" | "focus" | "away" | "off";
}
export interface HumanFragment {
    entityId: string;
    class: "human";
    displayName: string;
    /** The registered @external ref, = <entityId>@external by convention. */
    address: string;
    connectorBindings: HumanConnectorBinding[];
    prefs: HumanPrefs;
}
export type ValidateResult = {
    ok: true;
    fragment: HumanFragment;
} | {
    ok: false;
    error: string;
};
/** add-time == load-time validation. Returns the typed fragment or a loud error.
 *  Structural + closed-enum + the two cross-field invariants (>=1 binding,
 *  exactly-one-primary-per-entity). Does NOT touch the filesystem. */
export declare function validateHumanFragment(raw: unknown): ValidateResult;
export declare function humansDir(home?: string): string;
export declare function projectionPath(home?: string): string;
/** @deprecated Historical spelling retained for readers of old records only.
 * Never a routing default: an address must resolve to an actual registry entity. */
export declare const OPERATOR_HUMAN_DEFAULT_SLOT = "human-operator@kernel";
export type ProjectResult = {
    ok: true;
    body: string;
    entities: HumanFragment[];
} | {
    ok: false;
    error: string;
};
/** Generate the canonical registry projection from the fragments (the ONE generator
 *  used by both the write path and the drift/load check). Load-time validation is the
 *  SAME validateHumanFragment as add-time; the filename must equal <entityId>.yaml
 *  (collision-free key). Entities are sorted by entityId for a stable, diffable body. */
export declare function projectHumans(home?: string): ProjectResult;
export type SlackHandleResolution = {
    kind: "registered";
    entityId: string;
    address: string;
} | {
    kind: "unregistered";
    handle: string;
    error: string;
};
/** A6 v3 pins 2+3 — resolve an INBOUND connector handle to its registered human. Walks every
 *  human's bindings of `connectorKind` for one whose `handle` equals `handle`:
 *   - a match          -> registered (admit as that entity; its address is the human-class source)
 *   - no match         -> unregistered LOUD teaching (admit-iff-registered — never fabricate a
 *                         human seat from a raw platform id; a handle-LESS binding is outbound-only
 *                         and simply never matches, so it fails inbound here, loudly).
 *  Cross-fragment uniqueness (projectHumans) guarantees at most one match. */
export declare function resolveSlackHandle(handle: string, entities: readonly HumanFragment[], connectorKind?: "slack"): SlackHandleResolution;
/** (Re)write the generated projection from the current fragments. Atomic. */
export declare function writeProjection(home?: string): {
    ok: true;
    path: string;
} | {
    ok: false;
    error: string;
};
export type AddHumanResult = {
    ok: true;
    path: string;
    fragment: HumanFragment;
} | {
    ok: false;
    error: string;
};
/** The verb-add writer: validate (add-time) -> atomic write the ONE fragment file ->
 *  re-project. Operators never hand-create the fragment YAML; the verb owns it.
 *  NO SILENT CLOBBER (mirrors hosts-registry addHostEntry): an existing entityId is
 *  REFUSED unless `replace` is passed explicitly — a re-run must not silently replace
 *  a human's data (managed-config data-safety class). */
export declare function addHumanFragment(raw: unknown, home?: string, opts?: {
    replace?: boolean;
}): AddHumanResult;
/** One in-flight item standing between a human and a clean remove. The registry does not
 *  own the sources (queue rows live behind the daemon; conversations in the dispatch
 *  buffer) — callers assemble the list; `pendingConversationsFor` covers the buffer half. */
export interface InflightItem {
    kind: "open-conversation" | "queue-row";
    id: string;
    detail: string;
}
export interface HumanBindingsSummary {
    count: number;
    primary: {
        kind: string;
        connectorRef: string;
    };
    /** true iff any binding carries a handle (outbound-only otherwise). */
    inboundResolvable: boolean;
}
export interface HumanSummary {
    entityId: string;
    displayName: string;
    address: string;
    deliveryClass: HumanPrefs["deliveryClass"];
    /** EFFECTIVE availability preset (default false when unauthored). */
    away: boolean;
    bindings: HumanBindingsSummary;
    fragmentPath: string;
}
export type ListHumansResult = {
    ok: true;
    humans: HumanSummary[];
    advisory?: string;
} | {
    ok: false;
    error: string;
};
/** Amendment A1 (founder R5): the human surface is SINGLE-HUMAN. Several fragments render
 *  honestly, but enumeration is display, never management — the advisory names the boundary. */
export declare const MULTI_HUMAN_ADVISORY = "several human fragments exist; OpenRig supports one configured human, so they are displayed as found and no command manages several";
/** A field value with its provenance: authored in the fragment, or filled by a default. */
export interface ProvenancedValue<T> {
    value: T;
    source: "authored" | "default";
}
export interface EffectiveHumanRecord {
    entityId: string;
    address: string;
    displayName: string;
    fragmentPath: string;
    prefs: {
        deliveryClass: ProvenancedValue<HumanPrefs["deliveryClass"]>;
        away: ProvenancedValue<boolean>;
    };
    connectorBindings: Array<HumanConnectorBinding & {
        inboundResolvable: boolean;
    }>;
}
export type ShowHumanResult = {
    ok: true;
    record: EffectiveHumanRecord;
} | {
    ok: false;
    error: string;
};
export type SetHumanFieldResult = {
    ok: true;
    path: string;
    fragment: HumanFragment;
} | {
    ok: false;
    error: string;
};
export type RemoveHumanResult = {
    ok: true;
    removed: string;
    archivedPath: string;
    orphanRecordPath?: string;
} | {
    ok: false;
    error: string;
    inflight?: InflightItem[];
};
/** --binding / set-binding spec: kind:connectorRef:secretsRef:role[:handle=<id>]. secretsRef is
 *  a vault POINTER and may itself contain ':', so kind/connectorRef are the first two fields,
 *  role is the LAST positional, secretsRef is everything between. An optional handle= token may
 *  appear anywhere. ONE source for add (CLI) and set (here) — the same parse both paths. */
export declare function parseBindingSpec(spec: string): {
    ok: true;
    binding: {
        kind: string;
        connectorRef: string;
        secretsRef: string;
        role: string;
        handle?: string;
    };
} | {
    ok: false;
    error: string;
};
export declare function listHumans(home?: string): ListHumansResult;
export declare function showHuman(entityId: string, home?: string): ShowHumanResult;
export declare function setHumanField(entityId: string, field: string, value: string, home?: string): SetHumanFieldResult;
export declare function removeHumanFragment(entityId: string, opts: {
    force?: boolean;
    inflight: InflightItem[];
}, home?: string): RemoveHumanResult;
/** The dispatch-buffer half of the remove guard: un-Acked outbound decisions bound to this
 *  entity are open conversations. Match rule (documented, not guessed): entityBindingRef equal
 *  to the entityId, equal to its registered address, or prefixed "<entityId>:". */
export declare function pendingConversationsFor(entityId: string, home?: string): InflightItem[];
/** The refusal when nobody is registered yet; the wording `rig gateway human list` uses for an empty registry. */
export declare const NO_HUMAN_CONFIGURED = "no human configured yet \u2014 register one: rig gateway human add <entityId> --display-name \u2026 --binding \u2026 --delivery-class \u2026";
export type LoadResult = {
    ok: true;
    entities: HumanFragment[];
}
/** `noHumans`: refused because nobody is registered yet (no fragments, nothing projected), not a broken registry. */
 | {
    ok: false;
    error: string;
    noHumans?: true;
};
/** Load the registry via the projection, but REFUSE a hand-edited/drifted projection:
 *  the fragments are truth, so identities always come from a fresh fragment projection.
 *  A canonical snapshot from an adopted projection format is compatible and is
 *  rewritten atomically; malformed/non-canonical bytes remain a loud error. */
export declare function loadHumanRegistry(home?: string, opts?: {
    readOnly?: boolean;
}): LoadResult;
/** Resolve every registered spelling of a human to its canonical external address.
 * Identity comes from the registry entity, never from a domain/suffix allow-list. */
export declare function resolveRegisteredHumanAddress(sessionRef: string | null | undefined, entities: readonly HumanFragment[]): string | null;
//# sourceMappingURL=human-registry.d.ts.map