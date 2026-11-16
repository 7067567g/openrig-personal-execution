import type { QueueItem, QueueRepository } from "./queue-repository.js";
import type { HealthProjectionService, HealthSourceCoverage } from "./health-detectors.js";
import { type HealthPolicyStore } from "./health-policy.js";
import { type HealthRecord, type CeremonyProgressAssessment } from "./health-projection.js";
export declare const DIAGNOSIS_VERDICTS: readonly ["false positive", "early real condition", "established pathology", "insufficient evidence", "resolved"];
export interface HealthDisposition {
    verdict: typeof DIAGNOSIS_VERDICTS[number];
    causalStart: string | null;
    steering: string;
    uncertainty: string;
    evidenceRefs: string[];
    progress?: CeremonyProgressAssessment;
    correction?: {
        applicability: string;
        causalJudgment: string;
        action: {
            state: "proposed" | "taken";
            summary: string;
            evidenceRefs: string[];
        };
        effect: {
            state: "unobserved" | "observed";
            summary: string;
            evidenceRefs: string[];
        };
    };
}
export interface AuthorityReference {
    level?: "project" | "mission" | "slice";
    path: string;
    state: "available" | "unavailable";
    sha256?: string;
    content?: string;
    role?: string;
    selectedBy?: string;
    reason?: string;
}
interface Packet {
    schema: "openrig.health-diagnosis/v0alpha1";
    finding: HealthRecord;
    policyVersion: string;
    authority: AuthorityReference[];
    presentedAt: string;
    instructions: string;
}
interface Receipt {
    kind: "health-diagnosis";
    at: string;
    action: "presented" | "observed" | "disposition" | "notification-readiness";
    finding?: HealthRecord;
    disposition?: HealthDisposition;
    authority?: AuthorityReference[];
    episodeCleared?: boolean;
    progressEvidence?: AuthorityReference[];
    correctionEvidence?: AuthorityReference[];
    actor?: string;
    transitionId?: number;
    notificationReadiness?: {
        ready: boolean;
        reason: string;
    };
}
interface DiagnosisAction {
    qitemId: string;
    findingId: string;
    action: "create" | "represent" | "observe" | "retained" | "deferred" | "notify" | "notification-deferred";
    reason?: string;
    operatingPosture?: HealthRecord["operatingPosture"];
}
export declare class HealthDiagnosisService {
    private readonly deps;
    private pending;
    private timer;
    private lastEvaluation;
    status(): {
        scheduled: boolean;
        lastEvaluation: {
            at: string;
            error: string | null;
            coverage: HealthSourceCoverage[] | null;
        } | null;
    };
    start(): void;
    stop(): Promise<void>;
    constructor(deps: {
        queue: QueueRepository;
        projection: HealthProjectionService;
        policy: HealthPolicyStore;
        now?: () => string;
        authority: (record: HealthRecord) => AuthorityReference[];
        resolveEvidence?: (path: string, finding: HealthRecord) => AuthorityReference;
        humanReadiness?: (address: string) => Promise<{
            ready: boolean;
            reason: string;
        }>;
    });
    private now;
    private id;
    private owns;
    private missingCurrent;
    private receipt;
    show(qitemId: string, refresh?: boolean): {
        row: QueueItem;
        packet: Packet;
        receipts: Receipt[];
        notificationReadiness: {
            ready: boolean;
            reason: string;
        } | null;
        humanDelivery: {
            qitemId: string;
            outcome: string;
        } | null;
        finding: HealthRecord;
        authority: AuthorityReference[];
        authorityReadAt: string | null;
        guidance: string;
        disposition: HealthDisposition | null;
        assessment: {
            actor: string | undefined;
            at: string;
            transitionId: number | undefined;
        } | null;
        correctionEvidence: AuthorityReference[];
        behavioralEffect: "observed" | "unobserved";
    };
    list(refresh?: boolean): {
        row: QueueItem;
        packet: Packet;
        receipts: Receipt[];
        notificationReadiness: {
            ready: boolean;
            reason: string;
        } | null;
        humanDelivery: {
            qitemId: string;
            outcome: string;
        } | null;
        finding: HealthRecord;
        authority: AuthorityReference[];
        authorityReadAt: string | null;
        guidance: string;
        disposition: HealthDisposition | null;
        assessment: {
            actor: string | undefined;
            at: string;
            transitionId: number | undefined;
        } | null;
        correctionEvidence: AuthorityReference[];
        behavioralEffect: "observed" | "unobserved";
    }[];
    evaluate(actor: string, apply: boolean): Promise<{
        policyVersion: string;
        enabled: boolean;
        actions: DiagnosisAction[];
        coverage: HealthSourceCoverage[] | null;
    }>;
    private evaluateOnce;
    private requireOwner;
    dispose(qitemId: string, actor: string, value: unknown, identityProvenance?: string | null): {
        row: QueueItem;
        packet: Packet;
        receipts: Receipt[];
        notificationReadiness: {
            ready: boolean;
            reason: string;
        } | null;
        humanDelivery: {
            qitemId: string;
            outcome: string;
        } | null;
        finding: HealthRecord;
        authority: AuthorityReference[];
        authorityReadAt: string | null;
        guidance: string;
        disposition: HealthDisposition | null;
        assessment: {
            actor: string | undefined;
            at: string;
            transitionId: number | undefined;
        } | null;
        correctionEvidence: AuthorityReference[];
        behavioralEffect: "observed" | "unobserved";
    };
    private validateCorrection;
    private validateProgress;
    notify(qitemId: string, actor: string, identityProvenance?: string | null): Promise<{
        qitemId: string;
        deliveryOutcome: string;
        nextInspection: string;
    }>;
    private notifyOccurrence;
}
export {};
//# sourceMappingURL=health-diagnosis.d.ts.map