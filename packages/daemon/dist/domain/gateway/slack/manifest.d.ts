export declare const MANIFEST_DISPLAY_NAME = "OpenRig";
export declare const SLACK_CREATE_APP_URL = "https://api.slack.com/apps?new_app=1&manifest_yaml=";
export interface SlackAppManifest {
    display_information: {
        name: string;
        description: string;
    };
    features: {
        bot_user: {
            display_name: string;
            always_online: boolean;
        };
    };
    oauth_config: {
        scopes: {
            bot: string[];
        };
    };
    settings: {
        event_subscriptions: {
            bot_events: string[];
        };
        interactivity: {
            is_enabled: boolean;
        };
        org_deploy_enabled: boolean;
        socket_mode_enabled: boolean;
        token_rotation_enabled: boolean;
    };
}
export interface SlackManifestBundle {
    manifest: SlackAppManifest;
    /** The manifest as YAML, exactly what the prefill link carries. */
    yaml: string;
    /** Slack's create-app-from-manifest link with the YAML URL-encoded. */
    url: string;
    scopes: string[];
    events: string[];
}
export interface ManifestSources {
    requiredScopes: readonly string[];
    featureScopes: readonly string[];
    admittedEventTypes: readonly string[];
    eventSubscriptions: Readonly<Record<string, {
        subscription: string;
        scope: string;
    }>>;
}
export declare const CANONICAL_MANIFEST_SOURCES: ManifestSources;
/** Build the manifest from its sources. Throws if an admitted event type has no subscription
 *  mapping, or if a subscribed event's scope is not requested — a manifest Slack would reject
 *  or that silently loses inbound traffic is a construction error, not a runtime surprise. */
export declare function buildSlackAppManifest(sources?: ManifestSources): SlackManifestBundle;
//# sourceMappingURL=manifest.d.ts.map