export interface DaemonStartLock {
    recordChild(pid: number): void;
    release(preserve?: boolean): void;
}
/** One supported local launch owns pre-bind initialization through publication.
 * ponytail: no age-based takeover — a dead launcher can leave a live unbound child.
 * Hard-crash recovery inspects the recorded PIDs before archiving this file. */
export declare function acquireDaemonStartLock(home: string): DaemonStartLock;
//# sourceMappingURL=daemon-start-lock.d.ts.map