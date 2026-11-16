export { OPERATOR_HUMAN_DEFAULT_SLOT } from "./human-registry.js";
/** The identity a registered human contributes to admission (a projection of the A3
 *  fragment; the resolver only needs the key + address for admission). */
export interface RegisteredEntity {
    entityId: string;
    address: string;
}
export type ExternalResolution = {
    kind: "registered";
    entityId: string;
} | {
    kind: "scheme";
    scheme: string;
    handle: string;
} | {
    kind: "unregistered";
    local: string;
    error: string;
};
/** Resolve the `local` part of a `<local>@external` ref against the registered entities.
 *  A scheme form (`local` contains ':') is the literal-scheme mode — a one-off address,
 *  never a registry lookup. Otherwise the registered mode: `local` is the entityId. An
 *  absent entity is a LOUD structured teaching refusal, never a silent/agent-class fall. */
export declare function resolveExternal(local: string, entities: readonly RegisteredEntity[]): ExternalResolution;
//# sourceMappingURL=external-admission.d.ts.map