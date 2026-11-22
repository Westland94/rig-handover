// The digest contract (plan § 1). Everything in plan § 2 codes against this file:
// the page, the JSON, the board link and the route tests all read a NightDigest,
// so the page and the JSON can never disagree (ADR 0001).

export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  /** Null when the log never names an owner; the page shows `—`. */
  owner: string | null;
  /** Lines seen for this job that night. */
  runs: number;
  /** Of those, how many were retries. */
  retries: number;
  lastStatus: JobStatus;
  /** The most recent error the job reported, or null if it never did. */
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  /** One row per job, sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse. Counted, never thrown: the night still renders. */
  badLines: number;
  /** Line-level counts for the night, for the status board. */
  counts: Record<JobStatus, number>;
};

/** Reads one night. Returns null when the night has no file. */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
