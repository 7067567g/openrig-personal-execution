import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
const SESSION_SOURCE_OPTIONAL_REF_FIELDS = ["value", "version"];
// If a union arm gains an optional ref field that is not enumerated above,
// this line fails to compile and NAMES the missing field in its type.
const _sessionSourceEnumerationComplete = true;
void _sessionSourceEnumerationComplete;
function serializeSessionSource(ss) {
    const srcRef = ss.ref;
    const ref = { kind: ss.ref.kind };
    for (const field of SESSION_SOURCE_OPTIONAL_REF_FIELDS) {
        if (srcRef[field] !== undefined)
            ref[field] = srcRef[field];
    }
    return { mode: ss.mode, ref };
}
// OPR.0.5.6.23 (desk ruling, transition 45061 on the slice's whole-goal row):
// the services family rides the same presence-invariant seam. The mapped
// record below must name EVERY RigServicesSpec key — a new field on the type
// fails compilation here naming the missing key, never a silent round-trip
// to absence.
const SERVICES_FIELD_EMITTERS = {
    kind: (v) => ["kind", v],
    composeFile: (v) => ["compose_file", v],
    projectName: (v) => ["project_name", v],
    profiles: (v) => ["profiles", v],
    downPolicy: (v) => ["down_policy", v],
    waitFor: (v) => ["wait_for", v.map(serializeWaitTarget)],
    surfaces: (v) => ["surfaces", serializeServicesSurfaces(v)],
    checkpoints: (v) => ["checkpoints", v.map(serializeCheckpointHook)],
};
function serializeServices(services) {
    const out = {};
    for (const key of Object.keys(SERVICES_FIELD_EMITTERS)) {
        const value = services[key];
        if (value === undefined)
            continue;
        const [yamlKey, yamlValue] = SERVICES_FIELD_EMITTERS[key](value);
        out[yamlKey] = yamlValue;
    }
    return out;
}
function serializeWaitTarget(target) {
    const t = {};
    if (target.service !== undefined)
        t["service"] = target.service;
    if (target.condition !== undefined)
        t["condition"] = target.condition;
    if (target.url !== undefined)
        t["url"] = target.url;
    if (target.tcp !== undefined)
        t["tcp"] = target.tcp;
    return t;
}
function serializeServicesSurfaces(surfaces) {
    const s = {};
    if (surfaces.urls !== undefined)
        s["urls"] = surfaces.urls.map((u) => ({ name: u.name, url: u.url }));
    if (surfaces.commands !== undefined) {
        s["commands"] = surfaces.commands.map((c) => ({ name: c.name, command: c.command }));
    }
    return s;
}
function serializeCheckpointHook(hook) {
    const h = { id: hook.id, export: hook.exportCommand };
    if (hook.importCommand !== undefined)
        h["import"] = hook.importCommand;
    return h;
}
/**
 * Pod-aware RigSpec codec. Canonical contract for the AgentSpec reboot.
 */
