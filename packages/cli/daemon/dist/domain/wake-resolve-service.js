import { resolveWakeTarget } from "./wake-resolver.js";
/**
 * L3b — thin service behind /api/wake-resolve: fetch the seat's sessions rows and
 * delegate to the pure resolveWakeTarget (ruling A — resolve on the stores that
 * exist, refuse-and-teach otherwise).
 */
export class WakeResolveService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    resolve(seat, generation) {
        const rows = this.deps.listSessionsBySeat(seat);
        return resolveWakeTarget(rows, { seat, generation });
    }
}
//# sourceMappingURL=wake-resolve-service.js.map