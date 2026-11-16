/** The exact set of variables this projection owns, in a stable order. */
export declare const TOOLCHAIN_ENV_VARS: readonly ["CARGO_BUILD_JOBS", "RUST_TEST_THREADS", "MAKEFLAGS", "CMAKE_BUILD_PARALLEL_LEVEL", "UV_CONCURRENT_BUILDS", "NPM_CONFIG_JOBS", "UV_THREADPOOL_SIZE"];
export type ToolchainEnvVar = typeof TOOLCHAIN_ENV_VARS[number];
export interface ToolchainConcurrencyConfig {
    enabled: boolean;
    /** Positive integer N projected into every variable. 0 = project nothing. */
    jobs: number;
}
export declare const DEFAULT_TOOLCHAIN_CONCURRENCY_CONFIG: ToolchainConcurrencyConfig;
/**
 * Build the environment additions for a seat. Returns `{}` unless the feature is
 * enabled AND `jobs` is a positive integer: an enabled-but-zero config is the
 * explicit "no projection" state, not an implicit unlimited build.
 */
export declare function projectToolchainEnvironment(config: ToolchainConcurrencyConfig): Record<string, string>;
//# sourceMappingURL=toolchain-environment.d.ts.map