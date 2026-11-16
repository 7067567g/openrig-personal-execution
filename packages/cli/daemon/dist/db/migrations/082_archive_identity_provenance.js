/** Carry audit identity through retention. Existing archive rows remain unknown;
 * only separately verified source evidence can justify recovering a lost value. */
export const archiveIdentityProvenanceSchema = {
    name: "082_archive_identity_provenance.sql",
    sql: "ALTER TABLE queue_transitions_archive ADD COLUMN identity_provenance TEXT;",
};
//# sourceMappingURL=082_archive_identity_provenance.js.map