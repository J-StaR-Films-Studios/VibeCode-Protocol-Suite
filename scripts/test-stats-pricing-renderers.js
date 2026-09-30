import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { collectTakomiStats, renderTakomiStats } from '../src/takomi-stats.js';
import { renderTakomiStats as renderRuntimeStats } from '../.pi/extensions/takomi-runtime/takomi-stats.js';
import { launchTakomiTUI } from '../src/takomi-tui.js';
import { startTakomiWebServer } from '../src/takomi-web.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-price-render-test-'));
const stripAnsi = text => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
try {
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  const sessions = path.join(home, '.pi', 'agent', 'sessions');
  await fs.mkdir(sessions, { recursive: true });
  const timestamp = '2026-09-01T00:00:00Z';
  await fs.writeFile(path.join(sessions, 'render.jsonl'), [
    { type: 'message', timestamp, message: { role: 'user', content: [{ type: 'text', text: 'synthetic inspector' }] } },
    { type: 'message', timestamp, message: { role: 'assistant', provider: 'openai', model: 'gpt-5.4', usage: { input: 1_000_000 }, content: [] } },
    { type: 'message', timestamp, message: { role: 'toolResult', usage: { input: 10 }, content: [] } },
    { type: 'message', timestamp, message: { role: 'assistant', provider: 'antigravity', model: 'gemini-3.8-flash', usage: { input: 20, cacheWrite: 3, output: 4 }, content: [] } },
  ].map(entry => JSON.stringify(entry)).join('\n'));
  const stats = await collectTakomiStats({ home, cwd, noCache: true });
  for (const render of [renderTakomiStats, renderRuntimeStats]) {
    for (const opts of [{}, { full: true }, { view: 'models' }, { view: 'projects' }, { view: 'daily' }, { view: 'projects-full' }]) {
      const text = stripAnsi(render(stats, opts));
      assert.match(text, /\$2\.50/, 'known numeric subtotal stays visible');
      if (opts.view !== 'models') assert.match(text, /\$2\.50\*~/, 'incomplete/subscription aggregate markers');
      assert.match(text, /1 priced \/ 1 unpriced \/ 1 subscription events/);
      assert.match(text, /not invoices or quota/);
      assert.match(text, /Missing rates: unknown/);
    }
    const modelText = stripAnsi(render(stats, { view: 'models' }));
    assert.match(modelText, /unknown\s+10\s+unpriced/);
    assert.match(modelText, /27 estimated subscription tokens/);
  }
  console.log('✓ static/core/runtime focused and full summaries');

  // Render the existing interactive tabs against synthetic data, without a terminal or real-home scan.
  const tty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const write = process.stdout.write;
  const exit = process.exit;
  const listenerSets = [[process, 'SIGINT'], [process, 'SIGTERM'], [process.stdout, 'resize'], [process.stdin, 'keypress']].map(([emitter, event]) => ({ emitter, event, before: emitter.listeners(event) }));
  let output = '';
  let exited = false;
  try {
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    process.stdout.write = chunk => { output += chunk; return true; };
    process.exit = () => { exited = true; };
    launchTakomiTUI(stats, { home, cwd });
    assert.match(stripAnsi(output), /1 priced \/ 1 unpriced \/ 1 subscription events/);
    output = '';
    process.stdin.emit('keypress', '2', { name: '2' });
    assert.match(stripAnsi(output), /Known est\.:.*\$2\.50\*~/);
    output = '';
    process.stdin.emit('keypress', '3', { name: '3' });
    assert.match(stripAnsi(output), /Sessions ledger/);
    process.stdin.emit('keypress', '', { name: 'return' });
    const deadline = Date.now() + 3000;
    while (!stripAnsi(output).includes('Turn detail') && Date.now() < deadline) await delay(10);
    const inspector = stripAnsi(output);
    assert.match(inspector, /Turn detail/);
    assert.match(inspector, /Known est\.:.*\$2\.50\*~/);
    assert.match(inspector, /Missing rates: unknown/);
    assert.match(inspector, /Output: 4.*Cache writes: 3/);
    assert.match(inspector, /Model\/provider unknown for some usage/);
    output = '';
    process.stdin.emit('keypress', '4', { name: '4' });
    assert.match(stripAnsi(output), /Monthly audit summary/);
    assert.match(stripAnsi(output), /\$2\.50\*~/);
    process.stdin.emit('keypress', 'q', { name: 'q' });
    assert.equal(exited, true);
  } finally {
    process.stdout.write = write;
    process.exit = exit;
    if (tty) Object.defineProperty(process.stdout, 'isTTY', tty); else delete process.stdout.isTTY;
    for (const { emitter, event, before } of listenerSets) for (const listener of emitter.listeners(event)) if (!before.includes(listener)) emitter.removeListener(event, listener);
  }
  console.log('✓ TUI overview/project/session/month summaries and bounded inspector fields');

  // Local fixture server only. No browser, provider probe or external request.
  const server = startTakomiWebServer(stats, 0, { open: false });
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    const html = await (await fetch(url)).text();
    assert.match(html, /Known estimated subtotal/);
    assert.match(html, /\$2\.50\*~/);
    assert.match(html, /1 priced \/ 1 unpriced \/ 1 subscription events/);
    assert.match(html, /unpriced<\/td>/);
    assert.match(html, /not invoices or quota/);
    const data = await (await fetch(`${url}/data`)).json();
    assert.deepEqual(data.totals.pricing, stats.totals.pricing);
    // Newly added metadata must be escaped without changing the existing UI.
    stats.totals.pricing.missingModels = ['<synthetic-model>'];
    const escaped = await (await fetch(url)).text();
    assert.match(escaped, /Missing rates: &lt;synthetic-model&gt;/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log('✓ local-web summary labels, JSON coverage and escaped missing-model metadata');
  console.log('✓ stats pricing renderer tests passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
