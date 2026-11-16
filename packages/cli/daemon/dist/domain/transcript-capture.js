import { startTranscriptRotation, stopTranscriptRotation, getTranscriptRotationOptionsFromEnv, } from "./transcript-rotation.js";
export async function startTmuxTranscriptCapture(tmuxAdapter, transcriptStore, rigName, sessionName) {
    if (!tmuxAdapter || !transcriptStore?.enabled) {
        return { started: false, reason: "transcript_capture_unavailable" };
    }
    if (!transcriptStore.ensureTranscriptDir(rigName)) {
        return { started: false, reason: "transcript_dir_unavailable" };
    }
    const transcriptPath = transcriptStore.getTranscriptPath(rigName, sessionName);
    // V1 pre-release CLI/daemon Item 1: bounded-trail rotation replaces
    // the pipe-pane infinite-growth file. Defaults from env vars + 1000
    // line / 2s baseline; failure inside rotation is best-effort silent
    // and never blocks launch (the prior pipe-pane site treated failure
    // as launch-warning, not launch-blocker, so behavior stays).
    startTranscriptRotation(tmuxAdapter, sessionName, transcriptPath, getTranscriptRotationOptionsFromEnv(), getTranscriptRotationOptionsFromEnv);
    return { started: true };
}
/** End a seat's capture with its session, not only with its rig's teardown: a stopped seat, a removed node or pod
 *  and a cleaned dead seat each record their end with one of these events, emitted once tmux has no such session.
 *  An unclaim records `session.detached` too, but its session keeps running and its saved text stays readable: only
 *  a node removal deletes the node before notifying, so a detach whose node is gone is the one that ended.
 *  A relaunch under the same name starts capture again. */
export function wireTranscriptCaptureStops(db, eventBus) {
    const nodeExists = db.prepare("SELECT 1 FROM nodes WHERE id = ?");
    return eventBus.subscribe((event) => {
        if (event.type === "session.stopped") {
            stopTranscriptRotation(event.sessionName);
        }
        else if (event.type === "session.detached") {
            if (!nodeExists.get(event.nodeId))
                stopTranscriptRotation(event.sessionName);
        }
        else if (event.type === "session.cleaned") {
            for (const sessionName of event.actions.sessionsExited)
                stopTranscriptRotation(sessionName);
        }
    });
}
/** Restore process-local rotation timers after daemon restart. */
export async function resumeRunningTranscriptCaptures(db, tmuxAdapter, transcriptStore) {
    if (!tmuxAdapter || !transcriptStore?.enabled)
        return 0;
    const rows = db.prepare(`
    SELECT r.name AS rig_name, s.session_name
    FROM sessions s
    JOIN nodes n ON n.id = s.node_id
    JOIN rigs r ON r.id = n.rig_id
    JOIN bindings b ON b.node_id = n.id
    WHERE s.status = 'running'
      AND s.id = (
        SELECT s2.id FROM sessions s2
        WHERE s2.node_id = n.id
        ORDER BY s2.id DESC
        LIMIT 1
      )
      AND COALESCE(b.attachment_type, 'tmux') = 'tmux'
      AND b.tmux_session = s.session_name
  `).all();
    let resumed = 0;
    for (const row of rows) {
        const result = await startTmuxTranscriptCapture(tmuxAdapter, transcriptStore, row.rig_name, row.session_name);
        if (result.started)
            resumed += 1;
    }
    return resumed;
}
//# sourceMappingURL=transcript-capture.js.map