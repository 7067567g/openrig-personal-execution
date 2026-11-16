export const nodeCodexConfigProfileSchema = {
    name: "022_node_codex_config_profile.sql",
    sql: `
    ALTER TABLE nodes ADD COLUMN codex_config_profile TEXT;
  `,
};
//# sourceMappingURL=022_node_codex_config_profile.js.map