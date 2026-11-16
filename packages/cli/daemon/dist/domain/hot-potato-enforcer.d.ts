/**
 * Hot-potato strict-rejection contract (PL-004 Phase A).
 *
 * Load-bearing API contract: any code path that transitions a queue_item to
 * `done` MUST pass a valid `closure_reason` from the 6-value enum below. This
 * is enforced at this layer (NOT at the route, NOT at the CLI) so every
 * surface that reaches the queue inherits the same guarantee.
 *
 * The 6 valid closure reasons:
 *   - handed_off_to  : work continues with a different seat (closure_target = new owner)
 *   - blocked_on     : work is parked pending another qitem (closure_target = blocker qitem_id)
 *   - denied         : receiver rejected the work (closure_target = reason text)
 *   - canceled       : sender or receiver withdrew (closure_target = note)
 *   - no-follow-on   : terminal completion, nothing else needed
 *   - escalation     : kicked up to higher tier (closure_target = escalation target)
 */
export declare const CLOSURE_REASONS: readonly ["handed_off_to", "blocked_on", "denied", "canceled", "no-follow-on", "escalation", "superseded"];
export type ClosureReason = (typeof CLOSURE_REASONS)[number];
export interface ClosureRequest {
    state: string;
    closureReason?: string | null;
    closureTarget?: string | null;
}
export interface ClosureValidationOk {
    ok: true;
    closureReason: ClosureReason | null;
    closureTarget: string | null;
}
export interface ClosureValidationErr {
    ok: false;
    code: "missing_closure_reason" | "invalid_closure_reason" | "missing_closure_target";
    message: string;
    validReasons?: readonly string[];
}
export type ClosureValidation = ClosureValidationOk | ClosureValidationErr;
/**
 * Validate a state transition's closure obligation.
 * - If state !== "done": no closure_reason required; pass through any provided values.
 * - If state === "done": closure_reason REQUIRED, must be in CLOSURE_REASONS.
 *   handed_off_to / blocked_on / escalation also require closure_target.
 */
export declare function validateClosure(req: ClosureRequest): ClosureValidation;
export declare function isClosureReason(value: unknown): value is ClosureReason;
export declare function computeClosureRequiredAt(claimedAt: string, tier: string | null): string | null;
//# sourceMappingURL=hot-potato-enforcer.d.ts.map