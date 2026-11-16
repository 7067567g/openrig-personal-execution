/** Measured alias -> canonical model-id map (keys lower-cased, values canonical ids). The ONE
 *  mapping home for both spec validation and the runtime detector; extend only as further alias
 *  forms are measured.
 *
 *  NULL-PROTOTYPE on purpose (r2 BLOCKING-1, f7dfca0c round 2): pins are arbitrary user strings,
 *  and on an ordinary object a lookup like map["constructor"] or map["__proto__"] returns an
 *  INHERITED Object.prototype member instead of undefined — the detector then threw mid-pass and
 *  the advisory fabricated a canonical id. With no prototype, every non-measured key reads
 *  undefined and both consumers' `?? `/null fallbacks behave. Keep this representation when
 *  extending the map; the suites pin the prototype and the behavior. */
export declare const CANONICAL_MODEL_PINS: Record<string, string>;
/**
 * If `pin` is a known alias form, return a named advisory stating the canonical id; else null.
 * `where` locates the pin in the spec (e.g. "pods.dev.members.driver").
 */
export declare function aliasModelPinAdvisory(pin: unknown, where: string): string | null;
//# sourceMappingURL=spec-validation-advisory.d.ts.map