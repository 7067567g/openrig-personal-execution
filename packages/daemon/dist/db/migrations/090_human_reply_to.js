// #96: an update may post into an earlier qitem's Slack thread. Nullable: a row
// without it starts its own root, exactly as before.
export const humanReplyToSchema = {
    name: "090_human_reply_to.sql",
    sql: "ALTER TABLE queue_items ADD COLUMN reply_to TEXT;",
};
//# sourceMappingURL=090_human_reply_to.js.map