import { type BundleBehaviour, type DescribeBundleInput } from "./bundle-behaviour.js";
/** Called only for the private directory produced by the existing archive inspection. */
export declare function inspectBundleBehaviour(archiveRoot: string, input: Omit<DescribeBundleInput, "files" | "omittedFiles">): BundleBehaviour;
//# sourceMappingURL=bundle-behaviour-inspect.d.ts.map