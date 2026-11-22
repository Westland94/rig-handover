import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightDigest, ReadNight } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner?: string | null;
  error?: string;
};

function parseLine(text: string): LogLine | null {
  try {
    const value = JSON.parse(text) as Partial<LogLine>;
    if (
      typeof value.at !== 'string' ||
      typeof value.job !== 'string' ||
      (value.status !== 'ok' && value.status !== 'retry' && value.status !== 'fail')
    ) {
      return null;
    }
    return value as LogLine;
  } catch {
    return null;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  const counts: Record<JobStatus, number> = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    const entry = parseLine(line);
    if (entry === null) {
      badLines += 1;
      continue;
    }
    counts[entry.status] += 1;
    const row = byJob.get(entry.job);
    if (row === undefined) {
      byJob.set(entry.job, {
        job: entry.job,
        owner: entry.owner ?? null,
        runs: 1,
        retries: entry.status === 'retry' ? 1 : 0,
        lastStatus: entry.status,
        lastError: entry.error ?? null,
        firstAt: entry.at,
        lastAt: entry.at,
      });
    } else {
      row.runs += 1;
      if (entry.status === 'retry') row.retries += 1;
      row.lastStatus = entry.status;
      if (entry.owner != null) row.owner = entry.owner;
      if (entry.error) row.lastError = entry.error;
      row.lastAt = entry.at;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  const digest: NightDigest = { night, rows, badLines, counts };
  return digest;
};
