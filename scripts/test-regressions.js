#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPath, copyOwnedTree } from '../src/owned-tree.js';
import { collectTakomiStats, getSessionTurns } from '../src/takomi-stats.js';
import { collectTakomiStats as collectRuntimeTakomiStats } from '../.pi/extensions/takomi-runtime/takomi-stats.js';
import { getSourceCheckoutLaunchArgs } from '../src/pi-harness.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-regression-test-'));

try {
  const packageJson = await fs.readJson(path.join(repoRoot, 'package.json'));
  assert.ok(!packageJson.files.includes('plugins'), 'npm package allowlist must not include the entire plugins tree because nested pnpm node_modules contain hard links rejected by npm');
  assert.ok(packageJson.files.includes('plugins/takomi-flow/scripts'), 'npm package retains Takomi Flow runtime scripts through explicit allowlisting');

  const cli = path.join(repoRoot, 'bin', 'takomi.js');
  const env = {
    ...process.env,
    TAKOMI_HOME_DIR: path.join(tempRoot, '.takomi'),
    TAKOMI_STORE_PATH: path.join(tempRoot, '.takomi'),
    TAKOMI_SKILLS_ROOT: path.join(tempRoot, '.agents', 'skills'),
    NO_COLOR: '1',
  };

  const { stdout } = await execFileAsync(process.execPath, [cli, 'sync', 'not-a-target'], { cwd: repoRoot, env });
  assert.match(stdout, /Unsupported sync target: not-a-target/, 'legacy sync alias should route to sync handling');
  assert.doesNotMatch(stdout, /Unsupported upgrade target/, 'legacy sync alias must not route to upgrade/refresh handling');

  const sourceLaunchArgs = getSourceCheckoutLaunchArgs(repoRoot);
  assert.ok(sourceLaunchArgs.includes('--no-extensions'), 'source checkout launch must disable duplicate global extension discovery');
  assert.equal(sourceLaunchArgs.filter((arg) => arg === '--extension').length, 6, 'source checkout launch must explicitly load every project Takomi extension once');
  assert.ok(sourceLaunchArgs.some((arg) => arg.endsWith(path.join('antigravity-provider', 'index.ts'))), 'source checkout launch must include the Antigravity provider');
  assert.deepEqual(getSourceCheckoutLaunchArgs(tempRoot), [], 'ordinary projects must retain normal global extension discovery');

  const tree = path.join(tempRoot, 'tree');
  const outside = path.join(tempRoot, 'outside-secret.txt');
  await fs.ensureDir(tree);
  await fs.writeFile(path.join(tree, 'owned.txt'), 'owned');
  await fs.writeFile(outside, 'secret-v1');
  const link = path.join(tree, 'outside-link');
  let symlinkCreated = false;
  try {
    await fs.symlink(outside, link);
    symlinkCreated = true;
  } catch (error) {
    if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    console.log('↷ skipped symlink hash assertion on this platform');
  }
  if (symlinkCreated) {
    const first = await hashPath(tree);
    await fs.writeFile(outside, 'secret-v2');
    const second = await hashPath(tree);
    assert.equal(first, second, 'hashPath must not follow symlinks outside the tree');
    await assert.rejects(() => copyOwnedTree(tree, path.join(tempRoot, 'copied-tree')), /Refusing to copy symlink/, 'managed copy should fail loudly on symlinks');
  }

  const statsHome = path.join(tempRoot, 'stats-home');
  const statsCwd = path.join(tempRoot, 'stats-project');
  const sessionsDir = path.join(statsHome, '.pi', 'agent', 'sessions');
  await fs.ensureDir(sessionsDir);
  await fs.writeFile(path.join(sessionsDir, 'session.jsonl'), [
    JSON.stringify({ type: 'session', id: 's1', cwd: statsCwd, timestamp: '2026-01-01T00:00:00.000Z' }),
    '{bad json}',
    JSON.stringify({ type: 'message', timestamp: '2026-01-01T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'hello' }] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-01-01T00:00:02.000Z', message: { role: 'assistant', model: 'gpt-5.4', usage: { input: 10, cacheRead: 2, output: 3, totalTokens: 15 }, content: [{ type: 'toolCall', name: 'takomi_subagent', arguments: { tasks: [{}, {}] } }] } }),
  ].join('\r\n'));
  const stats = await collectTakomiStats({ home: statsHome, cwd: statsCwd });
  assert.equal(stats.totals.input, 10, 'stats streaming should preserve usage parsing');
  assert.equal(stats.totals.toolCalls, 1, 'stats streaming should preserve tool call counting');
  assert.equal(stats.mostSubagentsSession.subagentCalls, 2, 'stats streaming should preserve subagent task counting');

  await fs.writeFile(path.join(sessionsDir, 'gpt-5-6-pricing.jsonl'), [
    JSON.stringify({ type: 'model_change', timestamp: '2026-07-29T23:59:58.000Z', modelId: 'gpt-5.6-luna' }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-29T23:59:59.000Z', message: { role: 'assistant', model: 'gpt-5.6-luna', usage: { input: 1_000_000, output: 0 }, content: [] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-30T00:00:00.000Z', message: { role: 'assistant', model: 'gpt-5.6-luna', usage: { input: 1_000_000, output: 0 }, content: [] } }),
    JSON.stringify({ type: 'model_change', timestamp: '2026-07-29T23:59:58.000Z', modelId: 'gpt-5.6-terra' }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-29T23:59:59.000Z', message: { role: 'assistant', model: 'gpt-5.6-terra', usage: { input: 0, output: 1_000_000 }, content: [] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-30T00:00:00.000Z', message: { role: 'assistant', model: 'gpt-5.6-terra', usage: { input: 0, output: 1_000_000 }, content: [] } }),
  ].join('\n'));
  await fs.writeFile(path.join(sessionsDir, 'gpt-6-and-discounts.jsonl'), [
    JSON.stringify({ type: 'model_change', timestamp: '2026-09-03T10:00:00.000Z', modelId: 'openai-codex/gpt-6-astra' }),
    JSON.stringify({ type: 'message', timestamp: '2026-09-03T10:01:00.000Z', message: { role: 'assistant', model: 'openai-codex/gpt-6-astra', usage: { input: 1_000_000, cacheRead: 500_000, output: 100_000 }, content: [] } }),
    JSON.stringify({ type: 'model_change', timestamp: '2026-09-03T11:00:00.000Z', modelId: 'gemini-3.8-flash' }),
    JSON.stringify({ type: 'message', timestamp: '2026-09-03T11:01:00.000Z', message: { role: 'assistant', model: 'gemini-3.8-flash', usage: { input: 1_000_000, cacheRead: 0, output: 1_000_000 }, content: [] } }),
  ].join('\n'));

  // Standard collection
  const astraStats = await collectTakomiStats({ home: statsHome, cwd: statsCwd });
  // GPT-6 Astra: (1,000,000 * 10.00 + 500,000 * 1.00 + 100,000 * 50.00) / 1,000,000 = 10 + 0.5 + 5 = 15.5
  // Gemini 3.8 Flash: (1,000,000 * 0.75 + 1,000,000 * 3.75) / 1,000,000 = 0.75 + 3.75 = 4.5
  const septDay = astraStats.byDay.find((row) => row.key === '2026-09-03');
  assert.equal(septDay?.cost, 20.0, 'GPT-6 Astra and Gemini 3.8 Flash must price correctly under canonical resolution');

  // byMonth aggregation check
  const julyMonth = astraStats.byMonth.find((row) => row.key === '2026-07');
  const septMonth = astraStats.byMonth.find((row) => row.key === '2026-09');
  assert.equal(julyMonth?.cost, 28.2, 'July monthly total must sum 2026-07-29 ($16) and 2026-07-30 ($12.2)');
  assert.equal(septMonth?.cost, 20.0, 'September monthly total must reflect September events');

  // Discount test: 20% discount on September usage
  const discountedStats = await collectTakomiStats({
    home: statsHome,
    cwd: statsCwd,
    discounts: [{ month: '2026-09', discount_pct: 20 }],
  });
  const discountedSeptDay = discountedStats.byDay.find((row) => row.key === '2026-09-03');
  assert.equal(discountedSeptDay?.cost, 16.0, '20% discount on September usage must reduce cost from $20.0 to $16.0');

  // Cache persistence test
  const cacheFile = path.join(statsHome, '.pi', 'takomi', 'cache', 'stats-cache.json');
  assert.ok(await fs.pathExists(cacheFile), 'stats cache file must be created at ~/.pi/takomi/cache/stats-cache.json');
  const cacheContent = await fs.readJson(cacheFile);
  assert.equal(cacheContent.version, 2, 'stats cache must use version 2');
  const cachedKeys = Object.keys(cacheContent.entries || {});
  assert.ok(cachedKeys.length >= 3, 'stats cache must contain entries for created session files');

  // Cache hit test: verify identical results on reload
  const cachedStats = await collectTakomiStats({ home: statsHome, cwd: statsCwd });
  assert.equal(cachedStats.totals.input, astraStats.totals.input, 'cached stats run must match fresh scan input totals');
  assert.equal(cachedStats.totals.cost, astraStats.totals.cost, 'cached stats run must match fresh scan cost totals');

  // Runtime parity test: verify runtime collector also produces matching totals
  const runtimeStats = await collectRuntimeTakomiStats({ home: statsHome, cwd: statsCwd });
  assert.equal(runtimeStats.totals.input, astraStats.totals.input, 'runtime extension stats must match core package input totals');
  assert.equal(runtimeStats.totals.cost, astraStats.totals.cost, 'runtime extension stats must match core package cost totals');

  // getSessionTurns test: turn-by-turn inspector extraction
  const sessionFile = path.join(sessionsDir, 'session.jsonl');
  const turns = await getSessionTurns(sessionFile);
  assert.equal(turns.length, 1, 'session turns should extract 1 turn');
  assert.equal(turns[0].title, 'hello', 'turn title should match user prompt');
  assert.equal(turns[0].model, 'gpt-5.4', 'turn model should reflect assistant model');
  assert.equal(turns[0].input, 10, 'turn input tokens should match usage');
  assert.equal(turns[0].cache, 2, 'turn cache tokens should match usage');
  assert.equal(turns[0].output, 3, 'turn output tokens should match usage');
  assert.equal(turns[0].total, 15, 'turn total tokens should match usage');
  assert.deepEqual(turns[0].tools, ['takomi_subagent'], 'turn tools should record invoked tool names');

  // CLI test: takomi stats default (non-interactive stdout), --static, and --json flags
  const { stdout: defaultOut } = await execFileAsync(process.execPath, [cli, 'stats', '--home', statsHome, '--cwd', statsCwd], { cwd: repoRoot, env });
  assert.match(defaultOut, /Coding activity dashboard|Takomi/i, 'default stats invocation should output static dashboard to stdout');

  const { stdout: staticOut } = await execFileAsync(process.execPath, [cli, 'stats', '--static', '--home', statsHome, '--cwd', statsCwd], { cwd: repoRoot, env });
  assert.match(staticOut, /Coding activity dashboard|Takomi/i, 'stats --static should print static dashboard header');

  const { stdout: jsonOut } = await execFileAsync(process.execPath, [cli, 'stats', '--json', '--home', statsHome, '--cwd', statsCwd], { cwd: repoRoot, env });
  const parsedJson = JSON.parse(jsonOut);
  assert.equal(parsedJson.totals.input, 4000010, 'stats --json should output valid stats JSON');

  console.log('✓ regression tests passed');
} finally {
  await fs.remove(tempRoot);
}
