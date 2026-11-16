import { type CompletionContext } from "./registry.js";
/** Completion proposes text; execution still goes through parseCommand and dispatch. */
export declare function completeCommand(line: string, ctx: CompletionContext, context?: string): {
    line: string;
    candidates: string[];
    message: string;
};
//# sourceMappingURL=completion.d.ts.map