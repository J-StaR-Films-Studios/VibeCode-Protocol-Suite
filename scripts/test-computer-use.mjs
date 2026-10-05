import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lockfile from 'proper-lockfile';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findCodexCli, readCodexRuntime } from '../src/computer-use/codex-runtime.mjs';
import { decorateResponse } from '../src/computer-use/server.mjs';
import { installComputerUse, computerUseDoctor, disableComputerUse, existingDesktopServers, desktopMcpRegistration } from '../src/computer-use/setup.js';
import { computerUsePaths, parseDesktopServer, resolveDesktopServer } from '../.pi/extensions/takomi-computer-use/config.js';
import { createApprovalHandler, readGrants } from '../.pi/extensions/takomi-computer-use/approvals.ts';
import { createComputerUseExtension } from '../.pi/extensions/takomi-computer-use/index.ts';
import { TAKOMI_PI_OPTIONAL_FEATURES, selectPiOptionalFeatures } from '../src/pi-optional-features.js';
import { getSourceCheckoutLaunchArgs } from '../src/pi-harness.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/computer-use-server.mjs', import.meta.url));
const diagnostic = { ok: true, tools: 2, windowCount: 2 };
const execFileAsync = promisify(execFile);
async function homeFor(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-computer-use-test-'));
  t.after(() => fs.remove(home));
  return home;
}
async function registerFixture(home, extraEnv = {}) {
  const paths = computerUsePaths(home);
  await fs.outputJson(paths.mcp, { mcpServers: {
    'existing-desktop': { command: process.execPath, args: [fixture], env: extraEnv },
    unrelated: { type: 'http', url: 'https://example.invalid/mcp' },
  } });
  return paths;
}
function approval(overrides = {}, meta = {}) {
  return { mode: 'form', message: 'Allow Test App?', requestedSchema: { type: 'object', properties: {} },
    _meta: { connector_id: 'computer-use', codex_approval_kind: 'mcp_tool_call', riskLevel: 'low',
      persist: ['session', 'always'], tool_params: { app: 'test.desktop.app' }, ...meta }, ...overrides };
}
function handler(file, select, options = {}) {
  return createApprovalHandler({ file, server: 'server-A', getUI: () => ({ select, notify() {} }), isActive: () => true, ...options });
}
function request(signal = new AbortController().signal) { return { signal }; }

test('computer use is absent from defaults and included once in the source launcher', async () => {
  const feature = TAKOMI_PI_OPTIONAL_FEATURES.find(value => value.id === 'takomi-computer-use');
  assert.equal(feature.selectedByDefault, false);
  assert.equal(feature.recommended, false);
  assert.ok(!(await selectPiOptionalFeatures({ interactive: false })).includes(feature.id));
  assert.equal(getSourceCheckoutLaunchArgs(root).filter(value => value.endsWith(path.join('takomi-computer-use', 'index.ts'))).length, 1);
});

test('CLI exposes setup and exports configuration without enabling or starting desktop control', async t => {
  const home = await homeFor(t);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const cli = path.join(root, 'src', 'cli.js');
  const help = await execFileAsync(process.execPath, [cli, 'setup', '--help'], { env });
  assert.match(help.stdout, /computer-use/);
  assert.match(help.stdout, /--server/);
  const output = await execFileAsync(process.execPath, [cli, 'computer-use', 'config'], { env });
  assert.equal(JSON.parse(output.stdout).mcpServers['takomi-computer-use'].args[0], computerUsePaths(home).launcher);
  assert.deepEqual(await fs.readdir(home), []);
});

