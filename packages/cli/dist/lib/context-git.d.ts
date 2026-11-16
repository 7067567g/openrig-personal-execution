interface Selection {
    format: 1;
    checkout: string;
    libraryRoot: string;
    pack: string;
    revision: string;
    digest: string;
    selectedAt: string;
}
export declare function inspectGitContext(target: string): {
    served: {
        currentDigest: string;
        edited: boolean;
        format: 1;
        checkout: string;
        libraryRoot: string;
        pack: string;
        revision: string;
        digest: string;
        selectedAt: string;
        path: string;
    };
    checkout: {
        path: string;
        revision: string;
        branch: string | null;
        remote: string | null;
        origin: string | null;
        status: string;
        conflicts: string;
        upstream: string | null;
        ahead: number | null;
        behind: number | null;
        selectedRevisionMatches: boolean;
        selectedPackDiff: string;
        unavailable?: undefined;
    };
    remoteAvailability: string;
    consumption: string;
} | {
    served: {
        currentDigest: string;
        edited: boolean;
        format: 1;
        checkout: string;
        libraryRoot: string;
        pack: string;
        revision: string;
        digest: string;
        selectedAt: string;
        path: string;
    };
    checkout: {
        path: string;
        unavailable: string;
        revision?: undefined;
        branch?: undefined;
        remote?: undefined;
        origin?: undefined;
        status?: undefined;
        conflicts?: undefined;
        upstream?: undefined;
        ahead?: undefined;
        behind?: undefined;
        selectedRevisionMatches?: undefined;
        selectedPackDiff?: undefined;
    };
    remoteAvailability: string;
    consumption: string;
};
export declare function addGitContext(source: string, opts: {
    pack?: string;
    name?: string;
    checkout?: boolean;
    onWarning?: (message: string) => void;
}, targetRoot: string): {
    warning?: string | undefined;
    installedAt: string;
    selected: Selection;
};
export declare function updateGitContext(target: string): {
    served: {
        currentDigest: string;
        edited: boolean;
        format: 1;
        checkout: string;
        libraryRoot: string;
        pack: string;
        revision: string;
        digest: string;
        selectedAt: string;
        path: string;
    };
    checkout: {
        path: string;
        revision: string;
        branch: string | null;
        remote: string | null;
        origin: string | null;
        status: string;
        conflicts: string;
        upstream: string | null;
        ahead: number | null;
        behind: number | null;
        selectedRevisionMatches: boolean;
        selectedPackDiff: string;
        unavailable?: undefined;
    };
    remoteAvailability: string;
    consumption: string;
} | {
    served: {
        currentDigest: string;
        edited: boolean;
        format: 1;
        checkout: string;
        libraryRoot: string;
        pack: string;
        revision: string;
        digest: string;
        selectedAt: string;
        path: string;
    };
    checkout: {
        path: string;
        unavailable: string;
        revision?: undefined;
        branch?: undefined;
        remote?: undefined;
        origin?: undefined;
        status?: undefined;
        conflicts?: undefined;
        upstream?: undefined;
        ahead?: undefined;
        behind?: undefined;
        selectedRevisionMatches?: undefined;
        selectedPackDiff?: undefined;
    };
    remoteAvailability: string;
    consumption: string;
};
export {};
//# sourceMappingURL=context-git.d.ts.map