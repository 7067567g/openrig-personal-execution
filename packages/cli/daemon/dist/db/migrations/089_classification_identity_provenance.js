// S02 P3 allocation: nullable so historical, unstamped rows stay distinguishable.
export const classificationIdentityProvenanceSchema = {
    name: "089_classification_identity_provenance.sql",
    sql: "ALTER TABLE project_classifications ADD COLUMN identity_provenance TEXT;",
};
//# sourceMappingURL=089_classification_identity_provenance.js.map