import type { Migration } from "../migrate.js";
/**
 * OPR.0.7.0.2 (cost reporting, K4): OpenRouter's actual charge for a Pi request, kept beside (never inside) Pi's
 * model-priced estimate.
 * - pi_usage_entries gains the assistant turn's Pi API and the provider response id Pi recorded, which tie the
 *   entry to OpenRouter's own record of the request.
 * - pi_usage_charges: one row per (Pi session, entry). "charged" is final (data.total_cost in USD, with the
 *   generation's account context); "unavailable" says why, and can still become "charged". A replay, restart
 *   or repeated lookup never adds a second charge.
 */
export declare const piUsageChargesSchema: Migration;
//# sourceMappingURL=108_pi_usage_charges.d.ts.map