/** Absolute local presentation only. Source strings and ordering stay with the caller. */
export declare const DEFAULT_TIME_ZONE = "America/Los_Angeles";
export declare function validTimeZone(value: unknown): value is string;
export declare function displayTime(value: unknown, timeZone?: string): string;
export declare function resolveTimeZone(setting: unknown, readWarning?: boolean): {
    timeZone: string;
    warning: string | null;
};
//# sourceMappingURL=time.d.ts.map