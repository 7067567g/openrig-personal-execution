import type { PsEntry } from "./ps-projection.js";
import type { Rig } from "./types.js";
import type { SearchResult, ChatSearchResult, SeatSearchResult, SeatHit, SessionSearchResult } from "./history-query.js";
import type { RigWithRelations } from "./types.js";
import type { WhoamiResult } from "./whoami-service.js";
export type { ChatSearchResult };
export interface AskDeps {
    psProjectionService: {
        getEntries(): PsEntry[];
    };
    rigRepo: {
        findRigsByName(name: string): Rig[];
        getRig(rigId: string): RigWithRelations | null;
    };
    historyQuery: {
        search(rigName: string, question: string): Promise<SearchResult>;
        searchChat(rigId: string, question: string): ChatSearchResult[];
        searchSeat(rigName: string, seatSessionName: string, question: string): Promise<SeatSearchResult>;
        searchSession(sessionToken: string, question: string): Promise<SessionSearchResult>;
    };
    transcriptsEnabled: boolean;
    whoamiService?: {
        resolve(query: {
            nodeId?: string;
            sessionName?: string;
        }): WhoamiResult | null;
    };
}
export interface AskRigInfo {
    name: string;
    status: string;
    nodeCount: number;
    runningCount: number;
    uptime: string | null;
}
export interface AskSeatEvidence {
    name: string;
    generations: number;
    hits: SeatHit[];
    degraded?: {
        reason: string;
        message: string;
    };
    advisory?: string;
}
export interface AskSessionEvidence {
    token: string;
    found: boolean;
    path?: string;
    excerpts: string[];
    degraded?: {
        reason: string;
        message: string;
    };
    advisory?: string;
}
export interface AskResult {
    question: string;
    rig: AskRigInfo | null;
    evidence: {
        backend: string;
        excerpts: string[];
        chatExcerpts?: string[];
    };
    /** L1 seat-scoped evidence — present only when a seat was addressed. */
    seat?: AskSeatEvidence;
    /** L2 session-scoped evidence — present only when a session token was addressed. */
    session?: AskSessionEvidence;
    insufficient: boolean;
    guidance?: string;
}
export declare class AskService {
    private readonly deps;
    constructor(deps: AskDeps);
    ask(rigName: string, question: string, context?: {
        nodeId?: string;
        sessionName?: string;
        seat?: string;
        session?: string;
    }): Promise<AskResult>;
    private answerStructuredQuestion;
    private resolveIdentity;
    private looksLikePeerQuestion;
    private formatPeerLine;
}
//# sourceMappingURL=ask-service.d.ts.map