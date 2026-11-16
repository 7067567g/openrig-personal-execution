import type { RigSpec, LegacyRigSpec } from "./types.js";
/**
 * Pod-aware RigSpec codec. Canonical contract for the AgentSpec reboot.
 */
export declare class RigSpecCodec {
    static parse(yamlString: string): unknown;
    static serialize(spec: RigSpec): string;
}
/**
 * Legacy flat-node RigSpec codec (pre-reboot).
 * TODO: Remove when AS-T08b/AS-T12 migrate all consumers.
 */
export declare class LegacyRigSpecCodec {
    static parse(yamlString: string): unknown;
    static serialize(spec: LegacyRigSpec): string;
}
//# sourceMappingURL=rigspec-codec.d.ts.map