/** Read metadata describes the original JSON, never an estimated complete ledger. */
export declare function omittedReadField(path: string, value: unknown): {
    items?: number | undefined;
    path: string;
    jsonBytes: number;
};
export declare function readView(original: unknown, fullCommand: string, omittedFields?: ReturnType<typeof omittedReadField>[]): {
    complete: boolean;
    fullJsonBytes: number;
    omittedFields: {
        items?: number | undefined;
        path: string;
        jsonBytes: number;
    }[];
    fullCommand: string;
};
//# sourceMappingURL=read-view.d.ts.map