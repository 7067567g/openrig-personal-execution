import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, rmdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { getDefaultOpenRigPath } from "./openrig-compat.js";
export function defaultHostBindingsPath() {
    return getDefaultOpenRigPath("host-bindings.json");
}
/** Load the sidecar. Fail-open by contract: missing, unreadable, or corrupt → empty bindings
 *  (a broken sidecar must never break resolution; delete it to re-learn). */
export function loadHostBindings(path = defaultHostBindingsPath()) {
    const empty = { version: 1, bindings: {} };
    if (!existsSync(path))
        return empty;
    try {
        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        if (!parsed || typeof parsed !== "object")
            return empty;
        // A declared version other than 1 is a FUTURE sidecar shape — treat it as unreadable (empty,
        // fail-open) rather than mis-parsing v2 fields through v1 eyes. Absent version reads as v1
        // (files this code wrote always carry it; hand-trimmed ones stay readable).
        const version = parsed.version;
        if (version !== undefined && version !== 1)
            return empty;
        const bindings = parsed.bindings;
        if (!bindings || typeof bindings !== "object")
            return empty;
        const out = {};
        for (const [alias, b] of Object.entries(bindings)) {
            if (!b || typeof b !== "object")
                continue;
            const bb = b;
            if (typeof bb["hostId"] !== "string" || bb["hostId"].length === 0)
                continue;
            out[alias] = {
                hostId: bb["hostId"],
                firstObservedAt: typeof bb["firstObservedAt"] === "string" ? bb["firstObservedAt"] : "",
                lastObservedAt: typeof bb["lastObservedAt"] === "string" ? bb["lastObservedAt"] : "",
                ...(bb["conflict"] && typeof bb["conflict"] === "object"
                    && typeof bb["conflict"]["hostId"] === "string"
                    ? {
                        conflict: {
                            hostId: bb["conflict"]["hostId"],
                            observedAt: typeof bb["conflict"]["observedAt"] === "string"
                                ? bb["conflict"]["observedAt"]
                                : "",
                        },
                    }
                    : {}),
            };
        }
        return { version: 1, bindings: out };
    }
    catch {
        return empty;
    }
}
// r1 B4 follow-on (F2) — the read-modify-write needs a concurrency guard: 15 seats run
// send/capture/doctor concurrently, and an interleaved write could erase a sibling's binding —
// benign for a BINDING (TOFU re-learns) but not for a CONFLICT record, whose loss is the exact
// silence the known_hosts lesson forbids. Guard: an mkdir-based advisory lock (atomic on every
// platform) held across load→mutate→rename, with sleeping retries and a stale-lock takeover. A
// waiter sleeps rather than spins, so it never starves the holder of CPU, and it waits past the
// stale threshold, so a slow holder is waited out or taken over instead of written over. The write
// proceeds UNGUARDED (fail-open — availability over the rare loss; the conflict re-records on the
// next contradicting observation) only when the lock can't be created at all, or isn't won by the
// wait's end.
const LOCK_RETRY_MS = 5;
// NAMED TAIL (r1 F2 review, not built for): after a stale takeover the ORIGINAL holder still
// believes it holds the lock, so its release rmdirs the NEW holder's lock — in principle that
// cascades. Low: the critical section is fully synchronous (the loop cannot preempt it) and 2s is
// ~3 orders of magnitude over normal hold time — but this box has run loadavg 9-11 with
// multi-minute stalls, so the tail is not zero. The token-verified-release fix is more machinery
// than a fail-open advisory lock over a self-healing cache justifies.
const LOCK_STALE_MS = 2_000;
const LOCK_WAIT_MS = LOCK_STALE_MS + 1_000;
const sleepCell = new Int32Array(new SharedArrayBuffer(4));
function acquireLock(lockDir) {
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
        try {
            mkdirSync(lockDir);
            return true;
        }
        catch (err) {
            if (err.code !== "EEXIST")
                return false;
            try {
                if (Date.now() - statSync(lockDir).mtimeMs > LOCK_STALE_MS)
                    rmdirSync(lockDir);
            }
            catch {
                /* raced away — retry */
            }
            if (Date.now() >= deadline)
                return false;
            Atomics.wait(sleepCell, 0, 0, LOCK_RETRY_MS); // a real sleep in a sync API
        }
    }
}
function releaseLock(lockDir) {
    try {
        rmdirSync(lockDir);
    }
    catch { /* best-effort */ }
}
/**
 * Record one observation of `observedHostId` for registry alias `alias` (TOFU + loud-conflict).
 * Persists via write-temp-then-rename so a crashed writer never leaves a torn file.
 */
export function recordHostObservation(args) {
    const path = args.path ?? defaultHostBindingsPath();
    const at = (args.now ?? (() => new Date()))().toISOString();
    mkdirSync(dirname(path), { recursive: true });
    const lockDir = `${path}.lock`;
    const locked = acquireLock(lockDir);
    try {
        return recordUnderLock(args.alias, args.observedHostId, at, path);
    }
    finally {
        if (locked)
            releaseLock(lockDir);
    }
}
function recordUnderLock(alias, observedHostId, at, path) {
    const file = loadHostBindings(path);
    const existing = file.bindings[alias];
    let result;
    if (!existing) {
        const binding = { hostId: observedHostId, firstObservedAt: at, lastObservedAt: at };
        file.bindings[alias] = binding;
        result = { outcome: "bound", binding };
    }
    else if (existing.hostId === observedHostId) {
        const binding = { ...existing, lastObservedAt: at };
        // A re-observation of the ORIGINAL id after a recorded conflict does not clear the conflict —
        // a flapping identity is more alarming than a stable contradiction, not less.
        file.bindings[alias] = binding;
        result = { outcome: "confirmed", binding };
    }
    else {
        const binding = { ...existing, conflict: { hostId: observedHostId, observedAt: at } };
        file.bindings[alias] = binding;
        result = { outcome: "conflict", binding };
    }
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n", "utf-8");
    renameSync(tmp, path);
    return result;
}
/** One line naming both ids, shared by every loud surface (ls flag detail, doctor row, resolution
 *  warning) so the operator reads the same story everywhere. */
export function describeBindingConflict(alias, binding) {
    return `host '${alias}': observed self-id '${binding.conflict?.hostId}' contradicts the learned binding '${binding.hostId}' — a host's self-id is minted once, so this is a re-key or a mis-registration. If the re-key is legitimate, delete the '${alias}' entry in ${defaultHostBindingsPath()} to re-learn (TOFU).`;
}
//# sourceMappingURL=host-bindings.js.map