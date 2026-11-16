export type ParsedSessionName = {
    kind: "canonical";
    member: string;
    rig: string;
} | {
    kind: "legacy";
    name: string;
} | {
    kind: "external";
    local: string;
    domain: string;
} | {
    kind: "malformed";
    error: "malformed_session_name";
    input: string;
};
export declare const VIRTUAL_DOMAIN_TOKENS: readonly ["external"];
/** Arch tooth 1: human-CLASS classification runs BEFORE any parse at sites where
 *  the human/agent distinction matters (the queue-destination gate + attention
 *  union). A2 widened it: virtual-domain refs (<local>@external) are human-CLASS
 *  too (they join human-route enforcement; NEVER a silent agent-class downgrade).
 *  Admission stays at the A1/A4 gateway. */
export declare function isHumanSeatSessionRef(sessionRef: string): boolean;
export declare function parseSessionName(raw: string): ParsedSessionName;
/** Display: the member/local leg — text before the first "@", or the whole
 *  string when no "@" is present (the shipped split("@")[0] rendering,
 *  verbatim: "@rig" yields ""). */
export declare function sessionMemberLabel(session: string): string;
/** Routing/grouping: the rig leg of a canonical name, else undefined. */
export declare function sessionRigOf(session: string): string | undefined;
//# sourceMappingURL=session-name.d.ts.map