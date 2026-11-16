// OMP RPC protocol v2 framing, from the client side (#1275).
//
// OMP caps each stdout line at 1 MiB in protocol v1, and answers a larger response with
// `success: false, error: "RPC response exceeded the transport limit"`. Its `ready` frame can advertise
// protocol v2: after `negotiate_protocol`, a larger frame (response or event) arrives as a sequence of
// `rpc_chunk` lines carrying base64 segments of one JSON object, up to `maxReassembledFrameBytes`.
// This decoder follows OMP's documented contract (docs/rpc.md "Transport and Framing", checked against
// v18.5.0): validate chunkId, index, count and byteLength, reject interrupted or interleaved sequences,
// enforce the reassembly limit, concatenate in index order, decode strict UTF-8, parse one JSON object.
/** OMP's documented reassembly ceiling; an advertised limit above it is not trusted. */
export const OMP_MAX_REASSEMBLED_FRAME_BYTES = 64 * 1024 * 1024;
/** OMP's documented physical frame limit, the line's LF included. Under v2 no stdout line may exceed it. */
export const OMP_MAX_FRAME_BYTES = 1024 * 1024;
/** The most chunks one sequence can have: OMP v18.5.0 sends 256 KiB payloads, so 64 MiB is 256 chunks. */
export const OMP_MAX_CHUNKS = 256;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** The reassembly limit to negotiate under, when the ready frame advertises protocol v2; otherwise null (stay on v1). */
export function ompProtocolV2Limit(ready) {
    const versions = ready.supportedProtocolVersions;
    if (!Array.isArray(versions) || !versions.includes(2))
        return null;
    const advertised = ready.maxReassembledFrameBytes;
    return typeof advertised === "number" && Number.isSafeInteger(advertised) && advertised > 0
        ? Math.min(advertised, OMP_MAX_REASSEMBLED_FRAME_BYTES)
        : OMP_MAX_REASSEMBLED_FRAME_BYTES;
}
/** Reassembles protocol v2 `rpc_chunk` sequences from parsed stdout lines. Holds at most one sequence, never more
 *  than `limitBytes` of it, and checks each chunk's declared length against the limit before keeping any of it. */
