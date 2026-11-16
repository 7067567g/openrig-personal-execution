export class AskService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async ask(rigName, question, context) {
        // Resolve rig
        const rigs = this.deps.rigRepo.findRigsByName(rigName);
        if (rigs.length === 0) {
            return {
                question,
                rig: null,
                evidence: { backend: "rg", excerpts: [] },
                insufficient: true,
                guidance: `Rig '${rigName}' not found. List rigs with: rig ps`,
            };
        }
        if (rigs.length > 1) {
            return {
                question,
                rig: null,
                evidence: { backend: "rg", excerpts: [] },
                insufficient: true,
                guidance: `Rig '${rigName}' is ambiguous — ${rigs.length} rigs share that name. Remove duplicates or use a unique name.`,
            };
        }
        // Get topology info
        const entries = this.deps.psProjectionService.getEntries();
        const psEntry = entries.find((e) => e.name === rigName);
        const rigInfo = psEntry
            ? { name: psEntry.name, status: psEntry.status, nodeCount: psEntry.nodeCount, runningCount: psEntry.runningCount, uptime: psEntry.uptime }
            : { name: rigName, status: "unknown", nodeCount: 0, runningCount: 0, uptime: null };
        // L2 — session-scoped archaeology: an explicit session TOKEN searches that
        // one session's provider JSONL (read-only, not the OpenRig transcripts, so
        // transcriptsEnabled does not gate it). Honest-degraded surfaces as guidance.
        if (context?.session) {
            const r = await this.deps.historyQuery.searchSession(context.session, question);
            let guidance;
            if (r.degraded) {
                guidance = r.degraded.message;
            }
            else if (r.found && r.insufficient) {
                guidance = `No matching content in session '${context.session}'. Try different search terms.`;
            }
            if (r.advisory) {
                guidance = guidance ? `${r.advisory}\n${guidance}` : r.advisory;
            }
            return {
                question,
                rig: rigInfo,
                evidence: { backend: r.backend, excerpts: r.excerpts },
                session: {
                    token: r.token,
                    found: r.found,
                    path: r.path,
                    excerpts: r.excerpts,
                    degraded: r.degraded,
                    advisory: r.advisory,
                },
                insufficient: r.insufficient,
                guidance,
            };
        }
        // L1 — seat-scoped archaeology: an explicit seat address searches ONE seat's
        // transcript across every generation (never the whole-rig grep, never the
        // structured peer path). Honest-degraded surfaces as guidance.
        if (context?.seat) {
            if (!this.deps.transcriptsEnabled) {
                return {
                    question,
                    rig: rigInfo,
                    evidence: { backend: "read", excerpts: [] },
                    insufficient: true,
                    guidance: "Transcripts are disabled. Enable with: rig config set transcripts.enabled true",
                };
            }
            const seatResult = await this.deps.historyQuery.searchSeat(rigName, context.seat, question);
            const excerpts = seatResult.hits.map((h) => `[gen ${h.generation}] ${h.text}`);
            let guidance;
            if (seatResult.degraded) {
                guidance = seatResult.degraded.message;
            }
            else if (seatResult.insufficient) {
                guidance = `No matching evidence in seat '${context.seat}' across ${seatResult.generations} generation(s). Try different search terms.`;
            }
            if (seatResult.advisory) {
                guidance = guidance ? `${seatResult.advisory}\n${guidance}` : seatResult.advisory;
            }
            return {
                question,
                rig: rigInfo,
                evidence: { backend: seatResult.backend, excerpts },
                seat: {
                    name: seatResult.seat,
                    generations: seatResult.generations,
                    hits: seatResult.hits,
                    degraded: seatResult.degraded,
                    advisory: seatResult.advisory,
                },
                insufficient: seatResult.insufficient,
                guidance,
            };
        }
        const structured = this.answerStructuredQuestion(rigs[0].id, rigName, question, context);
        if (structured) {
            return {
                question,
                rig: rigInfo,
                evidence: {
                    backend: "structured",
                    excerpts: structured.excerpts,
                },
                insufficient: structured.insufficient,
                guidance: structured.guidance,
            };
        }
        // Check transcripts enabled
        if (!this.deps.transcriptsEnabled) {
            return {
                question,
                rig: rigInfo,
                evidence: { backend: "rg", excerpts: [] },
                insufficient: true,
                guidance: "Transcripts are disabled. Enable with: rig config set transcripts.enabled true",
            };
        }
        // Search transcripts
        const searchResult = await this.deps.historyQuery.search(rigName, question);
        // Search chat messages via the shared history-query seam
        let chatExcerpts;
        const rig = rigs[0];
        const chatResults = this.deps.historyQuery.searchChat(rig.id, question);
        if (chatResults.length > 0) {
            chatExcerpts = chatResults.map((r) => `[${r.sender}] ${r.body}`);
        }
        let guidance;
        const hasChatEvidence = chatExcerpts && chatExcerpts.length > 0;
        const isInsufficient = searchResult.insufficient && !hasChatEvidence;
        if (isInsufficient) {
            if (searchResult.noTranscriptDir) {
                guidance = `No transcript directory for rig '${rigName}'. Transcripts start automatically on next rig up.`;
            }
            else if (searchResult.error) {
                // Backend failure
                guidance = searchResult.error;
            }
            else if (searchResult.backend === "none") {
                // No backend was used (empty keywords)
                guidance = "No useful keywords could be extracted from the question. Try a more specific question.";
            }
            else {
                // Search ran but found no matches
                guidance = "No matching transcript evidence found. Try different search terms.";
            }
        }
        return {
            question,
            rig: rigInfo,
            evidence: {
                backend: searchResult.backend,
                excerpts: searchResult.excerpts,
                chatExcerpts,
            },
            insufficient: isInsufficient,
            guidance,
        };
    }
    answerStructuredQuestion(rigId, rigName, question, context) {
        const normalized = question.trim().toLowerCase();
        if (!normalized)
            return null;
        if (this.looksLikePeerQuestion(normalized)) {
            const identity = this.resolveIdentity(context);
            if (identity && identity.identity.rigId === rigId) {
                return {
                    excerpts: identity.peers.map((peer) => this.formatPeerLine(peer.logicalId, peer.sessionName, peer.runtime, peer.podNamespace)),
                    insufficient: false,
                };
            }
            return {
                excerpts: [],
                insufficient: true,
                guidance: "Cannot determine the current node identity for a peer-relative question. Run rig whoami --json from the target session or retry from an attached managed node.",
            };
        }
        return null;
    }
    resolveIdentity(context) {
        if (!context?.nodeId && !context?.sessionName)
            return null;
        return this.deps.whoamiService?.resolve(context) ?? null;
    }
    looksLikePeerQuestion(question) {
        return /(^|\b)(who are my peers|who are the peers|list peers|show peers|who is in (this|the) rig|list nodes|show nodes)(\b|$)/.test(question);
    }
    formatPeerLine(logicalId, sessionName, runtime, podNamespace) {
        return `${logicalId}  session=${sessionName ?? "unbound"}  runtime=${runtime}  pod=${podNamespace ?? "—"}`;
    }
}
//# sourceMappingURL=ask-service.js.map