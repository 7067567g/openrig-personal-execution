import { Command } from "commander";
/**
 * `rig proof add` — the evidence-capture write path (OPR.0.4.4.19 FR-8 + FR-11;
 * conventions C1 + C2 + C8, D2 attestation).
 *
 * The capture leg is CLI-side filesystem only: the drop
 * validates the C1 header AT THE MOMENT THE EVIDENCE IS IN-HAND, writes the
 * artifact into the slice's proof/ dir, and echoes the parsed header (the
 * seat sees what the composer will see). No daemon involvement, no synthetic
 * qitems, no DB writes.
 *
 * LOAD-BEARING boundaries:
 *   - Validation applies ONLY to drops made through this path. An artifact
 *     written by any other means (raw file write, existing workflows) is
 *     NEVER blocked at write time — the backstop is `rig scope audit`
 *     (FR-10), not a write-path gate on ordinary file I/O.
 *   - The D2 proof contract + self_check are AGENT JUDGMENT recorded here;
 *     the drop path ADVISES (exit 0) and never blocks on them. There is no
 *     configuration that makes any advisory blocking (BR-7).
 */
/** C1 ratified closed sets (BR-4 — extending them is a convention change
 *  owned by pm-lead, not a code decision). */
export declare const C1_ARTIFACT_TYPES: readonly ["guard", "qa", "rev1-r1", "rev1-r2", "adjudication"];
export declare const C1_VERDICTS: readonly ["CLEAR", "BLOCKING", "CONCERNING", "PASS", "NOT-CLEAR"];
export interface C1Header {
    slice: string;
    candidate_sha: string;
    artifact_type: string;
    verdict: string;
    money_evidence: string;
    /** D2 optional attestation fields — advise-never-block. */
    evidences?: string[];
    self_check?: string;
}
export interface C1ValidationResult {
    ok: boolean;
    missing: string[];
    invalid: Array<{
        field: string;
        value: string;
        allowed: readonly string[];
    }>;
}
/** Validate the five required C1 fields + closed sets. Pure. */
export declare function validateC1Header(header: Partial<C1Header>): C1ValidationResult;
/**
 * Parse the pinned `## Proof contract` section out of a slice's
 * authored work-node contract (SPEC.md for current work; legacy filenames
 * remain readable). Returns the
 * promised items (checkbox-item form, one promised item per line), or null
 * when the slice declares no contract (tier-1 degrade — zero noise).
 */
export declare function parseProofContract(prdContent: string): string[] | null;
export declare function proofCommand(): Command;
/** Explicit --replace swaps the artifact's directory entry; it never writes through it. A symlink or hard
 *  link at the artifact name therefore keeps its other path's bytes. The staging file is created
 *  exclusively under a unique name, so cleanup only ever removes a file this call created, and a failed
 *  write, close or rename leaves the target as it was. An existing regular artifact's permission bits carry
 *  over, so a replacement never broadens access; a symlinked or new name gets default permissions. The
 *  first failure is the one reported. There is no fsync: this is a same-directory swap, not a
 *  crash-durability guarantee. */
export declare function replaceArtifactFile(target: string, content: string, stagingId?: string): void;
//# sourceMappingURL=proof.d.ts.map