test('portable Codex discovery uses a local shim and matching installed guidance', async t => {
  const home = await homeFor(t);
  const bin = path.join(home, 'bin');
  const script = path.join(bin, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  await fs.outputFile(path.join(bin, 'codex.cmd'), '@echo off');
  await fs.outputFile(script, '// fake CLI');
  const plugin = path.join(home, '.codex', 'plugins', 'cache', 'openai-bundled', 'computer-use', 'test-version');
  for (const file of ['skills/computer-use/SKILL.md', 'docs/guidance.md', 'docs/api.md', 'docs/confirmations.md']) await fs.outputFile(path.join(plugin, file), `Reference: ${file}`);
  const env = { PATH: bin };
  assert.deepEqual(findCodexCli({ env }), { command: process.execPath, args: [script] });
  const runtime = readCodexRuntime({ home, env, run(command, args) {
    assert.equal(command, process.execPath);
    assert.deepEqual(args, [script, 'mcp', 'get', 'node_repl', '--json']);
    return JSON.stringify({ enabled: true, transport: { type: 'stdio', command: process.execPath, args: [fixture],
      env: { CODEX_HOME: path.join(home, '.codex'), BROWSER_USE_CODEX_APP_VERSION: 'test-version', NODE_REPL_TRUSTED_SERVICES: '{"browser":"unsafe"}' } } });
  } });
  assert.deepEqual(JSON.parse(runtime.env.NODE_REPL_TRUSTED_SERVICES), { sky: '@oai/sky/service' });
  assert.match(runtime.instructions, /docs\/confirmations.md/);
  assert.throws(() => findCodexCli({ env: { PATH: home } }), /Codex CLI was not found/);
  assert.throws(() => readCodexRuntime({ home, env, run: () => '{}' }), /disabled, invalid/);
});

test('shared adapter supplies complete guidance and truthful stateful tool annotations', () => {
  const init = decorateResponse({ result: { serverInfo: { name: 'native' }, instructions: 'Native instructions' } }, 'Safety reference');
  assert.match(init.result.instructions, /Native instructions/);
  assert.match(init.result.instructions, /Safety reference/);
  const tools = decorateResponse({ result: { tools: [{ name: 'js', annotations: { readOnlyHint: true } }] } }, '');
  assert.equal(tools.result.tools[0].annotations.readOnlyHint, false);
  assert.equal(tools.result.tools[0].annotations.destructiveHint, true);
  const elicitation = { method: 'elicitation/create', params: approval() };
  assert.deepEqual(decorateResponse(structuredClone(elicitation), ''), elicitation);
});

test('existing MCP setup preserves registrations, settings and Codex files', async t => {
  const home = await homeFor(t);
  const paths = await registerFixture(home, { TEST_TOKEN: 'fake-test-secret' });
  const settings = path.join(home, '.pi', 'agent', 'settings.json');
  const codex = path.join(home, '.codex', 'config.toml');
  await fs.outputFile(settings, '{"theme":"mine","packages":["npm:unrelated"]}\n');
  await fs.outputFile(codex, 'unchanged = true\n');
  const originals = await Promise.all([paths.mcp, settings, codex].map(file => fs.readFile(file, 'utf8')));
  assert.deepEqual((await existingDesktopServers(home)).map(server => server.name), ['existing-desktop']);
  let installed = 0;
  const result = await installComputerUse({ home, platform: 'win32', source: { kind: 'existing', name: 'existing-desktop' },
    installDependencies: async directory => {
      installed++;
      const pkg = await fs.readJson(path.join(directory, 'package.json'));
      assert.equal(pkg.dependencies['@earendil-works/pi-mcp'], '1.0.3');
      assert.ok(await fs.pathExists(path.join(directory, 'guidance.md')));
    } });
  assert.equal(result.ok, true);
  assert.equal(installed, 1);
  assert.deepEqual(await Promise.all([paths.mcp, settings, codex].map(file => fs.readFile(file, 'utf8'))), originals);
  const saved = await fs.readJson(paths.config);
  assert.deepEqual(saved.source, { kind: 'existing', name: 'existing-desktop' });
  assert.doesNotMatch(await fs.readFile(paths.config, 'utf8'), /fake-test-secret|TEST_TOKEN/);
  assert.equal(await fs.pathExists(paths.approvals), false);
  const doctor = await computerUseDoctor({ home, platform: 'win32' });
  assert.equal(doctor.ok, true);
  assert.equal(doctor.windowCount, 2);
  const registration = (await desktopMcpRegistration(home)).mcpServers['takomi-computer-use'];
  assert.equal(registration.args[0], paths.launcher);
  assert.equal(await fs.pathExists(paths.launcher), true);
  await disableComputerUse(home);
  assert.equal((await fs.readJson(paths.config)).enabled, false);
  assert.equal((await computerUseDoctor({ home, platform: 'win32', probe: () => { throw new Error('must not connect'); } })).ok, false);
});

test('new Codex setup ships only portable Takomi files', async t => {
  const home = await homeFor(t);
  let checked = 0;
  await installComputerUse({ home, platform: 'win32', source: { kind: 'codex', cliPath: path.join(home, 'custom-codex.exe') }, codexProbe: () => { checked++; },
    probe: async () => diagnostic, installDependencies: async () => {} });
  assert.equal(checked, 1);
  assert.deepEqual((await fs.readJson(computerUsePaths(home).config)).source, { kind: 'codex', cliPath: path.join(home, 'custom-codex.exe') });
  assert.deepEqual((await desktopMcpRegistration(home)).mcpServers['takomi-computer-use'].args,
    [computerUsePaths(home).launcher, '--codex-cli', path.join(home, 'custom-codex.exe')]);
  assert.deepEqual((await fs.readdir(path.dirname(computerUsePaths(home).launcher))).sort(),
    ['.takomi-computer-use.json', 'codex-runtime.mjs', 'server.mjs']);
  const code = await fs.readFile(computerUsePaths(home).launcher, 'utf8');
  assert.doesNotMatch(code, /Users[\\/]johno|26\.930|7d8d3/);
});

test('unsupported systems and missing runtimes do not enable or create the feature', async t => {
  const home = await homeFor(t);
  await assert.rejects(installComputerUse({ home, platform: 'linux', source: { kind: 'codex' } }), /Windows only/);
  await assert.rejects(installComputerUse({ home, platform: 'win32', source: { kind: 'codex' }, codexProbe: () => { throw new Error('missing'); } }), /missing/);
  assert.deepEqual(await fs.readdir(home), []);
});

test('dependency-install failure leaves previous enabled state unchanged', async t => {
  const home = await homeFor(t);
  const paths = await registerFixture(home);
  const previous = '{"version":1,"enabled":false,"source":{"kind":"existing","name":"existing-desktop"}}\n';
  await fs.outputFile(paths.config, previous);
  await assert.rejects(installComputerUse({ home, platform: 'win32', source: { kind: 'existing', name: 'existing-desktop' },
    probe: async () => diagnostic, installDependencies: async () => { throw new Error('dependency failure'); } }), /dependency failure/);
  assert.equal(await fs.readFile(paths.config, 'utf8'), previous);
});

test('malformed private configuration is preserved without leaking its contents', async t => {
  const home = await homeFor(t);
  const paths = computerUsePaths(home);
  await fs.outputFile(paths.mcp, '{private-test-secret broken');
  await assert.rejects(existingDesktopServers(home), error => !error.message.includes('private-test-secret'));
  await fs.outputFile(paths.config, '{private-test-secret broken');
  await assert.rejects(installComputerUse({ home, platform: 'win32', source: { kind: 'codex' } }), error => !error.message.includes('private-test-secret'));
  assert.equal(await fs.readFile(paths.config, 'utf8'), '{private-test-secret broken');
  assert.equal(await fs.pathExists(paths.launcher), false);
});

test('server changes require new grants and environment substitutions are not executed', async t => {
  const home = await homeFor(t);
  const a = parseDesktopServer({ command: 'node', args: ['server.mjs'], env: { TOKEN: '${TOKEN}' } }, 'desktop', home, { TOKEN: 'test' });
  const b = parseDesktopServer({ command: 'node', args: ['other.mjs'], env: { TOKEN: 'test' } }, 'desktop', home);
  assert.notEqual(a.id, b.id);
  assert.equal(a.env.TOKEN, 'test');
  assert.throws(() => parseDesktopServer({ command: 'node', env: { TOKEN: '!echo execute' } }, 'desktop', home), /Only string/);
  assert.throws(() => parseDesktopServer({ command: 'node', env: { TOKEN: '${MISSING}' } }, 'desktop', home, {}), /Missing environment variable/);
});

test('session approval reuses only that app and does not survive a new handler', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  let dialogs = 0;
  const approve = handler(file, async () => { dialogs++; return 'Allow for this session'; });
  assert.equal((await approve(approval(), request()))._meta.persist, 'session');
  assert.equal((await approve(approval(), request())).action, 'accept');
  assert.equal(dialogs, 1);
  assert.equal(await fs.pathExists(file), false);
  const fresh = handler(file, async () => 'Deny');
  assert.equal((await fresh(approval(), request())).action, 'decline');
});

