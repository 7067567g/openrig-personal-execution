export const rigNonInterruptiveSchema = {
    name: "095_rig_non_interruptive.sql",
    sql: "ALTER TABLE rigs ADD COLUMN non_interruptive INTEGER NOT NULL DEFAULT 0 CHECK (non_interruptive IN (0, 1));",
};
//# sourceMappingURL=095_rig_non_interruptive.js.map