// #75 — per-seat reasoning effort configuration for Claude and Codex.
export const nodeEffortSchema = {
    name: "092_node_effort.sql",
    sql: `
    ALTER TABLE nodes ADD COLUMN effort TEXT;
  `,
};
//# sourceMappingURL=092_node_effort.js.map