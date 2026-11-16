export interface AttestationLineage {
    spec?: {
        by: string;
        at: string;
        priors: number;
    };
    delivery?: {
        by: string;
        at: string;
        priors: number;
    };
}
export declare function attestationLineage(frontmatterRaw: string | null): AttestationLineage | undefined;
//# sourceMappingURL=attestation-lineage.generated.d.ts.map