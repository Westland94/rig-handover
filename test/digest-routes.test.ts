import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Route tests (plan § 2d) against a temp runs dir; runs/ itself is read-only.
const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
writeFileSync(
  join(runsDir, '2026-11-01.jsonl'),
  [
    '{"at":"2026-11-01T23:00:00+01:00","job":"b/job","status":"ok","owner":"rook"}',
    '{"at":"2026-11-01T23:05:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
    '',
  ].join('\n'),
);
writeFileSync(join(runsDir, '2026-11-02.jsonl'), '');
writeFileSync(
  join(runsDir, '2026-11-03.jsonl'),
  [
    '{"at":"2026-11-03T23:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
    '{"at":"2026-11-03T23:59:00+01:00","job":"a/job","status":"o',
    '',
  ].join('\n'),
);
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);

describe('digest routes', () => {
  it('page renders 200 with the rows, sorted by job', async () => {
    const res = await app.request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('—'); // the null owner
  });

  it('JSON returns the same jobs in the same order as the page', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['a/job', 'b/job']);
    expect(body.rows[0]).toMatchObject({ lastStatus: 'fail', lastError: 'boom', owner: null });
  });

  it('404 for a night with no file, page and JSON', async () => {
    expect((await app.request('/digest/2026-11-09')).status).toBe(404);
    expect((await app.request('/api/digest/2026-11-09')).status).toBe(404);
  });

  it('the empty night renders "nothing ran" and empty rows', async () => {
    const res = await app.request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
    const api = await app.request('/api/digest/2026-11-02');
    expect((await api.json()).rows).toEqual([]);
  });

  it('a night with a bad line still renders, and the JSON counts it', async () => {
    const res = await app.request('/digest/2026-11-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('a/job');
    const api = await app.request('/api/digest/2026-11-03');
    expect((await api.json()).badLines).toBe(1);
  });

  it('the board links each night to its digest with counts', async () => {
    const res = await app.request('/');
    const html = await res.text();
    expect(html).toContain('href="/digest/2026-11-01"');
    expect(html).toContain('ok 1 · retry 0 · fail 1');
  });
});
