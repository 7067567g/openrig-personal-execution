export interface HumanQuestionOption {
    id: string;
    label: string;
    recommended?: boolean;
}
export interface HumanQuestion {
    id: string;
    question: string;
    options: HumanQuestionOption[];
}
/** A whole thread reply, not a button choice or a human-selected question. */
export interface TypedHumanReply {
    kind: "typed-reply";
    text: string;
    placement: "first-unanswered";
    /** Other question slots still empty immediately after this reply's placement. */
    unansweredCount: number;
}
/** questionId → chosen optionId (string) or explicitly tagged whole typed reply. */
export type HumanAnswers = Record<string, string | TypedHumanReply>;
/** The outcome of recording one clicked answer (QueueRepository.recordHumanAnswer). */
export type RecordHumanAnswerResult = {
    status: "recorded";
    answers: HumanAnswers;
    complete: boolean;
    questions: HumanQuestion[];
}
/** answerOnRecord: the decision is no longer pending, and this asked human's clicked answer is the one it holds. */
 | {
    status: "not-applicable";
    reason: string;
    answerOnRecord?: true;
};
export declare const MAX_HUMAN_QUESTIONS = 4;
export declare const MIN_OPTIONS = 2;
export declare const MAX_OPTIONS = 4;
export declare const MAX_OPTION_LABEL = 75;
export declare const MAX_QUESTION_TEXT = 500;
export type HumanQuestionsParse = {
    ok: true;
    questions: HumanQuestion[];
} | {
    ok: false;
    error: string;
};
/** Validate an authored questions value. Returns a normalized copy (only known fields kept). */
export declare function parseHumanQuestions(value: unknown): HumanQuestionsParse;
export declare function describeTypedReplyPlacement(question: HumanQuestion, reply: TypedHumanReply): string;
/** Button choices use option labels; typed replies keep their words and placement provenance. */
export declare function formatHumanAnswers(questions: readonly HumanQuestion[], answers: HumanAnswers): string[];
/** The questions still waiting for an answer. */
export declare function unansweredQuestions(questions: readonly HumanQuestion[], answers: HumanAnswers): HumanQuestion[];
//# sourceMappingURL=human-questions.d.ts.map