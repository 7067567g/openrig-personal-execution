export interface RiggedConfig {
    launch: {
        nonInterruptive: boolean;
    };
    daemon: {
        port: number;
        host: string;
    };
    host: {
        selected: string;
        name: string;
    };
    db: {
        path: string;
    };
    transcripts: {
        enabled: boolean;
        path: string;
        lines: number;
        pollIntervalSeconds: number;
    };
    workspace: {
        root: string;
        slicesRoot: string;
        steeringPath: string;
        specsRoot: string;
        projectsRoot: string;
        catalogPath: string;
        operatorSeatName: string;
    };
    topology: {
        root: string;
    };
    context: {
        root: string;
        systemWorld: string;
    };
    skills: {
        root: string;
    };
    onboarding: {
        defaultPack: {
            enabled: boolean;
        };
    };
    health: {
        contextPressure: {
            warningPercent: number;
            criticalPercent: number;
        };
    };
    files: {
        allowlist: string;
    };
    progress: {
        scanRoots: string;
    };
    ui: {
        /** Serve the web UI and its terminal WebSocket. Off by default; the daemon reads it at start. */
        enabled: boolean;
        timezone: string;
        preview: {
            refreshIntervalSeconds: number;
            maxPins: number;
            defaultLines: number;
        };
    };
    recovery: {
        autoDriveProviderPrompts: boolean;
        providerAuthEnvAllowlist: string;
    };
    agents: {
        advisorSession: string;
        operatorSession: string;
    };
    feed: {
        subscriptions: {
            actionRequired: boolean;
            approvals: boolean;
            shipped: boolean;
            progress: boolean;
            auditLog: boolean;
        };
    };
    runtime: {
        readinessTimeoutSeconds: number;
        codex: {
            hooksEnabled: boolean;
        };
    };
    policies: {
        claudeCompaction: {
            enabled: boolean;
            thresholdPercent: number;
            preCompactInstruction: string;
            compactInstruction: string;
            messageInline: string;
            messageFilePath: string;
            postRestoreAuditInstruction: string;
        };
        idleGateQitem: {
            scanIntervalSeconds: number;
            activeWakeIntervalSeconds: number;
            autoRegister: string;
            optInSessions: string;
        };
    };
    snapshots: {
        periodic: {
            enabled: boolean;
            intervalSeconds: number;
            retentionKeep: number;
        };
    };
    terminal: {
        statusBar: boolean;
    };
    output: {
        compact: boolean;
        /** With compact on, how many peers `rig whoami --json` lists (edge peers first). */
        whoamiPeers: number;
    };
    provider: {
        usageWindows: boolean;
    };
    usage: {
        piCostFacts: boolean;
        piOpenRouterCharge: boolean;
    };
    transport: {
        verifyInputBox: boolean;
    };
    retention: {
        enabled: boolean;
        transitionsDays: number;
        watchdogDays: number;
        watchdogKeepPerJob: number;
        batchSize: number;
    };
    queue: {
        pickupStallThresholdMinutes: number;
        stuckSweepIntervalSeconds: number;
        stuckSweepUnclaimedAgeMinutes: number;
        wakeRetryIntervalSeconds: number;
        wakeRetryCap: number;
        wakeUnconfirmedWindowMinutes: number;
        wakeSwapGraceSeconds: number;
        wakeHumanRung: string;
    };
    resources: {
        admission: {
            enabled: boolean;
            maxConcurrent: number;
            maxPerRig: number;
            reservedInteractive: number;
            queueTimeoutSeconds: number;
        };
        toolchain: {
            enabled: boolean;
            jobs: number;
        };
        providerLimit: {
            enabled: boolean;
            maxActiveSeats: number;
            launchesPerMinute: number;
            burst: number;
            queueTimeoutSeconds: number;
        };
    };
    budget: {
        enabled: boolean;
        maxWallTimeSeconds: number;
        maxSteps: number;
        maxToolCalls: number;
        maxTokens: number;
        maxRetries: number;
    };
}
/** OPR.0.5.3.6 — twin of the daemon settings-store helper. The LEGACY topology
 *  location, kept readable (advisory-emitting fallback) so pre-convention rigs
 *  migrate instead of flag-daying. Resolves where legacy code ACTUALLY wrote —
 *  the codex adapter's shared-docs precedent (OPENRIG_SHARED_DOCS_ROOT env,
 *  else the literal ~/.openrig/shared-docs), NOT $OPENRIG_HOME: boxes with a
 *  non-default home still carry their legacy tree at ~/.openrig/shared-docs.
 *  This is the ONE CLI home for the literal; walkers import it and carry none. */
