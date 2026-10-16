const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospective-test-'));
const at = offset => new Date(Date.parse('2026-01-01T00:00:00Z') + offset * 1000).toISOString();
const usage = (input, cost) => ({ input, output: 2, cacheRead: 10, cacheWrite: 0, reasoning: 1, totalTokens: input + 12, cost: cost === null ? undefined : { total: cost } });
const header = (id, time) => ({ type: 'session', id, timestamp: at(time), cwd: '/fixture' });
const record = (id, time, use) => ({ type: 'message', id, timestamp: at(time), message: { role: 'assistant', provider: 'test', model: 'fixture', usage: use, content: [{ type: 'toolCall', name: 'test' }] } });
const parentFile = path.join(dir, 'parent.jsonl');
const childFile = path.join(dir, 'child.jsonl');
const writeJournal = (file, rows) => fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
writeJournal(parentFile, [header('parent', 0), record('p1', 1, usage(5, 0.1)), { type: 'compaction', id: 'pc', timestamp: at(2), usage: usage(3, 0.2) }, record('p2', 10, usage(11, 0.5))]);
writeJournal(childFile, [header('child', 2), { type: 'session_info', name: 'Child', timestamp: at(2) }, record('c1', 3, usage(7, 0.3)), record('c2', 10, usage(20, 0.9))]);
const run = (manifest, expected, name) => {
  const manifestFile = path.join(dir, `${name}.json`);
  fs.writeFileSync(manifestFile, JSON.stringify({ children: manifest }));
  const out = path.join(dir, name);
  const result = spawnSync(process.execPath, [path.join(__dirname, 'collect.cjs'), '--parent', parentFile, '--parent-thread', 'root', '--expected-children', String(expected), '--manifest', manifestFile, '--out', out, '--cutoff', at(5)], { encoding: 'utf8' });
  return { ...result, out };
};
try {
  const child = { title: 'Child', threadId: 'owned', parentThreadId: 'root', sessionFile: childFile,
    sessionId: 'child', createdAt: at(2), runs: [{ startedAt: at(2), completedAt: at(4), status: 'completed' }] };
  const good = run([child], 1, 'good');
  assert.equal(good.status, 0, good.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(good.out, 'usage.json')));
  assert.equal(report.scope.matchedChildren, 1);
  assert.equal(report.totals.cost, 0.6000000000000001);
  assert.equal(report.totals.totalTokens, 51);
  assert.equal(report.totals.compactions, 1);
  assert.equal(report.children[0].runElapsedMs, 2000);
  assert.equal(report.scope.completeRecordedUsage, true);
  assert.equal(fs.readFileSync(path.join(good.out, 'usage.md'), 'utf8').includes('Known logged total | $0.60'), true);
  assert.notEqual(run([child], 1, 'good').status, 0, 'do not overwrite existing report');
  const missing = run([{ ...child, sessionFile: null }], 1, 'missing');
  assert.equal(missing.status, 0, missing.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(missing.out, 'usage.json'))).scope.completeRecordedUsage, false);
  assert.notEqual(run([{ ...child, parentThreadId: 'unrelated' }], 1, 'unowned').status, 0);
  assert.notEqual(run([child, { ...child, threadId: 'other' }], 2, 'duplicate').status, 0);
  assert.notEqual(run([child], 2, 'count').status, 0);
  writeJournal(childFile, [header('child', 2), record('c1', 3, usage(7, null))]);
  const unpriced = run([child], 1, 'unpriced');
  assert.equal(unpriced.status, 0, unpriced.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(unpriced.out, 'usage.json'))).scope.completeRecordedUsage, false);
  console.log('task-debrief collector: 7 scenarios passed');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
