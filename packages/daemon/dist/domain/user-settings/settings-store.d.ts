/** OPR.0.5.3.6 — the LEGACY topology location, ruled an arbitrary folder
 *  (founder, 2026-08-14) but kept readable so pre-convention rigs migrate
 *  instead of flag-daying. Resolves where legacy code ACTUALLY wrote —
 *  mirroring the codex adapter's shared-docs precedent (OPENRIG_SHARED_DOCS_ROOT
 *  env, else the literal ~/.openrig/shared-docs), NOT $OPENRIG_HOME: boxes with
 *  a non-default home still carry their legacy tree at ~/.openrig/shared-docs.
 *  This helper is the ONE home for the literal: walkers call it for their
 *  fallback and must emit the named advisory when a read resolves here. */
export declare function resolveLegacyTopologyRigsRoot(): string;
export declare const SETTINGS_VALID_KEYS: readonly ["daemon.port", "daemon.host", "host.selected", "host.name", "workflow.exception_routing", "db.path", "transcripts.enabled", "transcripts.path", "transcripts.lines", "transcripts.poll_interval_seconds", "workspace.root", "workspace.slices_root", "workspace.steering_path", "workspace.specs_root", "workspace.projects_root", "workspace.catalog_path", "topology.root", "context.root", "context.system_world", "skills.root", "onboarding.default_pack.enabled", "launch.non_interruptive", "health.context_pressure.warning_percent", "health.context_pressure.critical_percent", "files.allowlist", "progress.scan_roots", "ui.preview.refresh_interval_seconds", "ui.preview.max_pins", "ui.preview.default_lines", "ui.timezone", "ui.enabled", "ui.terminal.max_live_terminals", "recovery.auto_drive_provider_prompts", "recovery.provider_auth_env_allowlist", "agents.advisor_session", "agents.operator_session", "workspace.operator_seat_name", "feed.subscriptions.action_required", "feed.subscriptions.approvals", "feed.subscriptions.shipped", "feed.subscriptions.progress", "feed.subscriptions.audit_log", "runtime.codex.hooks_enabled", "runtime.readiness_timeout_seconds", "policies.claude_compaction.enabled", "policies.claude_compaction.threshold_percent", "policies.claude_compaction.pre_compact_instruction", "policies.claude_compaction.compact_instruction", "policies.claude_compaction.message_inline", "policies.claude_compaction.message_file_path", "policies.claude_compaction.post_restore_audit_instruction", "policies.idle_gate_qitem.scan_interval_seconds", "policies.idle_gate_qitem.active_wake_interval_seconds", "policies.idle_gate_qitem.auto_register", "policies.idle_gate_qitem.opt_in_sessions", "snapshots.periodic.enabled", "snapshots.periodic.interval_seconds", "snapshots.periodic.retention_keep", "terminal.status_bar", "output.compact", "output.whoami_peers", "provider.usage_windows", "usage.pi_cost_facts", "usage.pi_openrouter_charge", "transport.verify_input_box", "retention.enabled", "retention.transitions_days", "retention.watchdog_days", "retention.usage_samples_days", "retention.watchdog_keep_per_job", "retention.batch_size", "queue.pickup_stall_threshold_minutes", "queue.stuck_sweep_interval_seconds", "queue.stuck_sweep_unclaimed_age_minutes", "queue.wake_retry_interval_seconds", "queue.wake_retry_cap", "queue.wake_unconfirmed_window_minutes", "queue.wake_swap_grace_seconds", "queue.wake_human_rung", "resources.admission.enabled", "resources.admission.max_concurrent", "resources.admission.max_per_rig", "resources.admission.reserved_interactive", "resources.admission.queue_timeout_seconds", "budget.enabled", "budget.max_wall_time_seconds", "budget.max_steps", "budget.max_tool_calls", "budget.max_tokens", "budget.max_retries", "resources.toolchain.enabled", "resources.toolchain.jobs", "resources.provider_limit.enabled", "resources.provider_limit.max_active_seats", "resources.provider_limit.launches_per_minute", "resources.provider_limit.burst", "resources.provider_limit.queue_timeout_seconds"];
export type SettingsValidKey = typeof SETTINGS_VALID_KEYS[number];
export type SettingSource = "env" | "file" | "default";
export interface ResolvedSetting {
    value: string | number | boolean;
    source: SettingSource;
    defaultValue: string | number | boolean;
}
export declare function isSettingsValidKey(key: string): key is SettingsValidKey;
export declare function removedContextSettingMessage(key: string): string | null;
export declare const FEED_HOST_RESERVED_SEGMENTS: Set<string>;
export declare function parseFeedHostSubscriptionKey(key: string): {
    hostId: string;
} | null;
export declare const DEFAULT_CLAUDE_COMPACTION_EXTRA_INSTRUCTION_FILE_CONTENT = "# OpenRig Post-Compact Extra Instructions\n\nNo mission-specific extra restore instructions are configured yet.\n\nAdd additional file paths, reading lists, or mission-specific restore notes here\nwhen this session needs more context than the canonical claude-compaction-restore\nskill provides.\n";
export declare function defaultClaudeCompactionExtraInstructionFilePath(openrigHome?: string): string;
export declare function ensureDefaultClaudeCompactionFiles(openrigHome?: string): string;
/**
 * Slice 27 — projected Claude auto-compaction policy. ContextMonitor
 * consumes this snapshot per-poll; the PreCompact hook reads the same
 * shape via direct config.json read (without depending on the daemon).
 */
