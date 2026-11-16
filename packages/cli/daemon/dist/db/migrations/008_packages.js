export const packagesSchema = {
    name: "008_packages.sql",
    sql: `
    CREATE TABLE packages (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      version         TEXT NOT NULL,
      source_kind     TEXT NOT NULL,
      source_ref      TEXT NOT NULL,
      manifest_hash   TEXT NOT NULL,
      summary         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, version)
    );
  `,
};
//# sourceMappingURL=008_packages.js.map