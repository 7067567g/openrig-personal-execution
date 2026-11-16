import type { ContextPackAtom, ContextPackProfile } from "./context-pack-types.js";
export declare class ProfileComposeError extends Error {
    constructor(message: string);
}
export type ComposeSituation = "fresh" | "handover" | "post-compaction";
export type ComposeRuntime = "claude" | "codex";
export type SourceKind = "library" | "project" | "seat" | "mission";
export interface ComposeInput {
    /** The one atom graph (possibly gathered across sources by the caller). */
    atoms: ContextPackAtom[];
    situation: ComposeSituation;
    runtime: ComposeRuntime;
    /** Fail-loud file reader keyed by the address's pre-`#` ref. */
    readFile: (ref: string) => string;
    /** The situation's token budget (D2 targets); omitted = no budget check. */
    budgetTokens?: number;
    /** Source labelling per atom (Q2-Amendment 1); defaults to "library". */
    sourceKindFor?: (atom: ContextPackAtom) => SourceKind;
}
export interface ComposedPiece {
    atomId: string;
    address: string;
    sourceKind: SourceKind;
    order: number;
    priority: ContextPackAtom["priority"];
    /** The resolved bytes: the addressed span (Q1 full-span rule) or the whole file. */
    text: string;
    estimatedTokens: number;
    /** Present for named install profiles so the flattened delivery stream still
     * carries the phase boundary an inspector saw before apply. */
    phaseId?: string;
}
export interface ComposedProfilePhase {
    id: string;
    kind: "atoms" | "context";
    sources?: string[];
    pieces: ComposedPiece[];
    estimatedTokens: number;
}
export interface ComposedProfile {
    situation: ComposeSituation;
    runtime: ComposeRuntime;
    pieces: ComposedPiece[];
    totalEstimatedTokens: number;
    /** Present only for an explicitly selected manifest profile. */
    profileId?: string;
    phases?: ComposedProfilePhase[];
    /** Present only when a post-compaction compose skipped an absent seat recap; the caller warns. */
    skipped?: Array<{
        atomId: string;
        address: string;
    }>;
    /** Present ONLY when the budget binds: the report, never a truncation. */
    budget?: {
        limitTokens: number;
        overageTokens: number;
        /** What to drop FIRST, in drop order: optional, then recommended, then core;
         *  larger pieces first within a tier (the biggest cheap win leads). */
        dropCandidates: Array<{
            atomId: string;
            priority: ContextPackAtom["priority"];
            estimatedTokens: number;
        }>;
    };
}
export declare function composeProfile(input: ComposeInput): ComposedProfile;
/** Compose one explicit manifest profile. Profiles change only selection and
 * sequence: every atom still resolves through the same source graph, while
 * project/mission/seat/task atoms are supplied by the route from configured
 * roots. */
export declare function composeNamedProfile(input: ComposeInput & {
    profile: ContextPackProfile;
    contextAtoms: Partial<Record<"project" | "mission" | "seat" | "slice", ContextPackAtom[]>>;
}): ComposedProfile;
//# sourceMappingURL=profile-composer.d.ts.map