export interface ClaudeCompactionPolicy {
    enabled: boolean;
    thresholdPercent: number;
    preCompactInstruction: string;
    compactInstruction: string;
    messageInline: string;
    messageFilePath: string;
    postRestoreAuditInstruction: string;
}
export interface ContextPressurePolicy {
    warningPercent: number;
    criticalPercent: number;
}
export interface ResolvedConfig {
    skillsRoot: string;
    contextRoot: string;
    systemWorld: string;
    topologyRoot: string;
    workspaceRoot: string;
    workspaceSlicesRoot: string;
    workspaceSteeringPath: string;
    workspaceSpecsRoot: string;
    workspaceProjectsRoot: string;
    workspaceCatalogPath: string;
    workspaceOperatorSeatName: string;
    filesAllowlistRaw: string;
    progressScanRootsRaw: string;
    uiPreviewRefreshIntervalSeconds: number;
    uiPreviewMaxPins: number;
    uiPreviewDefaultLines: number;
    recoveryAutoDriveProviderPrompts: boolean;
    recoveryProviderAuthEnvAllowlistRaw: string;
}
export declare class SettingsStore {
    readonly configPath: string;
    constructor(configPath?: string);
    resolveOne(key: SettingsValidKey, fileConfig?: Record<string, unknown>, workspaceRoot?: string): ResolvedSetting;
    private resolveContextPressurePair;
    private resolveOneUnpaired;
    resolveAllWithSource(): Record<SettingsValidKey, ResolvedSetting>;
    /** Project the raw resolution into a flattened config structure for daemon consumers. */
    resolveConfig(): ResolvedConfig;
    /**
     * Slice 27 — read the Claude auto-compaction policy as a typed snapshot.
     * Called per-poll by ContextMonitor so live edits to ~/.openrig/config.json
     * take effect within one polling interval without daemon restart.
     */
    resolveClaudeCompactionPolicy(): ClaudeCompactionPolicy;
    /** Fresh-read context-pressure detector policy; changes apply to the next projection. */
    resolveContextPressurePolicy(): ContextPressurePolicy;
    /** Publish a complete config without truncating the previous usable file. */
    private writeConfig;
    private verifyPersisted;
    set(key: string, value: string): void;
    /** OPR.0.4.4.15 — resolve one dynamic feed-host subscription key.
     *  File-or-default only (no env mapping for the dynamic class in v1);
     *  default false = not subscribed. Returns null for keys outside the
     *  registered class. */
    resolveFeedHostSubscription(key: string): ResolvedSetting | null;
    /** OPR.0.4.4.15 — enumerate persisted per-host subscriptions (the
     *  aggregator's read). Reserved segments and non-conforming shapes are
     *  WARNED and IGNORED (the ratified guard: operator error surfaces
     *  visibly, never misparses, never rejects the whole config). */
    listFeedHostSubscriptions(): Array<{
        hostId: string;
        enabled: boolean;
    }>;
    reset(key?: string): void;
    private resolveWorkspaceRootRaw;
    private readConfigFile;
}
export interface NamedPair {
    name: string;
    path: string;
}
export declare function parseNamedPairs(raw: string): NamedPair[];
//# sourceMappingURL=settings-store.d.ts.map