// #193 — structured questions on a human decision, and the answers recorded from clicks.
export const humanQuestionsSchema = {
    name: "091_human_questions.sql",
    sql: `
    ALTER TABLE queue_items ADD COLUMN human_questions TEXT;
    ALTER TABLE queue_items ADD COLUMN human_answers TEXT;
  `,
};
//# sourceMappingURL=091_human_questions.js.map