test('permanent approval persists and remains scoped to server and app', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  await handler(file, async () => 'Always allow this app')(approval(), request());
  assert.deepEqual((await readGrants(file)).apps, [{ server: 'server-A', app: 'test.desktop.app' }]);
  const noDialog = handler(file, async () => { throw new Error('must not prompt'); });
  assert.equal((await noDialog(approval(), request()))._meta.persist, 'always');
  const other = handler(file, async () => 'Deny', { server: 'server-B' });
  assert.equal((await other(approval(), request())).action, 'decline');
  assert.equal((await noDialog(approval(), request())).action, 'accept');
});

test('saved grants cannot approve high-risk, sensitive, audio or unadvertised requests', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  await handler(file, async () => 'Always allow this app')(approval(), request());
  let prompts = 0;
  const deny = handler(file, async (_title, choices) => { prompts++; assert.deepEqual(choices, ['Deny', 'Allow this request']); return 'Deny'; });
  for (const meta of [{ riskLevel: 'high' }, { codex_request_type: 'send-data' }, { tool_name: 'record_audio' },
    { tool_params: { app: 'computer-audio' } }, { connector_id: 'other' }, { persist: [] }]) {
    assert.equal((await deny(approval({}, meta), request())).action, 'decline');
  }
  assert.equal(prompts, 6);
});

