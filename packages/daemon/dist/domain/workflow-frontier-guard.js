export function createWorkflowFrontierPredicate(db) {
    return (qitemId) => {
        // current_frontier is a JSON array column; a frontier membership
        // check is a containment probe on the serialized id. Scoped to
        // LIVE instances only — terminal instances hold no frontier.
        let row;
        try {
            row = db
                .prepare(`SELECT instance_id, workflow_name FROM workflow_instances
           WHERE status IN ('active','waiting') AND current_frontier_json LIKE ?
           LIMIT 1`)
                .get(`%"${qitemId}"%`);
        }
        catch (err) {
            // Pre-workflow schemas (no workflow_instances table): nothing to
            // guard — identical to the predicate-absent posture. ONLY that
            // case is tolerated: any other SQL error (e.g. a renamed column)
            // must fail LOUD — a swallowed error here silently disables a
            // correctness guard (VM-caught: the first draft ate its own
            // wrong-column error and the guard never fired).
            if (err instanceof Error && /no such table/i.test(err.message))
                return null;
            throw err;
        }
        if (!row?.instance_id)
            return null;
        return { instanceId: row.instance_id, workflowName: row.workflow_name ?? "(unknown)" };
    };
}
//# sourceMappingURL=workflow-frontier-guard.js.map