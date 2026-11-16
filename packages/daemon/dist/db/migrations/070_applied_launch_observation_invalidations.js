// W3 cutover truth: once a generation's process is physically gone, no delayed
// startup/restore completion may recreate its applied-launch observation.
export const appliedLaunchObservationInvalidationsSchema = {
    name: "070_applied_launch_observation_invalidations.sql",
    sql: `
    CREATE TABLE applied_launch_observation_invalidations (
      generation_uuid TEXT PRIMARY KEY REFERENCES occupant_tenures(generation_uuid) ON DELETE CASCADE,
      invalidated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,
};
//# sourceMappingURL=070_applied_launch_observation_invalidations.js.map