test('invalid saved grants are preserved and unsupported forms fail closed', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  await fs.outputFile(file, 'invalid user data');
  const approve = handler(file, async (_title, choices) => { assert.ok(!choices.includes('Always allow this app')); return 'Allow this request'; });
  assert.equal((await approve(approval(), request())).action, 'accept');
  assert.equal(await fs.readFile(file, 'utf8'), 'invalid user data');
  for (const params of [approval({ mode: 'url' }), approval({ requestedSchema: { type: 'object', properties: { password: { type: 'string' } } } }),
    approval({ requestedSchema: { type: 'object', properties: {}, maxProperties: 0 } })]) {
    assert.equal((await approve(params, request())).action, 'decline');
  }
  assert.equal((await handler(file, async () => 'Allow this request', { getUI: () => undefined })(approval(), request())).action, 'cancel');
});

test('queued dialogs and stale sessions cannot create grants', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  let complete;
  let prompts = 0;
  let active = true;
  const approve = handler(file, async () => { prompts++; return new Promise(resolve => { complete = resolve; }); }, { isActive: () => active });
  const first = approve(approval(), request());
  while (!complete) await new Promise(resolve => setTimeout(resolve, 1));
  const controller = new AbortController();
  const second = approve(approval(), request(controller.signal));
  controller.abort();
  active = false;
  complete('Always allow this app');
  assert.equal((await first).action, 'cancel');
  assert.equal((await second).action, 'cancel');
  assert.equal(prompts, 1);
  assert.equal(await fs.pathExists(file), false);
});

