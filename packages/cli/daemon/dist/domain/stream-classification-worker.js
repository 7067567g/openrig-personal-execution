import { ClassifierLeaseError } from "./classifier-lease-manager.js";
import { ClassificationAttemptError, MAX_ELIGIBLE_PAGE } from "./classification-attempts.js";
import { ProjectClassifierError } from "./project-classifier.js";
export const LABEL_FIELDS = ["classificationType", "classificationUrgency", "classificationMaturity", "classificationConfidence",
    "classificationDestination", "area", "scopeRef"];
/**
 * Offline/agent-owned worker core. It is NOT instantiated by daemon startup.
 * A selected occupant calls wake() from the existing watchdog/wake cadence.
 * There is no polling loop, scheduler registration, provider or per-item queue here.
 * Notification loss/overflow is harmless: each wake reads one bounded eligible page
 * from its beginning. The durable ledger, not a high-water cursor, excludes done work.
 */
export class StreamClassificationWorker {
    options;
    now;
    pageSize;
    timeoutMs;
    backoffMs;
    lease = null;
    heartbeatAt = 0;
    acquireAfter = 0;
    busy = false;
    // One coalesced hint, no buffer of item IDs or automatic per-item work.
    hinted = false;
    // A deadline bounds wake(), not the injected operation. Never pile up calls when
    // a classifier ignores AbortSignal. A late settlement is discarded and clears this slot.
    pending = false;
    constructor(options) {
        for (const key of ["session", "classifierVersion", "taxonomyVersion", "evidenceEpoch"])
            nonblank(options[key], key);
        nonblank(options.candidates.version, "candidateSetVersion");
        for (const field of LABEL_FIELDS) {
            if (!Array.isArray(options.candidates.values[field]))
                throw Error(`missing candidate list: ${field}`);
            for (const value of options.candidates.values[field])
                nonblank(value, field);
        }
        if (!Array.isArray(options.candidates.duplicateCandidates) || !Array.isArray(options.candidates.relatedRefs))
            throw Error("candidate evidence lists must be arrays");
        for (const c of options.candidates.duplicateCandidates) {
            nonblank(c.streamItemId, "duplicate candidate");
            nonblank(c.evidenceRef, "duplicate evidence");
        }
        for (const ref of options.candidates.relatedRefs)
            nonblank(ref, "relatedRef");
        this.options = { ...options, candidates: freeze(structuredClone(options.candidates)) };
        this.now = options.now ?? (() => new Date());
        this.pageSize = bounded(options.pageSize ?? 20, 1, MAX_ELIGIBLE_PAGE, "pageSize");
        this.timeoutMs = bounded(options.requestTimeoutMs ?? 30_000, 1, 60_000, "requestTimeoutMs");
        this.backoffMs = bounded(options.leaseBackoffMs ?? 60_000, 1_000, 300_000, "leaseBackoffMs");
    }
    /** Optional live/reconnect hint. Calling it a million times stores one boolean. */
    notify() { this.hinted = true; }
    /** Subscribe before the first catch-up; events only coalesce a hint, never start work. */
    subscribe(bus) {
        const unsubscribe = bus.subscribe(event => { if (event.type === "stream.emitted")
            this.notify(); });
        this.notify(); // reconnect needs durable catch-up even if no new event arrives.
        return unsubscribe;
    }
    /** A descriptor for the EXISTING policy; returning it does not register anything. */
    wakeRegistration(registeredBySession, targetGenerationUuid) {
        nonblank(registeredBySession, "registeredBySession");
        if (!this.lease)
            throw Error("acquire a lease before selecting the wake cadence");
        const intervalSeconds = Math.floor(this.leasePeriod() / 1000);
        if (intervalSeconds < 1)
            throw Error("lease TTL is too short for the existing seconds-based scheduler");
        return {
            policy: "periodic-reminder", targetSession: this.options.session, registeredBySession, targetGenerationUuid,
            intervalSeconds,
            specYaml: JSON.stringify({ target: { session: this.options.session }, message: "Run one bounded stream-classification wake; preserve lease and execution fences." }),
        };
    }
    async wake() {
        const result = { state: "processed", nextWakeAt: this.now().toISOString(), moreEligible: false, outcomes: [] };
        if (this.busy)
            return { ...result, state: "busy" };
        if (this.pending)
            return { ...result, state: "classifier_pending", nextWakeAt: new Date(this.now().getTime() + this.backoffMs).toISOString() };
        if (this.now().getTime() < this.acquireAfter)
            return { ...result, state: "lease_backoff", nextWakeAt: new Date(this.acquireAfter).toISOString() };
        this.busy = true;
        this.hinted = false;
        const o = this.options;
        try {
            if (this.stopped())
                return { ...result, state: "stopped" };
            if (!this.lease) {
                await o.leases.evaluateDeadness();
                this.lease = await o.leases.acquire(o.session);
                this.heartbeatAt = Date.parse(this.lease.lastHeartbeat) + this.leasePeriod();
            }
            await this.maintainLease();
            const page = await o.attempts.eligible({ classifierVersion: o.classifierVersion, taxonomyVersion: o.taxonomyVersion,
                evidenceEpoch: o.evidenceEpoch, limit: this.pageSize });
            result.moreEligible = page.nextAfterSortKey !== null;
            for (const item of page.items) {
                if (this.stopped()) {
                    result.state = "stopped";
                    result.moreEligible = true;
                    break;
                }
                await this.maintainLease();
                let attempt;
                try {
                    attempt = await o.attempts.begin({ streamItemId: item.streamItemId, classifierVersion: o.classifierVersion,
                        taxonomyVersion: o.taxonomyVersion, evidenceEpoch: o.evidenceEpoch, leaseId: this.lease.leaseId, classifierSession: o.session });
                }
                catch (error) {
                    if (!(error instanceof ClassificationAttemptError))
                        throw error;
                    result.outcomes.push({ streamItemId: item.streamItemId, status: error.code });
                    continue;
                }
                // Never let the injected classifier rewrite the finishing execution identity.
                const finish = Object.freeze({ attemptId: attempt.attemptId, executionId: attempt.executionId,
                    leaseId: attempt.leaseId, classifierSession: o.session });
                try {
                    const source = await o.stream.getById(item.streamItemId);
                    if (!source)
                        throw Error("stream item unavailable");
                    const decision = await this.decide(freeze({ item: structuredClone(source), attempt: { ...attempt }, candidates: o.candidates }));
                    await this.maintainLease(); // refuses expiry/replacement before heartbeat; transaction checks again.
                    if (this.stopped()) {
                        await o.attempts.abstain({ ...finish, reason: "experiment stopped; result not applied" });
                        result.outcomes.push({ streamItemId: item.streamItemId, status: "abstained", reason: "stopped" });
                        result.state = "stopped";
                        result.moreEligible = true;
                        break;
                    }
                    if (decision.kind === "abstain") {
                        nonblank(decision.reason, "abstention reason");
                        await o.attempts.abstain({ ...finish, reason: decision.reason });
                        result.outcomes.push({ streamItemId: item.streamItemId, status: "abstained" });
                    }
                    else if (decision.kind === "classify") {
                        const labels = this.labels(decision.labels);
                        await o.classifier.classify({ ...labels, ...finish, streamItemId: item.streamItemId,
                            classifierVersion: o.classifierVersion, taxonomyVersion: o.taxonomyVersion, candidateSetVersion: o.candidates.version,
                            identityProvenance: "claimed:v1" }); // direct offline caller; no transport claim invented.
                        result.outcomes.push({ streamItemId: item.streamItemId, status: "written" });
                    }
                    else
                        throw Error("unknown classifier decision");
                }
                catch (error) {
                    if (error instanceof ClassifierLeaseError)
                        throw error;
                    const code = error instanceof ProjectClassifierError || error instanceof ClassificationAttemptError ? error.code : null;
                    if (code === "idempotency_violation" || code === "already_classified" || code === "attempt_superseded" || code === "attempt_mismatch") {
                        result.outcomes.push({ streamItemId: item.streamItemId, status: code });
                    }
                    else {
                        try {
                            const failed = await o.attempts.fail({ ...finish, reason: error instanceof Error ? error.message : "classifier failed" });
                            result.outcomes.push({ streamItemId: item.streamItemId, status: failed.status, reason: failed.reason ?? undefined });
                        }
                        catch (finishError) {
                            if (finishError instanceof ClassifierLeaseError)
                                throw finishError;
                            if (!(finishError instanceof ClassificationAttemptError))
                                throw finishError;
                            result.outcomes.push({ streamItemId: item.streamItemId, status: finishError.code });
                        }
                    }
                }
                if (this.pending) {
                    result.moreEligible = true;
                    break;
                } // cancellation unconfirmed; no second operation.
            }
            result.moreEligible ||= this.hinted;
            result.nextWakeAt = new Date(this.heartbeatAt).toISOString();
            return result;
        }
        catch (error) {
            if (!(error instanceof ClassifierLeaseError)) {
                this.acquireAfter = this.now().getTime() + this.backoffMs;
                return { ...result, state: "unavailable", reason: error instanceof Error ? error.message : "worker source unavailable", nextWakeAt: new Date(this.acquireAfter).toISOString() };
            }
            this.lease = null;
            this.acquireAfter = this.now().getTime() + this.backoffMs;
            return { ...result, state: "lease_lost", reason: error.code, nextWakeAt: new Date(this.acquireAfter).toISOString() };
        }
        finally {
            this.busy = false;
        }
    }
    leasePeriod() {
        return Math.max(1, Math.floor((Date.parse(this.lease.expiresAt) - Date.parse(this.lease.lastHeartbeat)) / 3));
    }
    async maintainLease() {
        const o = this.options;
        await o.leases.requireActiveHolder(o.session, this.lease.leaseId);
        if (this.now().getTime() >= this.heartbeatAt) {
            this.lease = await o.leases.heartbeat(this.lease.leaseId, o.session);
            this.heartbeatAt = Date.parse(this.lease.lastHeartbeat) + this.leasePeriod();
        }
    }
    async decide(request) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        this.options.signal?.addEventListener("abort", abort, { once: true });
        if (this.options.signal?.aborted)
            abort();
        this.pending = true;
        let timer;
        // Only this caller consumes the promise; the settled handler never writes a result.
        const operation = Promise.resolve().then(() => this.options.classify(request, controller.signal))
            .finally(() => { this.pending = false; });
        try {
            return await Promise.race([operation, new Promise((_, reject) => {
                    timer = setTimeout(() => { reject(Error("classifier deadline exceeded")); controller.abort(); }, Math.max(1, Math.min(this.timeoutMs, this.heartbeatAt - this.now().getTime())));
                })]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
            this.options.signal?.removeEventListener("abort", abort);
        }
    }
    stopped() { return !!this.options.signal?.aborted || !!this.options.shouldStop?.(); }
    labels(labels) {
        if (!labels || typeof labels !== "object")
            throw Error("classification labels must be an object");
        const out = {};
        for (const field of LABEL_FIELDS) {
            const value = labels[field];
            if (value === undefined || value === null)
                continue;
            if (typeof value !== "string" || !this.options.candidates.values[field].includes(value))
                throw Error(`unavailable candidate: ${field}`);
            out[field] = value;
        }
        if (labels.needsHuman != null && typeof labels.needsHuman !== "boolean")
            throw Error("needsHuman must be boolean or unknown");
        out.needsHuman = labels.needsHuman ?? null;
        if (labels.duplicateOfStreamItemId != null) {
            if (!this.options.candidates.duplicateCandidates.some(c => c.streamItemId === labels.duplicateOfStreamItemId && c.evidenceRef === labels.duplicateEvidenceRef && c.evidenceRef.trim())) {
                throw Error("duplicate requires a positive supplied candidate and evidence reference");
            }
            out.duplicateOfStreamItemId = labels.duplicateOfStreamItemId;
        }
        return out;
    }
}
function nonblank(value, name) {
    if (typeof value !== "string" || !value.trim())
        throw Error(`${name} must be a non-empty string`);
}
function bounded(value, min, max, name) {
    if (!Number.isInteger(value) || value < min || value > max)
        throw Error(`${name} must be an integer in ${min}..${max}`);
    return value;
}
function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
//# sourceMappingURL=stream-classification-worker.js.map