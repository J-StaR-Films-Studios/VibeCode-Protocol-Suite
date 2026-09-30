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
import { DEFAULT_CONFIG as ROUTER_DEFAULT_CONFIG } from '../.pi/extensions/oauth-router/config.ts';
import { getSourceCheckoutLaunchArgs } from '../src/pi-harness.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-regression-test-'));

try {
  const packageJson = await fs.readJson(path.join(repoRoot, 'package.json'));
  assert.ok(!packageJson.files.includes('plugins'), 'npm package allowlist must not include the entire plugins tree because nested pnpm node_modules contain hard links rejected by npm');
  assert.ok(packageJson.files.includes('plugins/takomi-flow/scripts'), 'npm package retains Takomi Flow runtime scripts through explicit allowlisting');

  for (const [id, rates] of [
    ['gpt-6-astra', { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 }],
    ['gpt-6-sol', { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 }],
    ['gpt-6-luna', { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }],
  ]) {
    const model = ROUTER_DEFAULT_CONFIG.models.find((entry) => entry.id === id);
    assert.deepEqual(model?.cost, rates, `${id} must have OpenAI Standard rates`);
    assert.equal(model?.contextWindow, 240000, `${id} must stay in the short-context pricing tier`);
    assert.equal(model?.maxTokens, 128000);
    for (const upstream of ROUTER_DEFAULT_CONFIG.upstreams) {
      assert.ok(upstream.modelIds.includes(id), `${upstream.id} must expose ${id}`);
    }
  }

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
  assert.equal(sourceLaunchArgs.filter((arg) => arg === '--extension').length, 7, 'source checkout launch must explicitly load every project Takomi extension once');
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
  assert.equal(cacheContent.version, 5, 'stats cache must use version 5 after pricing coverage corrections');
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

  // Persisted Pi 0.99.1 usage entries and a nested root that re-reaches the
  // same canonical file. The global root scans first, so it owns the source.
  const overlapHome = path.join(tempRoot, 'overlap-home');
  const overlapSessions = path.join(overlapHome, '.pi', 'agent', 'sessions');
  const overlapCwd = path.join(overlapSessions, 'nested-project');
  const overlappingTakomiRoot = path.join(overlapCwd, '.pi', 'takomi');
  await fs.ensureDir(overlappingTakomiRoot);
  const overlapSessionFile = path.join(overlappingTakomiRoot, 'overlapping.jsonl');
  await fs.writeFile(overlapSessionFile, [
    JSON.stringify({ type: 'session', id: 'overlapping-session', cwd: overlapCwd, timestamp: '2026-10-01T00:00:00.000Z' }),
    JSON.stringify({ type: 'message', id: 'user', parentId: null, timestamp: '2026-10-01T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'account this turn' }] } }),
    JSON.stringify({ type: 'message', id: 'assistant', parentId: 'user', timestamp: '2026-10-01T00:00:02.000Z', message: { role: 'assistant', provider: 'openai', model: 'unpriced-model', usage: { input: 10, cacheRead: 2, cacheWrite: 3, output: 4 }, content: [] } }),
    JSON.stringify({ type: 'message', id: 'tool', parentId: 'assistant', timestamp: '2026-10-01T00:00:03.000Z', message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'nested-model-tool', usage: { input: 5, cacheRead: 0, cacheWrite: 0, output: 0 }, content: [] } }),
    JSON.stringify({ type: 'compaction', id: 'compaction', parentId: 'tool', timestamp: '2026-10-01T00:00:04.000Z', usage: { input: 7, cacheRead: 0, cacheWrite: 2, output: 3 } }),
    JSON.stringify({ type: 'branch_summary', id: 'branch', parentId: 'compaction', timestamp: '2026-10-01T00:00:05.000Z', usage: { input: 0, cacheRead: 11, cacheWrite: 0, output: 0 } }),
    JSON.stringify({ type: 'usage', id: 'warm', parentId: 'branch', timestamp: '2026-10-01T00:00:06.000Z', kind: 'cache_warm', provider: 'openai', model: 'unpriced-model', usage: { input: 13, cacheRead: 0, cacheWrite: 17, output: 0 } }),
    JSON.stringify({ type: 'usage', id: 'missing', parentId: 'warm', timestamp: '2026-10-01T00:00:07.000Z', kind: 'cache_warm', provider: 'openai', model: 'unpriced-model' }),
    JSON.stringify({ type: 'message', id: 'failed', parentId: 'missing', timestamp: '2026-10-01T00:00:08.000Z', message: { role: 'assistant', provider: 'openai', model: 'unpriced-model', stopReason: 'error', content: [] } }),
  ].join('\n'));
  await fs.writeFile(path.join(overlapSessions, 'distinct.jsonl'), [
    JSON.stringify({ type: 'session', id: 'distinct-session', cwd: overlapCwd, timestamp: '2026-10-01T01:00:00.000Z' }),
    JSON.stringify({ type: 'message', id: 'distinct-assistant', parentId: null, timestamp: '2026-10-01T01:00:01.000Z', message: { role: 'assistant', provider: 'openai', model: 'unpriced-model', usage: { input: 0, cacheRead: 0, cacheWrite: 0, output: 19 }, content: [] } }),
  ].join('\n'));

  async function assertPersistedUsage(collector, cacheFile) {
    const fresh = await collector({ home: overlapHome, cwd: overlapCwd, noCache: true });
    const cachedCold = await collector({ home: overlapHome, cwd: overlapCwd, cacheFile });
    const cached = await collector({ home: overlapHome, cwd: overlapCwd, cacheFile });
    for (const result of [fresh, cachedCold, cached]) {
      assert.deepEqual(result.totals, { input: 35, cache: 13, cacheWrite: 22, output: 26, total: 96, cost: 0, events: 6, toolCalls: 0, turns: 1, pricing: { pricedEvents: 0, unpricedEvents: 6, pricedTokens: 0, unpricedTokens: 96, subscriptionEvents: 0, subscriptionTokens: 0, estimatedTokenEvents: 0, estimatedTokens: 0, missingModels: ['unknown', 'unpriced-model'] } },   'persisted usage must include message, tool-result, compaction, branch, and cache-warm records once');
      assert.deepEqual(result.bySource.map((row) => [row.key, row.total]), [['pi-global', 96]], 'first traversal source must retain the canonical file');
      assert.deepEqual(result.byUsageKind.map((row) => [row.key, row.total]).sort((a, b) => a[0].localeCompare(b[0])), [['branch_summary', 11], ['cache_warm', 30], ['compaction', 12], ['message', 38], ['tool_result', 5]], 'persisted usage kinds must remain distinct');
      assert.equal(result.byModel.find((row) => row.key === 'unknown')?.total, 28, 'tool-result, compaction and branch usage without native model provenance must remain unknown');
      assert.equal(result.sessionRows.length, 2, 'a distinct session file must remain counted');
    }
    assert.deepEqual(cached.totals, fresh.totals, 'cached and uncached totals must match');
    assert.deepEqual(cached.bySource, fresh.bySource, 'cached and uncached source attribution must match');
    assert.deepEqual(cached.byUsageKind, fresh.byUsageKind, 'cached and uncached usage kinds must match');
    return fresh;
  }

  const persistedCore = await assertPersistedUsage(collectTakomiStats, path.join(overlapHome, 'core-cache.json'));
  const persistedRuntime = await assertPersistedUsage(collectRuntimeTakomiStats, path.join(overlapHome, 'runtime-cache.json'));
  assert.deepEqual(persistedRuntime.totals, persistedCore.totals, 'runtime scanner must match core persisted usage totals');
  assert.deepEqual(persistedRuntime.bySource, persistedCore.bySource, 'runtime scanner must preserve core source attribution');
  assert.deepEqual(persistedRuntime.byUsageKind, persistedCore.byUsageKind, 'runtime scanner must preserve usage-kind totals');
  const persistedTurns = await getSessionTurns(overlapSessionFile);
  assert.equal(persistedTurns.length, 1, 'the inspector must retain the user-message turn boundary');
  assert.equal(persistedTurns[0].total, 24, 'the inspector must include assistant and associated tool-result usage only');
  assert.equal(persistedTurns[0].cacheWrite, 3, 'the inspector must retain cache writes in additive fallback totals');

  // Pi tool results carry usage but no model or provider. A priced assistant
  // immediately before one must not lend its identity or rate to that tool.
  const toolHome = path.join(tempRoot, 'tool-usage-home');
  const toolCwd = path.join(tempRoot, 'tool-usage-project');
  const toolSessions = path.join(toolHome, '.pi', 'agent', 'sessions');
  await fs.ensureDir(toolSessions);
  const toolSessionFile = path.join(toolSessions, 'tool-usage.jsonl');
  await fs.writeFile(toolSessionFile, [
    JSON.stringify({ type: 'session', id: 'tool-usage', cwd: toolCwd, timestamp: '2026-10-02T00:00:00.000Z' }),
    JSON.stringify({ type: 'message', timestamp: '2026-10-02T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'run tool' }] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-10-02T00:00:02.000Z', message: { role: 'assistant', provider: 'openai', model: 'gpt-5.4', usage: { input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 }, content: [{ type: 'toolCall', id: 'call-1', name: 'nested-model-tool', arguments: {} }] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-10-02T00:00:03.000Z', message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'nested-model-tool', usage: { input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 }, content: [], isError: false } }),
  ].join('\n'));
  for (const [collector, name] of [[collectTakomiStats, 'core'], [collectRuntimeTakomiStats, 'runtime']]) {
    const options = { home: toolHome, cwd: toolCwd, cacheFile: path.join(toolHome, `${name}-tool-cache.json`), statsConfig: path.join(toolHome, 'absent-config.json'), sessionsRoot: [], projectRoots: [], runHistory: [] };
    for (const statsResult of [await collector({ ...options, noCache: true }), await collector(options), await collector(options)]) {
      assert.equal(statsResult.totals.total, 2_000_000, `${name}: both assistant and tool tokens are counted`);
      assert.equal(statsResult.totals.cost, 2.5, `${name}: only the assistant gets the known-model price`);
      assert.equal(statsResult.byModel.find((row) => row.key === 'gpt-5.4')?.total, 1_000_000, `${name}: tool usage is not attributed to the assistant model`);
      assert.equal(statsResult.byModel.find((row) => row.key === 'unknown')?.total, 1_000_000, `${name}: tool usage retains unknown model provenance`);
      assert.equal(statsResult.byUsageKind.find((row) => row.key === 'tool_result')?.cost, 0, `${name}: tool usage receives no inferred model price`);
      const toolEvent = statsResult.recent.find((event) => event.usageKind === 'tool_result');
      assert.equal(toolEvent?.model, 'unknown', `${name}: tool event model is unknown`);
      assert.equal(toolEvent?.provider, 'unknown', `${name}: tool event provider is unknown`);
    }
  }
  const toolTurns = await getSessionTurns(toolSessionFile);
  assert.equal(toolTurns[0].total, 2_000_000, 'inspector counts both usage records within the user window');
  assert.equal(toolTurns[0].cost, 2.5, 'inspector does not invent tool-model cost');

  // CLI test: takomi stats default (non-interactive stdout), --static, and --json flags
  const { stdout: defaultOut } = await execFileAsync(process.execPath, [cli, 'stats', '--home', statsHome, '--cwd', statsCwd], { cwd: repoRoot, env });
  assert.match(defaultOut, /Coding activity dashboard|Takomi/i, 'default stats invocation should output static dashboard to stdout');

  const { stdout: staticOut } = await execFileAsync(process.execPath, [cli, 'stats', '--static', '--home', statsHome, '--cwd', statsCwd], { cwd: repoRoot, env });
  assert.match(staticOut, /Coding activity dashboard|Takomi/i, 'stats --static should print static dashboard header');

  const { stdout: jsonOut } = await execFileAsync(process.execPath, [cli, 'stats', '--json', '--home', statsHome, '--cwd', statsCwd], { cwd: repoRoot, env });
  const parsedJson = JSON.parse(jsonOut);
  assert.equal(parsedJson.totals.input, 4000010, 'stats --json should output valid stats JSON');

  const newGpt6File = path.join(sessionsDir, 'gpt-6-sol-luna.jsonl');
  await fs.writeFile(newGpt6File, [
    JSON.stringify({ type: 'message', timestamp: '2026-09-24T00:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'test prices' }] } }),
    ...[
      ['gpt-6-sol', 24, 1000], ['gpt-6-sol', 25, 1001],
      ['gpt-6-luna', 26, 1000], ['gpt-6-luna', 27, 1001],
    ].map(([model, day, cacheWrite]) => JSON.stringify({
      type: 'message', timestamp: `2026-09-${day}T00:00:01Z`, message: {
        role: 'assistant', model: `openai-codex/${model}[high]`,
        usage: { input: 100_000, cacheRead: 171_000, cacheWrite, output: 10_000 }, content: [],
      },
    })),
  ].join('\n'));
  const solLunaStats = await collectTakomiStats({ home: statsHome, cwd: statsCwd });
  const solLunaRuntimeStats = await collectRuntimeTakomiStats({ home: statsHome, cwd: statsCwd });
  const expectedByDay = new Map([
    ['2026-09-24', (100_000 * 2 + 171_000 * 0.2 + 1000 * 2.5 + 10_000 * 10) / 1_000_000],
    ['2026-09-25', (100_000 * 4 + 171_000 * 0.4 + 1001 * 5 + 10_000 * 15) / 1_000_000],
    ['2026-09-26', (100_000 * 0.1 + 171_000 * 0.01 + 1000 * 0.125 + 10_000 * 0.5) / 1_000_000],
    ['2026-09-27', (100_000 * 0.2 + 171_000 * 0.02 + 1001 * 0.25 + 10_000 * 0.75) / 1_000_000],
  ]);
  for (const statsResult of [solLunaStats, solLunaRuntimeStats]) {
    assert.equal(statsResult.totals.cacheWrite, 4002, 'GPT-6 cache-write tokens must appear in both stats collectors');
    for (const [day, expected] of expectedByDay) {
      const actual = statsResult.byDay.find((row) => row.key === day)?.cost;
      assert.ok(Math.abs(actual - expected) < 1e-10, `${day} GPT-6 rate and cache write cost must match OpenAI pricing`);
    }
  }
  const newGpt6Turns = await getSessionTurns(newGpt6File);
  const expectedTotal = [...expectedByDay.values()].reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(newGpt6Turns[0].cost - expectedTotal) < 1e-10, 'turn inspector must use the same Sol/Luna pricing');

  console.log('✓ regression tests passed');
} finally {
  await fs.remove(tempRoot);
}