export class OmpFrameDecoder {
    limitBytes;
    pending = null;
    /** Sequences already reported as rejected (at most two: an interleaving pair); their later chunks are skipped until
     *  a frame or line outside any sequence arrives. */
    rejected = new Set();
    /** A chunk without a usable chunkId was rejected: later chunks without one are skipped, not reported again. */
    rejectedAnonymous = false;
    constructor(limitBytes) {
        this.limitBytes = limitBytes;
    }
    /** The sequence still waiting for chunks, if any: at end of stream it can never complete. */
    incomplete() {
        return this.pending ? `chunk sequence ${this.pending.chunkId} ended after ${this.pending.nextIndex} of ${this.pending.count} chunks` : null;
    }
    /** A stdout line that isn't a frame (not JSON, or not an object) arrived: a pending sequence is interrupted. */
    interrupt(what) {
        if (!this.pending) {
            this.endSkipping();
            return null;
        }
        const { chunkId } = this.pending;
        this.drop(chunkId);
        return `chunk sequence ${chunkId} was interrupted by ${what}`;
    }
    /** A line rejected before it was parsed (over the physical frame limit). A pending sequence is dropped with it, and
     *  so is the line's own sequence when its chunkId is known, so its later chunks aren't reported again. */
    rejectLine(reason, chunkId) {
        // Another line of a sequence already reported: skipped, as push() skips its chunks.
        if (chunkId && !this.pending && this.rejected.has(chunkId))
            return null;
        const interrupted = this.pending?.chunkId;
        this.drop(interrupted);
        if (chunkId)
            this.rejected.add(chunkId);
        return interrupted && interrupted !== chunkId ? `${reason}; chunk sequence ${interrupted} was interrupted by it` : reason;
    }
    /** A frame or line outside any sequence ends the skipping of a rejected one: OMP writes each sequence
     *  uninterrupted, so its chunks can't continue past it. A stray late chunk then gets one "index 0" error. */
    endSkipping() {
        this.rejected.clear();
        this.rejectedAnonymous = false;
    }
    drop(chunkId) {
        this.pending = null;
        this.rejected.clear();
        this.rejectedAnonymous = false;
        if (chunkId)
            this.rejected.add(chunkId);
    }
    push(value) {
        if (value.type !== "rpc_chunk") {
            if (!this.pending) {
                this.endSkipping();
                return { frame: value };
            }
            const { chunkId } = this.pending;
            this.drop(chunkId);
            return { frame: value, dropped: `chunk sequence ${chunkId} was interrupted by a ${String(value.type)} frame` };
        }
        const { chunkId, index, count, byteLength, data } = value;
        const validId = typeof chunkId === "string" && chunkId.length > 0 && chunkId.length <= 128;
        if (validId ? this.rejected.has(chunkId) : this.rejectedAnonymous)
            return { skipped: true };
        const reject = (reason) => {
            this.drop(validId ? chunkId : undefined);
            if (!validId)
                this.rejectedAnonymous = true;
            return { dropped: reason };
        };
        if (!validId || !Number.isSafeInteger(index) || !Number.isSafeInteger(count) || !Number.isSafeInteger(byteLength)) {
            return reject("a chunk with invalid metadata");
        }
        const at = index, of = count, length = byteLength;
        if (length > this.limitBytes)
            return reject(`chunk sequence ${chunkId} declares ${length} bytes, above the ${this.limitBytes}-byte reassembly limit`);
        if (of < 2 || of > OMP_MAX_CHUNKS || at < 0 || at >= of || length < 1 || of > length)
            return reject(`chunk sequence ${chunkId} has invalid metadata`);
        if (typeof data !== "string" || data.length === 0 || data.length > OMP_MAX_FRAME_BYTES || !BASE64.test(data)) {
            return reject(`chunk sequence ${chunkId} has invalid chunk data`);
        }
        const bytes = Buffer.from(data, "base64");
        if (bytes.toString("base64") !== data)
            return reject(`chunk sequence ${chunkId} has invalid chunk data`);
        if (!this.pending) {
            if (at !== 0)
                return reject(`chunk sequence ${chunkId} did not start at index 0`);
            this.rejected.clear();
            this.rejectedAnonymous = false;
            this.pending = { chunkId, count: of, byteLength: length, nextIndex: 0, chunks: [], received: 0 };
        }
        else if (this.pending.chunkId !== chunkId) {
            const interrupted = this.pending.chunkId;
            // Both sequences are unusable: the interrupted one is incomplete, and the newcomer interleaved it.
            this.drop(interrupted);
            this.rejected.add(chunkId);
            return { dropped: `chunk sequence ${interrupted} was interleaved with ${chunkId}` };
        }
        const pending = this.pending;
        if (pending.count !== of || pending.byteLength !== length || pending.nextIndex !== at) {
            return reject(`chunk sequence ${chunkId} is out of order or changed its metadata`);
        }
        if (pending.received + bytes.byteLength > pending.byteLength)
            return reject(`chunk sequence ${chunkId} exceeds its declared length`);
        pending.chunks.push(bytes);
        pending.received += bytes.byteLength;
        pending.nextIndex++;
        if (pending.nextIndex < pending.count)
            return { pending: true };
        this.pending = null;
        if (pending.received !== pending.byteLength)
            return reject(`chunk sequence ${chunkId} is shorter than its declared length`);
        let frame;
        try {
            frame = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(pending.chunks)));
        }
        catch {
            return reject(`chunk sequence ${chunkId} is not one UTF-8 JSON object`);
        }
        if (frame === null || typeof frame !== "object" || Array.isArray(frame))
            return reject(`chunk sequence ${chunkId} is not one JSON object`);
        return { frame: frame };
    }
}
//# sourceMappingURL=omp-rpc-frame.js.map