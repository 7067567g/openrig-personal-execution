export interface PackageManifest {
    schemaVersion: number;
    name: string;
    version: string;
    summary: string;
    compatibility: {
        runtimes: string[];
    };
    exports: PackageExports;
    requirements?: PackageRequirements;
    installPolicy?: InstallPolicy;
    verification?: VerificationConfig;
    roles?: RoleDefinition[];
}
export interface PackageExports {
    skills?: SkillExport[];
    guidance?: GuidanceExport[];
    agents?: AgentExport[];
    hooks?: HookExport[];
    mcp?: McpExport[];
}
export interface SkillExport {
    source: string;
    name: string;
    supportedScopes: string[];
    defaultScope: string;
}
export interface GuidanceExport {
    source: string;
    name: string;
    kind: string;
    supportedScopes: string[];
    defaultScope: string;
    mergeStrategy: string;
}
export interface AgentExport {
    source: string;
    name?: string;
    supportedScopes?: string[];
    defaultScope?: string;
}
export interface HookExport {
    source: string;
    supportedRuntimes?: string[];
    supportedScopes?: string[];
    defaultScope?: string;
}
export interface McpExport {
    source: string;
    supportedRuntimes?: string[];
    supportedScopes?: string[];
    defaultScope?: string;
}
export interface PackageRequirements {
    cliTools?: Array<{
        name: string;
        requiredFor?: string[];
        installHints?: Record<string, string>;
    }>;
    systemPackages?: Array<{
        name: string;
    }>;
}
export interface InstallPolicy {
    requireReviewForExternalInstalls?: boolean;
    allowUserGlobalWrites?: boolean;
    allowAgentMergeOfGuidance?: boolean;
}
export interface RoleDefinition {
    name: string;
    description?: string;
    skills?: string[];
    guidance?: string[];
    hooks?: string[];
    context?: string[];
}
export interface VerificationCheck {
    type: string;
    name?: string;
    command?: string;
}
export interface VerificationConfig {
    checks: VerificationCheck[];
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function parseManifest(yamlString: string): unknown;
export declare function validateManifest(raw: unknown): ValidationResult;
export declare function normalizeManifest(raw: unknown): PackageManifest;
export declare function serializeManifest(manifest: PackageManifest): string;
//# sourceMappingURL=package-manifest.d.ts.map