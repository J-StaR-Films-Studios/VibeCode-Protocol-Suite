import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectTakomiStats, getSessionTurns, fmtEstimatedCost } from '../src/takomi-stats.js';
import { collectTakomiStats as collectRuntimeStats } from '../.pi/extensions/takomi-runtime/takomi-stats.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-price-test-'));
const collectors = [collectTakomiStats, collectRuntimeStats];
const stamp = '2026-09-01T00:00:00Z';
function auxiliary(model, usage, timestamp = stamp) {
  return { type: 'usage', timestamp, provider: 'openai', model, kind: 'cache_warm', usage };
}
async function fixture(name, entries, models) {
  const home = path.join(root, name, 'home');
  const cwd = path.join(root, name, 'project');
  const sessions = path.join(home, '.pi', 'agent', 'sessions');
  await fs.mkdir(sessions, { recursive: true });
  const file = path.join(sessions, 'session.jsonl');
  await fs.writeFile(file, entries.map(entry => JSON.stringify(entry)).join('\n'));
  const configFile = path.join(home, '.pi', 'agent', 'oauth-router', 'config.json');
  if (models) {
    await fs.mkdir(path.dirname(configFile), { recursive: true });
    await fs.writeFile(configFile, JSON.stringify({ models }));
  }
  return { home, cwd, file, configFile };
}
async function checkPaths(options, verify) {
  const results = [];
  for (const [index, collector] of collectors.entries()) {
    const cacheFile = path.join(options.home, `cache-${index}.json`);
    const fresh = await collector({ ...options, noCache: true });
    const cold = await collector({ ...options, cacheFile });
    const warm = await collector({ ...options, cacheFile });
    for (const result of [fresh, cold, warm]) verify(result);
    for (const key of ['totals', 'byDay', 'byMonth', 'byModel', 'bySource', 'byProject', 'byUsageKind', 'recent']) {
      assert.deepEqual(cold[key], fresh[key], `cold ${key}`);
      assert.deepEqual(warm[key], fresh[key], `warm ${key}`);
      if (results.length) assert.deepEqual(fresh[key], results[0][key], `runtime ${key}`);
    }
    results.push(fresh);
  }
  return results[0];
}
function approx(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`); }
try {
  const cacheWrite = await fixture('cache-write', [auxiliary('gpt-5.4', { cacheWrite: 1_000_000 })]);
  await checkPaths(cacheWrite, stats => {
    assert.equal(stats.totals.cost, 3.125, 'existing recorded cache-write rate, not a new assumption');
    assert.equal(stats.totals.total, 1_000_000);
    assert.equal(stats.totals.pricing.pricedTokens, 1_000_000);
    assert.equal(stats.totals.pricing.unpricedEvents, 0);
    assert.equal(stats.recent[0].rateSource, 'recorded-catalog');
    assert.deepEqual(stats.recent[0].unpricedComponents, []);
  });
  console.log('✓ auxiliary gpt-5.4 cacheWrite=1000000: core/runtime $3.125, cold/warm/uncached');

  const mixed = await fixture('mixed', [
    { type: 'message', timestamp: stamp, message: { role: 'user', content: [{ type: 'text', text: 'synthetic accounting' }] } },
    { type: 'message', timestamp: stamp, message: { role: 'assistant', provider: 'openai', model: 'gpt-5.4', usage: { input: 100, cacheRead: 20, output: 10 }, content: [] } },
    { type: 'message', timestamp: stamp, message: { role: 'toolResult', usage: { input: 40 }, content: [] } },
    auxiliary('missing-model', { input: 50, output: 5 }),
    auxiliary('custom-partial', { input: 100, cacheWrite: 25, output: 10 }),
    { type: 'message', timestamp: stamp, message: { role: 'assistant', provider: 'antigravity', model: 'claude-sonnet-4-6', usage: { input: 200, cacheWrite: 30, output: 20 }, content: [] } },
  ], [{ id: 'custom-partial', cost: { input: 2, output: 10 } }]);
  const mixedStats = await checkPaths(mixed, stats => {
    approx(stats.totals.cost, 0.000705);
    assert.deepEqual(stats.totals.pricing, { pricedEvents: 1, unpricedEvents: 3, pricedTokens: 240, unpricedTokens: 120, subscriptionEvents: 1, subscriptionTokens: 250, estimatedTokenEvents: 1, estimatedTokens: 250, missingModels: ['custom-partial', 'missing-model', 'unknown'] });
    assert.equal(stats.bySource[0].key, 'pi-global', 'broad Pi source retained');
    assert.deepEqual(stats.sessionRows[0].pricing, stats.totals.pricing);
    const tool = stats.recent.find(event => event.usageKind === 'tool_result');
    assert.equal(tool.model, 'unknown');
    assert.equal(tool.provider, 'unknown');
    assert.equal(tool.cost, 0);
    assert.equal(tool.priceBasis, 'missing-rate');
    const partial = stats.recent.find(event => event.model === 'custom-partial');
    assert.equal(partial.rateSource, 'oauth-router-catalog');
    assert.deepEqual(partial.unpricedComponents, ['cacheWrite']);
    approx(partial.cost, 0.0003, 'known input/output subtotal retained');
    const sub = stats.recent.find(event => event.priceBasis === 'subscription');
    assert.equal(sub.cost, 0);
    assert.equal(sub.tokenProvenance, 'estimated');
    assert.deepEqual(sub.pricing.missingModels, []);
    assert.equal(fmtEstimatedCost(stats.byModel.find(row => row.key === 'missing-model')), 'unpriced');
    assert.match(fmtEstimatedCost(stats.totals), /\*~/);
  });
  const turns = await getSessionTurns(mixed.file, [], mixed.home);
  assert.equal(turns[0].total, 420, 'bounded assistant/tool tokens only');
  approx(turns[0].cost, 0.000405);
  assert.deepEqual(turns[0].pricing, { pricedEvents: 1, unpricedEvents: 1, pricedTokens: 130, unpricedTokens: 40, subscriptionEvents: 1, subscriptionTokens: 250, estimatedTokenEvents: 1, estimatedTokens: 250, missingModels: ['unknown'] });
  assert.equal(turns[0].cacheWrite, 30);
  console.log('✓ mixed/unknown/partial/subscription coverage and bounded tool provenance');

  // A new catalog must invalidate warm generated rows, including omitted rates.
  await fs.writeFile(mixed.configFile, JSON.stringify({ models: [{ id: 'custom-partial', cost: { input: 4, output: 10, cacheWrite: 0 } }] }));
  const changed = await checkPaths(mixed, stats => {
    approx(stats.totals.cost, mixedStats.totals.cost + 0.0002);
    assert.equal(stats.totals.pricing.pricedEvents, 2);
    assert.equal(stats.totals.pricing.unpricedEvents, 2);
    assert.equal(stats.totals.pricing.unpricedTokens, 95);
    assert.equal(stats.recent.find(event => event.model === 'custom-partial').priceBasis, 'local-rate', 'explicit zero is a known rate');
  });
  assert.equal(changed.byModel.find(row => row.key === 'custom-partial').pricing.pricedTokens, 135);

  const historical = await fixture('historical', [
    auxiliary('ar-gpt-5.6-luna', { input: 1_000_000, cacheWrite: 1_000_000 }, '2026-07-29T23:59:59Z'),
    auxiliary('openai-codex/gpt-5.6-luna[high]', { input: 1_000_000, cacheWrite: 1_000_000 }, '2026-07-30T00:00:00Z'),
    auxiliary('gpt-5.6-terra', { cacheWrite: 1_000_000 }, '2026-07-29T23:59:59Z'),
    auxiliary('gpt-5.6-terra', { cacheWrite: 1_000_000 }, '2026-07-30T00:00:00Z'),
    auxiliary('gemini-3.8-flash-preview', { input: 1_000_000, cacheWrite: 1_000_000 }, '2026-12-31T23:59:59Z'),
    auxiliary('gemini-3.8-flash-preview', { input: 1_000_000, cacheWrite: 1_000_000 }, '2027-01-01T00:00:00Z'),
    auxiliary('gpt-6-sol', { input: 272_000, output: 1000 }),
    auxiliary('gpt-6-sol', { input: 272_000, cacheWrite: 1, output: 1000 }),
  ]);
  await checkPaths({ ...historical, discounts: [{ model: 'gpt-5.6-luna', month: '2026-07', discountPct: 20 }, { model: 'gpt-5.6-terra', start: '2026-07-30', end: '2026-07-30', discount_pct: 20 }] }, stats => {
    approx(stats.byDay.find(row => row.key === '2026-07-29').cost, 2.25 * 0.8 + 3.125);
    approx(stats.byDay.find(row => row.key === '2026-07-30').cost, 0.45 * 0.8 + 2.5 * 0.8);
    assert.equal(stats.byDay.find(row => row.key === '2026-12-31').cost, 1.5);
    assert.equal(stats.byDay.find(row => row.key === '2027-01-01').cost, 3);
    approx(stats.byDay.find(row => row.key === '2026-09-01').cost, 0.554 + 1.103005);
    assert.equal(stats.totals.pricing.pricedEvents, 8);
    assert.equal(stats.totals.pricing.unpricedEvents, 0);
    assert.equal(stats.recent.find(event => event.model === 'ar-gpt-5.6-luna').rateSource, 'recorded-schedule');
  });
  console.log('✓ recorded historical cache-write schedules, aliases, cutoffs, discounts and long-context factors');

  for (const [index, collector] of collectors.entries()) {
    const cacheFile = path.join(cacheWrite.home, `old-${index}.json`);
    await fs.writeFile(cacheFile, JSON.stringify({ version: 4, entries: { [await fs.realpath(cacheWrite.file)]: { mtimeMs: (await fs.stat(cacheWrite.file)).mtimeMs, row: { cost: 999 }, events: [] } } }));
    const stats = await collector({ ...cacheWrite, cacheFile });
    assert.equal(stats.totals.cost, 3.125);
    const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    assert.equal(cached.version, 5);
    const entry = Object.values(cached.entries)[0];
    assert.deepEqual(entry.row.pricing, stats.totals.pricing);
    assert.equal(entry.events[0].rateSource, 'recorded-catalog');
    assert.ok(entry.pricesKey);
  }
  console.log('✓ v4 invalidation, v5 serialized coverage/provenance and catalog-aware cache keys');
  console.log('✓ stats pricing tests passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
