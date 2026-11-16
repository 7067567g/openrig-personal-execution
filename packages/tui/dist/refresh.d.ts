/** Coalesce overlapping refresh requests with a TRAILING pass (Wave-O B3, R2 508e383d).
 *
 * The old shape returned the active promise for every overlapping request, so an
 * oracle push arriving AFTER the in-flight hydrate had read its snapshot but BEFORE it
 * settled simply disappeared — the open view stayed stale (AM-R18 violation). Now an
 * overlapping request marks the flight DIRTY and the runner performs at most ONE
 * trailing pass per overlap window before settling: every event window is represented,
 * work stays bounded (N overlapping requests = one trailing run), a quiet refresh does
 * exactly one pass, and a task failure neither breaks the loop nor rejects the caller
 * (the task itself owns error handling; the guard here is belt-and-braces). */
export declare function singleFlight(task: () => Promise<void>): () => Promise<void>;
//# sourceMappingURL=refresh.d.ts.map