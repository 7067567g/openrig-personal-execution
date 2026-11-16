type Row = Record<string, unknown>;
export interface CostBody {
    seats: Array<Row & {
        seatSession: string;
        status: string;
    }>;
    note: string;
}
export interface CostRead {
    /** The served cost view, or why it couldn't be read (status null: no HTTP answer). */
    status: {
        body: CostBody;
    } | {
        status: number | null;
        error: string;
    };
}
export {};
//# sourceMappingURL=cost-read.d.ts.map