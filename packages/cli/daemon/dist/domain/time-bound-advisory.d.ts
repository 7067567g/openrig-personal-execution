/** Whether a bound reads as an ISO date or time (or a leading part of one) with in-range fields. */
export declare function isRecognisedDateOrTime(value: string): boolean;
/** An advisory for a bound that is not recognised as a date or time; undefined when nothing triggers it. */
export declare function timeBoundAdvisory(name: string, value: string | undefined, field: string): string | undefined;
//# sourceMappingURL=time-bound-advisory.d.ts.map