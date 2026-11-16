import { Command } from "commander";
type Row = Record<string, unknown>;
type Reference = {
    seat: string;
    host: string;
};
export interface RosterMember extends Reference {
    capabilities: string[];
    engagement: string[];
    use_when: string;
    why: string;
    caveat?: string;
}
export interface Roster {
    version: 1;
    id: string;
    name: string;
    purpose: string;
    curator: Reference;
    updated_at: string;
    members: RosterMember[];
}
export interface RosterInventory {
    readAt: string;
    nodes: Row[];
    sources: Row[];
}
/** Select authored fields only: a file cannot supply runtime or observed-model facts. */
export declare function parseRoster(value: unknown): Roster;
export declare function readRosters(folder: string): {
    rosters: Roster[];
    warnings: string[];
};
export declare function readRosterInventory(): Promise<RosterInventory>;
export declare function enrichRosterMember(member: RosterMember, inventory: RosterInventory): {
    live: {
        status: string;
        reason: string;
        runtime: string | null;
        configuredModel: string | null;
        observedModel: null;
        sessionStatus: string | null;
        agentActivity: {
            state: string;
            reason: string | null;
            sampledAt: string | null;
        };
    };
    capabilities: string[];
    engagement: string[];
    use_when: string;
    why: string;
    caveat?: string;
    seat: string;
    host: string;
};
type Deps = {
    folder?: () => string;
    inventory?: () => Promise<RosterInventory>;
};
export declare function rosterCommand(deps?: Deps): Command;
export {};
//# sourceMappingURL=roster.d.ts.map