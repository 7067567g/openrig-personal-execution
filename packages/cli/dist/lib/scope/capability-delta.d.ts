import type { AuditFinding } from "./scope-audit.js";
/**
 * Derive expiry advisories for versioned capability deltas at a mission root.
 * The event is deliberately conjunctive: canon must name the exact delta in its
 * header AND a distinct successor file must exist. Missing or unreadable inputs
 * remain unknown/live and never turn the advisory into a gate.
 */
export declare function capabilityDeltaExpiryFindings(missionDir: string): AuditFinding[];
//# sourceMappingURL=capability-delta.d.ts.map