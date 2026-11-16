/** OMP's documented reassembly ceiling; an advertised limit above it is not trusted. */
export declare const OMP_MAX_REASSEMBLED_FRAME_BYTES: number;
/** OMP's documented physical frame limit, the line's LF included. Under v2 no stdout line may exceed it. */
export declare const OMP_MAX_FRAME_BYTES: number;
/** The most chunks one sequence can have: OMP v18.5.0 sends 256 KiB payloads, so 64 MiB is 256 chunks. */
export declare const OMP_MAX_CHUNKS = 256;
/** The reassembly limit to negotiate under, when the ready frame advertises protocol v2; otherwise null (stay on v1). */
export declare function ompProtocolV2Limit(ready: Record<string, unknown>): number | null;
export type OmpFrameResult = 
/** A whole frame: a plain line, or a completed chunk sequence. `dropped` names a sequence the frame interrupted. */
{
    frame: Record<string, unknown>;
    dropped?: string;
}
/** A chunk was accepted; the sequence isn't complete yet. */
 | {
    pending: true;
}
/** A chunk sequence was rejected and discarded. Its remaining chunks are skipped without another error. */
 | {
    dropped: string;
}
/** A chunk of a sequence already rejected. */
 | {
    skipped: true;
};
/** Reassembles protocol v2 `rpc_chunk` sequences from parsed stdout lines. Holds at most one sequence, never more
 *  than `limitBytes` of it, and checks each chunk's declared length against the limit before keeping any of it. */
export declare class OmpFrameDecoder {
    private readonly limitBytes;
    private pending;
    /** Sequences already reported as rejected (at most two: an interleaving pair); their later chunks are skipped until
     *  a frame or line outside any sequence arrives. */
    private readonly rejected;
    /** A chunk without a usable chunkId was rejected: later chunks without one are skipped, not reported again. */
    private rejectedAnonymous;
    constructor(limitBytes: number);
    /** The sequence still waiting for chunks, if any: at end of stream it can never complete. */
    incomplete(): string | null;
    /** A stdout line that isn't a frame (not JSON, or not an object) arrived: a pending sequence is interrupted. */
    interrupt(what: string): string | null;
    /** A line rejected before it was parsed (over the physical frame limit). A pending sequence is dropped with it, and
     *  so is the line's own sequence when its chunkId is known, so its later chunks aren't reported again. */
    rejectLine(reason: string, chunkId?: string): string | null;
    /** A frame or line outside any sequence ends the skipping of a rejected one: OMP writes each sequence
     *  uninterrupted, so its chunks can't continue past it. A stray late chunk then gets one "index 0" error. */
    private endSkipping;
    private drop;
    push(value: Record<string, unknown>): OmpFrameResult;
}
//# sourceMappingURL=omp-rpc-frame.d.ts.map