export declare function resolveLegacyTopologyRigsRoot(): string;
export declare const VALID_KEYS: readonly ["daemon.port", "daemon.host", "host.selected", "host.name", "workflow.exception_routing", "db.path", "transcripts.enabled", "transcripts.path", "transcripts.lines", "transcripts.poll_interval_seconds", "workspace.root", "workspace.slices_root", "workspace.steering_path", "workspace.specs_root", "workspace.projects_root", "workspace.catalog_path", "topology.root", "context.root", "context.system_world", "skills.root", "onboarding.default_pack.enabled", "launch.non_interruptive", "health.context_pressure.warning_percent", "health.context_pressure.critical_percent", "files.allowlist", "progress.scan_roots", "ui.preview.refresh_interval_seconds", "ui.preview.max_pins", "ui.preview.default_lines", "ui.timezone", "ui.enabled", "recovery.auto_drive_provider_prompts", "recovery.provider_auth_env_allowlist", "agents.advisor_session", "agents.operator_session", "workspace.operator_seat_name", "feed.subscriptions.action_required", "feed.subscriptions.approvals", "feed.subscriptions.shipped", "feed.subscriptions.progress", "feed.subscriptions.audit_log", "runtime.codex.hooks_enabled", "runtime.readiness_timeout_seconds", "policies.claude_compaction.enabled", "policies.claude_compaction.threshold_percent", "policies.claude_compaction.pre_compact_instruction", "policies.claude_compaction.compact_instruction", "policies.claude_compaction.message_inline", "policies.claude_compaction.message_file_path", "policies.claude_compaction.post_restore_audit_instruction", "policies.idle_gate_qitem.scan_interval_seconds", "policies.idle_gate_qitem.active_wake_interval_seconds", "policies.idle_gate_qitem.auto_register", "policies.idle_gate_qitem.opt_in_sessions", "snapshots.periodic.enabled", "snapshots.periodic.interval_seconds", "snapshots.periodic.retention_keep", "terminal.status_bar", "output.compact", "output.whoami_peers", "provider.usage_windows", "usage.pi_cost_facts", "usage.pi_openrouter_charge", "transport.verify_input_box", "retention.enabled", "retention.transitions_days", "retention.watchdog_days", "retention.watchdog_keep_per_job", "retention.batch_size", "queue.pickup_stall_threshold_minutes", "queue.stuck_sweep_interval_seconds", "queue.stuck_sweep_unclaimed_age_minutes", "queue.wake_retry_interval_seconds", "queue.wake_retry_cap", "queue.wake_unconfirmed_window_minutes", "queue.wake_swap_grace_seconds", "queue.wake_human_rung", "resources.admission.enabled", "resources.admission.max_concurrent", "resources.admission.max_per_rig", "resources.admission.reserved_interactive", "resources.admission.queue_timeout_seconds", "budget.enabled", "budget.max_wall_time_seconds", "budget.max_steps", "budget.max_tool_calls", "budget.max_tokens", "budget.max_retries", "resources.toolchain.enabled", "resources.toolchain.jobs", "resources.provider_limit.enabled", "resources.provider_limit.max_active_seats", "resources.provider_limit.launches_per_minute", "resources.provider_limit.burst", "resources.provider_limit.queue_timeout_seconds"];
export type ValidKey = typeof VALID_KEYS[number];
export declare const ENV_MAP: Record<ValidKey, {
    primary: string;
    legacy?: string;
}>;
export declare function removedContextSettingMessage(key: string): string | null;
export declare const FEED_HOST_RESERVED_SEGMENTS: Set<string>;
export declare function parseFeedHostSubscriptionKey(key: string): {
    hostId: string;
} | null;
export declare function deriveWorkspaceDefault(key: ValidKey, workspaceRoot: string): string;
export type SettingSource = "env" | "file" | "default";
export interface ResolvedSetting {
    value: string | number | boolean;
    source: SettingSource;
    defaultValue: string | number | boolean;
}
export declare class ConfigStore {
    readonly configPath: string;
    constructor(configPath?: string);
    /** Publish a complete config without truncating the previous usable file. */
    private writeConfig;
    private verifyPersisted;
    resolve(): RiggedConfig;
    /**
     * Resolve a single key with its source. Used by the daemon HTTP route
     * + UI Settings panel for honest provenance display (env / file /
     * default).
     */
    resolveWithSource(key: string): ResolvedSetting;
    /** Resolve all valid keys with sources. Convenience for the UI. */
    resolveAllWithSource(): Record<ValidKey, ResolvedSetting>;
    private resolveOne;
    private resolveContextPressurePair;
    private resolveOneUnpaired;
    get(key: string): string | number | boolean;
    set(key: string, value: string): void;
    /**
     * Clear an override. Without a key argument, deletes the whole config
     * file (revert all to defaults). With a key, removes just that key
     * from the config file.
     */
    reset(key?: string): void;
    private readConfigFile;
}
export interface NamedPair {
    name: string;
    path: string;
}
export declare function parseNamedPairs(raw: string): NamedPair[];
//# sourceMappingURL=config-store.d.ts.map