// PL-004 Phase C: shared policy contract types.
//
// Each watchdog policy implements `evaluate(job)` returning a
// PolicyEvaluation. Pure: no side-effects, no event-bus, no DB.
// The watchdog-policy-engine maps `action: send` to a delivery call,
// records meaningful outcomes via watchdog-history-log, and emits
// the corresponding RigEvent.
export {};
//# sourceMappingURL=types.js.map