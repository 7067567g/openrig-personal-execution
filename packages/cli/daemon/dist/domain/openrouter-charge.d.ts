export declare const OPENROUTER_GENERATION_URL = "https://openrouter.ai/api/v1/generation";
/** A charge outcome for one Pi entry. `charged` is final; `unavailable` says why there is no charge. */
export type PiProviderCharge = {
    entryId: string;
    generationId: string;
    status: "charged" | "unavailable";
    /** OpenRouter's data.total_cost, in USD. */
    totalCostUsd: number | null;
    upstreamInferenceCostUsd: number | null;
    cacheDiscountUsd: number | null;
    isByok: boolean | null;
    providerName: string | null;
    model: string | null;
    apiType: string | null;
    workspaceId: string | null;
    generationCreatedAt: string | null;
    /** The credential that generated the request and made the lookup (a name, never a value). */
    credentialSource: string;
    reason: string | null;
};
/** Whether a Pi entry is a request this lookup covers, and if not, why. */
export declare function openRouterChargeTarget(fact: {
    kind: string;
    provider: string | null;
    api?: string | null;
    responseId?: string | null;
}): {
    generationId: string;
} | {
    notCovered: string;
};
/** The longest reply text kept (model, provider, workspace, api type, timestamp); longer text isn't kept. */
export declare const OPENROUTER_TEXT_LIMIT = 256;
/** OpenRouter's reply for one generation, checked against the generation asked about. */
export declare function parseOpenRouterGeneration(body: unknown, generationId: string): {
    ok: true;
    fields: Omit<PiProviderCharge, "entryId" | "generationId" | "status" | "credentialSource" | "reason">;
} | {
    ok: false;
    reason: string;
};
//# sourceMappingURL=openrouter-charge.d.ts.map