export class RigSpecCodec {
    static parse(yamlString) {
        return parseYaml(yamlString);
    }
    static serialize(spec) {
        const doc = {
            version: spec.version,
            name: spec.name,
        };
        if (spec.summary)
            doc["summary"] = spec.summary;
        if (spec.cultureFile)
            doc["culture_file"] = spec.cultureFile;
        // OPR.0.4.8.3 Seam B: rig-level permission_policy ref round-trips through serialization.
        if (spec.permissionPolicy)
            doc["permission_policy"] = spec.permissionPolicy;
        if (spec.nonInterruptive !== undefined)
            doc["non_interruptive"] = spec.nonInterruptive;
        if (spec.env)
            doc["env"] = { ...spec.env };
        if (spec.managedBlocks)
            doc["managed_blocks"] = { ...spec.managedBlocks };
        if (spec.docs && spec.docs.length > 0)
            doc["docs"] = spec.docs.map((d) => ({ path: d.path }));
        if (spec.startup)
            doc["startup"] = serializeStartupBlock(spec.startup);
        if (spec.services)
            doc["services"] = serializeServices(spec.services);
        // PL-007: optional rig-level workspace block. Repos round-trip with
        // their normalized absolute path; the codec does not strip back to
        // workspace-relative since it has no signal that the original author
        // wrote a relative path.
        if (spec.workspace) {
            const ws = {
                workspace_root: spec.workspace.workspaceRoot,
                repos: spec.workspace.repos.map((r) => ({ name: r.name, path: r.path, kind: r.kind })),
            };
            if (spec.workspace.defaultRepo !== undefined)
                ws["default_repo"] = spec.workspace.defaultRepo;
            if (spec.workspace.knowledgeRoot !== undefined)
                ws["knowledge_root"] = spec.workspace.knowledgeRoot;
            doc["workspace"] = ws;
        }
        doc["pods"] = spec.pods.map((pod) => {
            const p = {
                id: pod.id,
                label: pod.label,
            };
            if (pod.summary)
                p["summary"] = pod.summary;
            if (pod.continuityPolicy) {
                const cp = { enabled: pod.continuityPolicy.enabled };
                if (pod.continuityPolicy.syncTriggers)
                    cp["sync_triggers"] = pod.continuityPolicy.syncTriggers;
                if (pod.continuityPolicy.artifacts) {
                    const a = {};
                    if (pod.continuityPolicy.artifacts.sessionLog !== undefined)
                        a["session_log"] = pod.continuityPolicy.artifacts.sessionLog;
                    if (pod.continuityPolicy.artifacts.restoreBrief !== undefined)
                        a["restore_brief"] = pod.continuityPolicy.artifacts.restoreBrief;
                    if (pod.continuityPolicy.artifacts.quiz !== undefined)
                        a["quiz"] = pod.continuityPolicy.artifacts.quiz;
                    cp["artifacts"] = a;
                }
                if (pod.continuityPolicy.restoreProtocol) {
                    const rp = {};
                    if (pod.continuityPolicy.restoreProtocol.peerDriven !== undefined)
                        rp["peer_driven"] = pod.continuityPolicy.restoreProtocol.peerDriven;
                    if (pod.continuityPolicy.restoreProtocol.verifyViaQuiz !== undefined)
                        rp["verify_via_quiz"] = pod.continuityPolicy.restoreProtocol.verifyViaQuiz;
                    cp["restore_protocol"] = rp;
                }
                p["continuity_policy"] = cp;
            }
            if (pod.startup)
                p["startup"] = serializeStartupBlock(pod.startup);
            p["members"] = pod.members.map((m) => {
                const member = {
                    id: m.id,
                    agent_ref: m.agentRef,
                    profile: m.profile,
                    runtime: m.runtime,
                    cwd: m.cwd,
                };
                if (m.label)
                    member["label"] = m.label;
                if (m.codexConfigProfile)
                    member["codex_config_profile"] = m.codexConfigProfile;
                if (m.model)
                    member["model"] = m.model;
                if (m.effort)
                    member["effort"] = m.effort;
                // OPR.0.4.6.FAC1: role round-trips through spec serialization.
                if (m.role)
                    member["role"] = m.role;
                // OPR.0.4.8.3 Seam B: per-seat permission_policy ref round-trips through spec serialization.
                if (m.permissionPolicy)
                    member["permission_policy"] = m.permissionPolicy;
                if (m.env)
                    member["env"] = { ...m.env };
                if (m.restorePolicy)
                    member["restore_policy"] = m.restorePolicy;
                if (m.startup)
                    member["startup"] = serializeStartupBlock(m.startup);
                // OPR.0.5.6.20 field, OPR.0.5.6.23 fix: parse carries it (schema
                // normalize), so serialize must too — same silent-erasure class.
                if (m.compactionStrategy)
                    member["compaction_strategy"] = m.compactionStrategy;
                if (m.sessionSource) {
                    member["session_source"] = serializeSessionSource(m.sessionSource);
                }
                // (rebuild ref.value is an array; the codec re-emits it as-is via the
                //  same `ref.value` slot — the YAML serializer handles array emission.)
                if (m.starterRef) {
                    member["starter_ref"] = { name: m.starterRef.name };
                }
                return member;
            });
            p["edges"] = pod.edges.map((e) => ({ kind: e.kind, from: e.from, to: e.to }));
            return p;
        });
        doc["edges"] = spec.edges.map((e) => ({ kind: e.kind, from: e.from, to: e.to }));
        return stringifyYaml(doc);
    }
}
function serializeStartupBlock(startup) {
    return {
        files: startup.files.map((f) => {
            const file = { path: f.path };
            if (f.orientation)
                file["orientation"] = f.orientation;
            if (f.deliveryHint !== "auto")
                file["delivery_hint"] = f.deliveryHint;
            if (!f.required)
                file["required"] = false;
            if (f.appliesOn.length !== 2 || !f.appliesOn.includes("fresh_start") || !f.appliesOn.includes("restore")) {
                file["applies_on"] = f.appliesOn;
            }
            return file;
        }),
        actions: startup.actions.map((a) => {
            const action = {
                type: a.type,
                value: a.value,
                phase: a.phase,
                idempotent: a.idempotent,
            };
            if (a.appliesOn.length !== 2 || !a.appliesOn.includes("fresh_start") || !a.appliesOn.includes("restore")) {
                action["applies_on"] = a.appliesOn;
            }
            return action;
        }),
    };
}
/**
 * Legacy flat-node RigSpec codec (pre-reboot).
 * TODO: Remove when AS-T08b/AS-T12 migrate all consumers.
 */
export class LegacyRigSpecCodec {
    static parse(yamlString) {
        return parseYaml(yamlString);
    }
    static serialize(spec) {
        const doc = {
            schema_version: spec.schemaVersion,
            name: spec.name,
            version: spec.version,
            nodes: spec.nodes.map((node) => {
                const n = { id: node.id, runtime: node.runtime };
                if (node.role != null)
                    n["role"] = node.role;
                if (node.model != null)
                    n["model"] = node.model;
                if (node.effort != null)
                    n["effort"] = node.effort;
                if (node.cwd != null)
                    n["cwd"] = node.cwd;
                if (node.surfaceHint != null)
                    n["surface_hint"] = node.surfaceHint;
                if (node.workspace != null)
                    n["workspace"] = node.workspace;
                if (node.restorePolicy != null)
                    n["restore_policy"] = node.restorePolicy;
                if (node.packageRefs && node.packageRefs.length > 0)
                    n["package_refs"] = node.packageRefs;
                return n;
            }),
            edges: spec.edges.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind })),
        };
        return stringifyYaml(doc);
    }
}
//# sourceMappingURL=rigspec-codec.js.map