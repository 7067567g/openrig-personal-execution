import { type JsonlExchange } from "./session-jsonl.js";
import type { PredecessorRecapResolver } from "./seat-handover-service.js";
export interface PredecessorRecapResolverDeps {
    /** Claude: the name-keyed sidecar carries `transcript_path` + `session_id`; both ride the read so
     *  the caller can verify WHOSE record the name currently points at. */
    readClaudeRecord: (sessionName: string) => {
        transcriptPath: string | null;
        sessionId: string | null;
    };
    /** Codex: normalized usage carries `rollout_path`; resolve it from the thread id (resume token). */
    readCodexTranscriptPath: (args: {
        threadId: string | null;
        sessionName: string;
    }) => string | null;
    /** Look up the departing session's resume token by node + session name (codex thread id; for a
     *  claude row this is the predecessor's session uuid — the sidecar-ownership verifier). */
    lookupResumeToken: (nodeId: string, sessionName: string) => string | null;
    /** Injectable for tests; defaults to the real JSONL parser. */
    parseExchanges?: (path: string, n: number) => JsonlExchange[];
    /** Bounded recap size (default 6). */
    maxExchanges?: number;
    /** Per-exchange content cap in characters (default 500); over-cap content is visibly truncated. */
    maxCharsPerExchange?: number;
}
export declare function makePredecessorRecapResolver(deps: PredecessorRecapResolverDeps): PredecessorRecapResolver;
//# sourceMappingURL=predecessor-recap-resolver.d.ts.map