test('concurrent permanent grants preserve both choices', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  const a = handler(file, async () => 'Always allow this app');
  const b = handler(file, async () => 'Always allow this app', { server: 'server-B' });
  const results = await Promise.all([a(approval(), request()), b(approval(), request())]);
  assert.ok(results.every(result => result.action === 'accept'));
  assert.equal((await readGrants(file)).apps.length, 2);
});

test('cancellation while waiting for the grant lock prevents persistence', async t => {
  const file = computerUsePaths(await homeFor(t)).approvals;
  await fs.ensureDir(path.dirname(file));
  const unlock = await lockfile.lock(file, { realpath: false });
  const controller = new AbortController();
  const pending = handler(file, async () => 'Always allow this app')(approval(), request(controller.signal));
  await new Promise(resolve => setTimeout(resolve, 20));
  controller.abort();
  await unlock();
  assert.equal((await pending).action, 'cancel');
  assert.equal(await fs.pathExists(file), false);
});

test('extension is inert until enabled, then bridges approvals, images, errors and shutdown', async t => {
  const home = await homeFor(t);
  const paths = await registerFixture(home);
  const hooks = new Map();
  const tools = [];
  let dialogs = 0;
  const ctx = { hasUI: true, ui: { notify() {}, select: async () => { dialogs++; return 'Allow for this session'; } } };
  createComputerUseExtension({ home, platform: 'win32' })({ on: (name, callback) => hooks.set(name, callback), registerTool: tool => tools.push(tool) });
  t.after(() => hooks.get('session_shutdown')());
  await hooks.get('session_start')({}, ctx);
  assert.equal(tools.length, 0);
  await fs.outputJson(paths.config, { version: 1, enabled: true, source: { kind: 'existing', name: 'existing-desktop' } });
  await hooks.get('session_start')({}, ctx);
  assert.equal(tools.length, 1);
  const execute = params => tools[0].execute('test', params, undefined, undefined, ctx);
  assert.match((await execute({ action: 'instructions' })).content[0].text, /App access is not task authorization/);
  assert.match((await execute({ action: 'instructions' })).content[0].text, /Test server guidance/);
  await execute({ action: 'js', code: 'approval' });
  await execute({ action: 'js', code: 'approval' });
  assert.equal(dialogs, 1);
  assert.equal((await execute({ action: 'js', code: 'image' })).content[1].mimeType, 'image/png');
  await assert.rejects(execute({ action: 'js', code: 'throw' }), /Simulated desktop failure/);
  await assert.rejects(execute({ action: 'js' }), /requires code/);
  await hooks.get('session_start')({}, ctx);
  await assert.rejects(execute({ action: 'js', code: 'ok' }), /session has ended/);
  await tools[1].execute('next-session', { action: 'js', code: 'approval' }, undefined, undefined, ctx);
  assert.equal(dialogs, 2, 'session grants do not carry over to a new session');
  await hooks.get('session_shutdown')();
});

test('doctor sends only a read-only inventory call and never changes approval state', async t => {
  const home = await homeFor(t);
  const trace = path.join(home, 'trace.jsonl');
  const paths = await registerFixture(home, { TEST_DESKTOP_TRACE: trace });
  await fs.outputJson(paths.config, { version: 1, enabled: true, source: { kind: 'existing', name: 'existing-desktop' } });
  assert.equal((await computerUseDoctor({ home, platform: 'win32' })).ok, true);
  const calls = (await fs.readFile(trace, 'utf8')).trim().split('\n').map(JSON.parse).filter(message => message.method === 'tools/call');
  assert.equal(calls.length, 1);
  assert.match(calls[0].params.arguments.code, /sky\.list_windows/);
  assert.doesNotMatch(calls[0].params.arguments.code, /click|type_text|key/);
  assert.equal(await fs.pathExists(paths.approvals), false);
  const server = await resolveDesktopServer(await fs.readJson(paths.config), home);
  assert.equal(server.name, 'existing-desktop');
});
