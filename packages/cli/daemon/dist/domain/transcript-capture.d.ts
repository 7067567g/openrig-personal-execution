import type Database from "better-sqlite3";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { EventBus } from "./event-bus.js";
export declare function startTmuxTranscriptCapture(tmuxAdapter: TmuxAdapter | null | undefined, transcriptStore: TranscriptStore | null | undefined, rigName: string, sessionName: string): Promise<{
    started: boolean;
    reason?: string;
}>;
/** End a seat's capture with its session, not only with its rig's teardown: a stopped seat, a removed node or pod
 *  and a cleaned dead seat each record their end with one of these events, emitted once tmux has no such session.
 *  An unclaim records `session.detached` too, but its session keeps running and its saved text stays readable: only
 *  a node removal deletes the node before notifying, so a detach whose node is gone is the one that ended.
 *  A relaunch under the same name starts capture again. */
export declare function wireTranscriptCaptureStops(db: Database.Database, eventBus: Pick<EventBus, "subscribe">): () => void;
/** Restore process-local rotation timers after daemon restart. */
export declare function resumeRunningTranscriptCaptures(db: Database.Database, tmuxAdapter: TmuxAdapter | null | undefined, transcriptStore: TranscriptStore | null | undefined): Promise<number>;
//# sourceMappingURL=transcript-capture.d.ts.map