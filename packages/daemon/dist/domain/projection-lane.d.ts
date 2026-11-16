declare class ProjectionLane {
    private tail;
    run<T>(job: () => T): Promise<T>;
}
export declare const projectionLane: ProjectionLane;
export {};
//# sourceMappingURL=projection-lane.d.ts.map