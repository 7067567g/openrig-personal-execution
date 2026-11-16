export class RigNotFoundError extends Error {
    constructor(rigId) {
        super(`Rig ${rigId} not found`);
        this.name = "RigNotFoundError";
    }
}
//# sourceMappingURL=errors.js.map