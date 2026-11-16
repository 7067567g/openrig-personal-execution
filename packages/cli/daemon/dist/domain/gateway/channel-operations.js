import { appendFileSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { getOpenRigHome } from "../../openrig-compat.js";
export function channelStateDigest(value) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
/** A start receipt survives a crash between the effect and its completion receipt.
 * Failure to write the start refuses BEFORE the effect; incomplete is never success. */
export async function runChannelOperation(input, home = getOpenRigHome()) {
    if (!input.actor.trim() || !input.reason.trim())
        throw new Error("channel operation requires actor and reason");
    const dir = join(home, "state");
    const file = join(dir, "human-channel-operations.jsonl");
    mkdirSync(dir, { recursive: true });
    const base = {
        id: randomUUID(), actor: input.actor, provenance: input.provenance,
        reason: input.reason, action: input.action, subject: input.subject, before: input.before,
    };
    const append = (after, effect) => {
        const receipt = { ...base, at: new Date().toISOString(), after, effect };
        appendFileSync(file, JSON.stringify(receipt) + "\n", { mode: 0o600 });
        return receipt;
    };
    append(null, "started");
    try {
        const result = await input.run();
        return { value: result.value, receipt: append(result.after, result.effect) };
    }
    catch (error) {
        append(null, "failed");
        throw error;
    }
}
//# sourceMappingURL=channel-operations.js.map