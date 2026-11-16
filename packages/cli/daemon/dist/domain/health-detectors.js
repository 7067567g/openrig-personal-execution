import { DEFAULT_HEALTH_POLICY } from "./health-policy.js";
import { adaptContextUsageEvidence, boundHealthEvidence, canonicalHealthJson, deriveHealthSourceFreshness, projectHealthRecord, } from "./health-projection.js";
import { queryUsageSeries } from "./usage-series.js";
import { parseSqliteUtcMs } from "./sqlite-time.js";
const CONTEXT_PRESSURE_PERCENT = 95;
const CONTEXT_CRITICAL_PERCENT = 99;
const LIVE_CONTEXT_RETENTION_SECONDS = 86_400;
const LIVE_CONTEXT_FRESHNESS_SECONDS = 600;
export const HEALTH_LIST_SCHEMA = "openrig.health-list/v0alpha1";
export function evaluateHealthDetectors(observations, policy = DEFAULT_HEALTH_POLICY) {
    const records = observations.flatMap((o) => evaluateObservation(o, policy)).filter((r) => !policy.disabledDetectors.includes(r.detector));
    return deduplicateHealthRecords(records);
}
function deduplicateHealthRecords(records) {
    const episodes = new Map();
    for (const record of records) {
        const previous = episodes.get(record.id);
        if (!previous || compareRecordRecency(record, previous) > 0)
            episodes.set(record.id, record);
    }
    return [...episodes.values()].sort((a, b) => a.detector.localeCompare(b.detector, "en-US") || a.id.localeCompare(b.id, "en-US"));
}
export function canonicalDetectorJson(records) {
    return canonicalHealthJson(records);
}
export class HealthProjectionService {
    source;
    policy;
    operatingPosture;
    lastCoverage = [];
    constructor(source, policy, operatingPosture) {
        this.source = source;
        this.policy = policy;
        this.operatingPosture = operatingPosture;
    }
    records() {
        this.lastCoverage = [];
        // Policy failure still fails the query: there is no trustworthy enable/disable decision.
        const policy = this.policy?.();
        const disabled = policy?.policy.disabledDetectors ?? [];
        const sources = Array.isArray(this.source) ? this.source : [this.source];
        const records = [];
        for (const source of sources) {
            if (source.detectors?.length && source.detectors.every((detector) => disabled.includes(detector)))
                continue;
            try {
                const observations = source.read();
                const coverage = source.coverage?.() ?? [];
                const evaluated = evaluateHealthDetectors(observations, policy?.policy).map((record) => ({
                    ...record,
                    ...(policy ? { policyVersion: policy.version } : {}),
                    ...(this.operatingPosture ? { operatingPosture: this.operatingPosture(record) } : {}),
                }));
                records.push(...evaluated);
                this.lastCoverage.push(...coverage);
            }
            catch (error) {
                // Discard this source's incomplete read and any earlier census. A limit or
                // genuine failure remains named; it is never fabricated as a zero count.
                this.lastCoverage.push({ source: source.name ?? "health-source", evaluatedAt: new Date().toISOString(),
                    status: "unavailable", partial: true, reason: error instanceof Error ? error.message : String(error) });
            }
        }
        return deduplicateHealthRecords(records);
    }
    coverage() {
        return [...this.lastCoverage];
    }
    list(query = {}) {
        const limit = query.limit ?? 100;
        if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
            throw new Error("limit must be an integer from 1 to 200");
        }
        const evaluated = this.records();
        const coverage = this.coverage();
        const filtered = evaluated.filter((record) => (query.scopeType === undefined || record.scope.type === query.scopeType)
            && (query.scopeId === undefined || healthScopeId(record.scope) === query.scopeId)
            && (query.severity === undefined || record.severity === query.severity)
            && (query.status === undefined ? record.status !== "cleared" : record.status === query.status))
            // Reserve visibility for the primary signal before the query cap. A hundred
            // context samples must not hide ceremony from the default CLI/TUI read.
            .sort((a, b) => Number(b.detector === "process.ceremony-amplification") - Number(a.detector === "process.ceremony-amplification"));
        return {
            schema: HEALTH_LIST_SCHEMA,
            evaluatedAt: newestEvaluatedAt(evaluated),
            total: filtered.length,
            limit,
            truncated: filtered.length > limit,
            records: filtered.slice(0, limit),
            ...(coverage.length ? { coverage } : {}),
        };
    }
    get(id) {
        return this.records().find((record) => record.id === id) ?? null;
    }
}
/** The live v1 adapter intentionally supplies only context observations. The other
 * detectors require structured product-change, directive, or admission facts that
 * current tables cannot express without inference. Replay sources can supply them. */
