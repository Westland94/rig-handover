import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line, the night still renders', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.badLines).toBe(1);
    expect(digest!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('aggregates runs, retries, last status and last error per job', () => {
    const digest = readNight('runs', '2026-10-28')!;
    const byJob = new Map(digest.rows.map((r) => [r.job, r]));
    expect(byJob.get('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
    });
    expect(byJob.get('notes/backup')).toMatchObject({
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
    expect(byJob.get('lane/sync')).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok' });
  });

  it('keeps a row whose owner is null', () => {
    const digest = readNight('runs', '2026-10-28')!;
    expect(digest.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('reads 2026-10-27 with no bad lines', () => {
    const digest = readNight('runs', '2026-10-27')!;
    expect(digest.badLines).toBe(0);
    expect(digest.rows).toHaveLength(4);
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-10-30')).toBeNull();
  });
});