export class LiveContextHealthSource {
    deps;
    name = "live-context";
    detectors = ["context.pressure"];
    constructor(deps) {
        this.deps = deps;
    }
    read() {
        const evaluatedAt = (this.deps.now ?? (() => new Date()))().toISOString();
        const startedAt = new Date(Date.parse(evaluatedAt) - LIVE_CONTEXT_RETENTION_SECONDS * 1000).toISOString();
        const observations = [];
        const contextPressurePolicy = this.deps.resolveContextPressurePolicy?.() ?? {
            warningPercent: CONTEXT_PRESSURE_PERCENT,
            criticalPercent: CONTEXT_CRITICAL_PERCENT,
        };
        for (const rig of this.deps.rigRepo.listRigs()) {
            const detail = this.deps.rigRepo.getRig(rig.id);
            if (!detail)
                continue;
            const liveByNode = new Map(this.deps.sessionRegistry.getLatestLiveSessions(rig.id).map((session) => [session.nodeId, session]));
            const liveNodes = detail.nodes.filter((node) => liveByNode.has(node.id));
            const usageByNode = this.deps.contextUsageStore.getForNodes(liveNodes.map((node) => ({
                nodeId: node.id,
                currentSessionName: liveByNode.get(node.id)?.sessionName ?? null,
            })));
            for (const node of liveNodes) {
                const usage = usageByNode.get(node.id);
                if (!usage)
                    continue;
                const currentEvidence = adaptContextUsageEvidence(node.id, usage, 0);
                const liveSession = liveByNode.get(node.id);
                const tenureStartedAt = this.deps.sessionRegistry.currentOccupantTenure(node.id)?.bootAt ?? startedAt;
                const evidence = usage.availability === "known"
                    && usage.usedPercentage !== null
                    && usage.sampledAt !== null
                    ? selectContextEpisodeEvidence([
                        ...queryUsageSeries(this.deps.db, {
                            seatSession: liveSession.sessionName,
                            lane: "context",
                            sinceIso: startedAt,
                            limit: 10_000,
                        })
                            .filter((sample) => sample.nodeId === node.id
                            && sample.sampledAt !== null
                            && Date.parse(sample.sampledAt) >= parseSqliteUtcMs(tenureStartedAt)
                            && Date.parse(sample.sampledAt) <= Date.parse(usage.sampledAt))
                            .map((sample, sourceOrder) => ({
                            type: "context-usage",
                            sourceOrder,
                            observedAt: sample.sampledAt,
                            nodeId: node.id,
                            sessionId: liveSession.sessionId,
                            usedPercentage: sample.usedPercentage,
                            available: true,
                            fresh: Date.parse(evaluatedAt) - Date.parse(sample.sampledAt)
                                <= LIVE_CONTEXT_FRESHNESS_SECONDS * 1000,
                        })),
                        { ...currentEvidence, sourceOrder: Number.MAX_SAFE_INTEGER },
                    ], contextPressurePolicy.warningPercent)
                    : [currentEvidence];
                const freshness = deriveHealthSourceFreshness({
                    evaluatedAt,
                    newestSourceAt: usage.sampledAt,
                    maxAgeSeconds: LIVE_CONTEXT_FRESHNESS_SECONDS,
                    available: usage.availability === "known",
                });
                observations.push({
                    kind: "context-pressure",
                    scope: { type: "seat", rigId: rig.id, seatId: node.id },
                    episodeStartedAt: usage.sampledAt ?? startedAt,
                    lastObservedAt: usage.sampledAt ?? evaluatedAt,
                    sourceName: usage.source,
                    continuity: node.continuityOutcome ?? "unavailable",
                    warningPercent: contextPressurePolicy.warningPercent,
                    criticalPercent: contextPressurePolicy.criticalPercent,
                    source: boundHealthEvidence(evidence, {
                        source: "context-usage",
                        startedAt,
                        endedAt: evaluatedAt,
                        limit: 3,
                        retentionSeconds: LIVE_CONTEXT_RETENTION_SECONDS,
                    }, freshness),
                });
            }
        }
        return observations;
    }
}
function selectContextEpisodeEvidence(evidence, warningPercent = CONTEXT_PRESSURE_PERCENT) {
    const byTimestamp = new Map();
    for (const item of evidence) {
        if (item.type === "context-usage"
            && item.available
            && item.usedPercentage !== null
            && item.observedAt !== null)
            byTimestamp.set(item.observedAt, item);
    }
    const samples = [...byTimestamp.values()]
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt, "en-US"));
    const latest = samples.at(-1);
    if (!latest || latest.usedPercentage === null)
        return latest ? [latest] : [];
    let episodeEnd = latest.usedPercentage >= warningPercent ? samples.length - 1 : samples.length - 2;
    while (episodeEnd >= 0 && (samples[episodeEnd].usedPercentage ?? -Infinity) < warningPercent) {
        episodeEnd -= 1;
    }
    if (episodeEnd < 0)
        return [latest];
    let episodeStart = episodeEnd;
    while (episodeStart > 0 && (samples[episodeStart - 1].usedPercentage ?? -Infinity) >= warningPercent) {
        episodeStart -= 1;
    }
    let peak = samples[episodeStart];
    for (let index = episodeStart + 1; index <= episodeEnd; index += 1) {
        if ((samples[index].usedPercentage ?? -Infinity) > (peak.usedPercentage ?? -Infinity))
            peak = samples[index];
    }
    return [...new Set([samples[episodeStart], peak, latest])]
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt, "en-US"))
        .map((item, sourceOrder) => ({ ...item, sourceOrder }));
}
export function healthScopeId(scope) {
    switch (scope.type) {
        case "instance": return scope.instanceId;
        case "rig": return scope.rigId;
        case "seat": return scope.seatId;
        case "mission": return scope.missionId;
        case "slice": return scope.sliceId;
    }
}
function evaluateObservation(observation, policy) {
    switch (observation.kind) {
        case "coordination-lineage": return evaluateCoordination(observation, policy);
        case "wake-lineage": return evaluateWake(observation, policy);
        case "directive": return evaluateDirective(observation);
        case "scope-admission": return evaluateAdmission(observation);
        case "context-pressure": return evaluateContext(observation);
    }
}
function evaluateCoordination(observation, policy) {
    if (observation.ceremony)
        return [evaluatePassiveCeremony(observation, policy)];
    const records = [];
    const ratio = observation.productStateChanges === null ? null
        : observation.coordinationTransitions / Math.max(observation.productStateChanges, 1);
    if (observation.conditionCleared || (!observation.boundedAuthority
        && observation.coordinationTransitions >= policy.thresholds.ceremonyTransitions
        && (ratio === null || ratio >= policy.thresholds.ceremonyRatio))) {
        records.push(record(ratio === null ? { ...observation, conditionCleared: false } : observation, {
            detector: "process.ceremony-amplification",
            category: "process",
            severity: "warning",
            ...(ratio === null ? { status: "indeterminate" } : {}),
            summary: ratio === null
                ? `Ceremony proportionality is indeterminate for ${observation.lineageId}.`
                : `Coordination activity is disproportionate for ${observation.lineageId}.`,
            threshold: `coordinationTransitions >= ${policy.thresholds.ceremonyTransitions} AND coordinationTransitions / max(productStateChanges, 1) >= ${policy.thresholds.ceremonyRatio} AND boundedAuthority = false`,
            explanation: ratio === null
                ? `${observation.coordinationTransitions} coordination transitions in one lineage; product-outcome census unavailable, so no ratio is computed.`
                : `${observation.coordinationTransitions} coordination transitions for ${observation.productStateChanges} product-state change${observation.productStateChanges === 1 ? "" : "s"} in one lineage (${ratio.toFixed(1)}:1).`,
            suggestedInspection: `Inspect queue transitions and product checkpoints for ${observation.lineageId}.`,
        }));
    }
    if (observation.reviewReturns >= policy.thresholds.reviewReturns
        && observation.candidateChanges === 0
        && observation.newRiskClasses === 0) {
        records.push(record(observation, {
            detector: "process.review-carousel",
            category: "process",
            severity: "warning",
            summary: `Review repeatedly returned the unchanged ${observation.lineageId} lineage.`,
            threshold: `reviewReturns >= ${policy.thresholds.reviewReturns} AND candidateChanges = 0 AND newRiskClasses = 0`,
            explanation: `${observation.reviewReturns} review returns occurred with no candidate change and no newly recorded risk class.`,
            suggestedInspection: `Inspect the review return sequence for ${observation.lineageId}.`,
        }));
    }
    return records;
}
function evaluatePassiveCeremony(o, policy) {
    const c = structuredClone(o.ceremony);
    const result = c.assessment?.result;
    const current = o.source.freshness.state === "fresh";
    const complete = c.missingFacts.length === 0 && !result?.missingFacts.length;
    const known = current && complete && result?.conclusion === "established" && result.boundedAuthority !== null;
    const ratio = known ? o.coordinationTransitions / Math.max(result.outcomes.length, 1) : null;
    const cleared = current && complete && (result?.conclusion === "false-positive" || (known && (result.boundedAuthority || ratio < policy.thresholds.ceremonyRatio)));
    c.stage = cleared ? "cleared" : known ? "confirmed" : !current || c.assessment || c.missingFacts.length ? "indeterminate" : "needs-diagnosis";
    const count = `${o.coordinationTransitions} coordination transitions in the declared ${o.lineageId} handoff family`;
    const explanation = ratio === null ? `${count}; no ratio is computed. Product progress and the selected SDLC boundary require agent judgment.`
        : `${count} for ${result.outcomes.length} attributed meaningful product outcomes (${ratio.toFixed(1)}:1). Bounded authority: ${String(result.boundedAuthority)}.`;
    return record({ ...o, ceremony: c, conditionCleared: cleared }, {
        detector: "process.ceremony-amplification", category: "process", severity: c.stage === "confirmed" ? "warning" : "info",
        status: c.stage === "confirmed" ? "active" : cleared ? "cleared" : "indeterminate", confidence: "medium",
        summary: `${c.stage === "needs-diagnosis" ? "Needs diagnosis: suspected ceremony amplification" : c.stage === "confirmed" ? "Confirmed ceremony signal from attributed progress" : cleared ? "Ceremony suspicion cleared by agent assessment" : "Ceremony assessment is indeterminate"} for ${o.lineageId}.`,
        threshold: `Candidate: coordinationTransitions >= ${policy.thresholds.ceremonyTransitions}; confirmation requires attributed outcomes, ratio >= ${policy.thresholds.ceremonyRatio}, and boundedAuthority = false. Counts alone never confirm.`,
        explanation: `${explanation}${c.assessment ? ` Assessed by ${c.assessment.actor} at ${c.assessment.at}, transition ${c.assessment.transitionId}. Boundary: ${result.boundary}.` : ""} Missing facts: ${[...c.missingFacts, ...result?.missingFacts ?? [], ...(!current ? [`source freshness is ${o.source.freshness.state}`] : [])].join("; ") || (result ? "none declared by assessor" : "semantic outcome/boundary assessment pending")}.`,
        suggestedInspection: `Read the normal scope/proof/workflow evidence and current authority; extend beyond this packet. Record a progress assessment with the existing diagnosis disposition for ${o.lineageId}.`,
    });
}
function evaluateWake(observation, policy) {
    const redundant = Math.max(0, observation.wakeCount - observation.rescueWakeCount);
    if (!observation.existingNextAction || redundant < policy.thresholds.redundantWakes)
        return [];
    return [record(observation, {
            detector: "process.redundant-wake-storm",
            category: "process",
            severity: "warning",
            summary: `Repeated wakes duplicated an existing next action for ${observation.lineageId}.`,
            threshold: `wakeCount - rescueWakeCount >= ${policy.thresholds.redundantWakes} AND existingNextAction = true`,
            explanation: `${observation.wakeCount} wakes minus ${observation.rescueWakeCount} liveness rescues left ${redundant} redundant wakes while a next action was already recorded.`,
            suggestedInspection: `Inspect watchdog and queue wake receipts for ${observation.lineageId}.`,
        })];
}
function evaluateDirective(observation) {
    if (!observation.conflictSourceAddress)
        return [];
    const phaseConflict = observation.declaredPhase !== null
        && observation.currentPhase !== null
        && observation.declaredPhase !== observation.currentPhase;
    const rigorConflict = observation.declaredRigor !== null
        && observation.currentRigor !== null
        && observation.declaredRigor !== observation.currentRigor;
    if (!phaseConflict && !rigorConflict)
        return [];
    const conflicts = [
        phaseConflict ? `phase ${observation.declaredPhase} != ${observation.currentPhase}` : null,
        rigorConflict ? `rigor ${observation.declaredRigor} != ${observation.currentRigor}` : null,
    ].filter((item) => item !== null);
    return [record(observation, {
            detector: "governance.stale-directive",
            category: "governance",
            severity: "warning",
            summary: `Directive ${observation.directiveId} conflicts with current structured state.`,
            threshold: "a declared phase or rigor differs from newer structured state and both sources are addressable",
            explanation: `${conflicts.join("; ")}; current state is addressed by ${observation.conflictSourceAddress}. Age alone was not used.`,
            suggestedInspection: `Compare directive ${observation.directiveId} with ${observation.conflictSourceAddress}.`,
        })];
}
function evaluateAdmission(observation) {
    if (!observation.missionActive
        || !observation.buildable
        || !observation.requiredAuthority
        || !observation.authoritySourceAddress
        || observation.admissionState === "unavailable")
        return [];
    const authorityMismatch = observation.admissionState === "present"
        && observation.admissionAuthority !== observation.requiredAuthority;
    if (observation.admissionState === "present" && !authorityMismatch)
        return [];
    return [record(observation, {
            detector: "governance.scope-admission-drift",
            category: "governance",
            severity: "warning",
            summary: `Buildable slice ${observation.sliceId} lacks its mission's required admission.`,
            threshold: "missionActive = true AND buildable = true AND a governing authority rule is available AND admission is missing or contradictory",
            explanation: `The mission requires ${observation.requiredAuthority}; admission is ${observation.admissionState}${observation.admissionAuthority ? ` from ${observation.admissionAuthority}` : ""}.`,
            suggestedInspection: `Inspect ${observation.authoritySourceAddress} and the admission record for ${observation.sliceId}.`,
        })];
}
function evaluateContext(observation) {
    const samples = observation.source.evidence
        .filter((item) => item.type === "context-usage")
        .filter((item) => item.available && item.usedPercentage !== null && item.observedAt !== null)
        .sort((a, b) => a.sourceOrder - b.sourceOrder || a.observedAt.localeCompare(b.observedAt, "en-US"));
    if (samples.length === 0)
        return [];
    const warningPercent = observation.warningPercent ?? CONTEXT_PRESSURE_PERCENT;
    const criticalPercent = observation.criticalPercent ?? CONTEXT_CRITICAL_PERCENT;
    const latest = samples.at(-1);
    const active = latest.usedPercentage >= warningPercent;
    let pressureIndex = active ? samples.length - 1 : samples.length - 2;
    while (pressureIndex >= 0 && samples[pressureIndex].usedPercentage < warningPercent) {
        pressureIndex -= 1;
    }
    if (pressureIndex < 0)
        return [];
    while (pressureIndex > 0 && samples[pressureIndex - 1].usedPercentage >= warningPercent) {
        pressureIndex -= 1;
    }
    const firstPressure = samples[pressureIndex];
    const status = active ? "active" : "cleared";
    const severity = Math.max(...samples.slice(pressureIndex).map((sample) => sample.usedPercentage)) >= criticalPercent
        ? "critical"
        : "warning";
    return [record({
            ...observation,
            episodeStartedAt: firstPressure.observedAt,
            lastObservedAt: latest.observedAt,
        }, {
            detector: "context.pressure",
            category: "context",
            severity,
            status,
            summary: active
                ? `Seat context utilization reached ${latest.usedPercentage}%.`
                : `Seat context pressure cleared naturally at ${latest.usedPercentage}%.`,
            threshold: `fresh context utilization >= ${warningPercent}% (critical at >= ${criticalPercent}%)`,
            explanation: `The latest ${observation.sourceName ?? "unknown"} sample reports ${latest.usedPercentage}% utilization; source freshness is ${observation.source.freshness.state}; continuity is ${observation.continuity ?? "unavailable"}.`,
            suggestedInspection: "Inspect the seat's context source, recency, and continuity state.",
        })];
}
function record(observation, fields) {
    return projectHealthRecord({
        episodeKey: observation.episodeKey,
        ceremony: observation.ceremony,
        detector: fields.detector,
        category: fields.category,
        scope: observation.scope,
        severity: fields.severity,
        confidence: fields.confidence ?? observation.confidence ?? "high",
        status: observation.conditionCleared ? "cleared" : fields.status ?? "active",
        startedAt: observation.episodeStartedAt,
        lastObservedAt: observation.lastObservedAt,
        summary: fields.summary,
        threshold: fields.threshold,
        explanation: [fields.explanation, observation.sourceDescription].filter(Boolean).join(" "),
        suggestedInspection: fields.suggestedInspection,
        source: observation.source,
    });
}
function compareRecordRecency(a, b) {
    const time = Date.parse(a.lastObservedAt ?? "") - Date.parse(b.lastObservedAt ?? "");
    if (Number.isFinite(time) && time !== 0)
        return time;
    return canonicalHealthJson([a]).localeCompare(canonicalHealthJson([b]), "en-US");
}
function newestEvaluatedAt(records) {
    return records.map((record) => record.freshness.evaluatedAt).sort().at(-1) ?? null;
}
//# sourceMappingURL=health-detectors.js.map