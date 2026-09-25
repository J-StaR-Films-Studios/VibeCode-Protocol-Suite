import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'takomi-vault-input-'));
const original = homedir();
process.env.HOME = home;
process.env.USERPROFILE = home;
try {
  const { maskedSecret } = await import('../.pi/extensions/takomi-vault/secret-input.ts');
  const { registerVaultCommands } = await import('../.pi/extensions/takomi-vault/commands.ts');
  const { registerVaultTools } = await import('../.pi/extensions/takomi-vault/tools.ts');
  const { containsLikelySecret, registerVaultInputGuard } = await import('../.pi/extensions/takomi-vault/input-guard.ts');
  const { VAULT_PATH, KEY_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
  const kb = { matches: (data, action) => ({ 'tui.input.submit': '\r', 'tui.select.cancel': '\x1b', 'tui.editor.deleteCharBackward': '\x7f' }[action] === data) };
  const makeUI = (keys, notices = []) => ({
    input: async () => 'visible-label', select: async () => 'token — single API key or token',
    notify: (text) => notices.push(text),
    custom: async (factory) => {
      let result;
      const component = factory({ requestRender() {} }, { fg: (_color, value) => value }, kb, (value) => { result = value; });
      for (const key of keys) {
        component.handleInput(key);
        const screen = component.render(80).join('\n');
        assert.ok(!screen.includes('secret-value'), 'raw value must never render');
      }
      return result;
    },
  });
  const ctx = { mode: 'tui', hasUI: true, cwd: home, ui: makeUI(['\x1b[200~secret-value\x1b[201~', '\r']) };
  assert.equal(await maskedSecret(ctx, 'Token'), 'secret-value');
  assert.equal(await maskedSecret({ ...ctx, ui: makeUI(['secret-value', '\x7f', '\x1b']) }, 'Token'), null);
  await assert.rejects(maskedSecret({ ...ctx, mode: 'rpc' }, 'Token'), /interactive Pi TUI/);
  const commands = new Map();
  registerVaultCommands({ registerCommand: (name, def) => commands.set(name, def.handler) });
  await assert.rejects(commands.get('vault-add')('test example.test', { ...ctx, ui: makeUI(['secret-value', '\x1b']) }), /Cancelled/);
  assert.equal(existsSync(VAULT_PATH), false);
  assert.equal(existsSync(KEY_PATH), false);
  await assert.rejects(commands.get('vault-add')('test example.test', { ...ctx, mode: 'rpc' }), /interactive Pi TUI/);
  const tools = new Map();
  registerVaultTools({ registerTool: (def) => tools.set(def.name, def.execute) });
  const result = await tools.get('vault_request')('id', { service: 'test', host: 'example.test', kind: 'token' }, undefined, undefined, { ...ctx, mode: 'rpc' });
  assert.equal(result.isError, true);
  await assert.rejects(tools.get('vault_request')('id', { service: 'test', host: 'example.test', kind: 'token' }, undefined, undefined, {
    ...ctx, ui: { ...makeUI(['secret-value', '\x1b']), select: async () => { throw new Error('approval should not start'); } },
  }), /Cancelled/);
  assert.equal(existsSync(VAULT_PATH), false);
  assert.equal(existsSync(KEY_PATH), false);

  const github = 'ghp_' + 'A'.repeat(36);
  const pem = '-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(80) + '\n-----END PRIVATE KEY-----';
  for (const value of [github, pem, 'AWS_ACCESS_KEY_ID=AKIA' + 'A'.repeat(16)]) assert.equal(containsLikelySecret(value), true);
  for (const value of ['AKIA' + 'A'.repeat(16), 'ghp_short', 'my ordinary project label']) assert.equal(containsLikelySecret(value), false);
  let handler;
  registerVaultInputGuard({ on: (_name, fn) => { handler = fn; } });
  const notifications = [];
  const event = { text: github, source: 'interactive' };
  assert.deepEqual(await handler(event, { mode: 'rpc', hasUI: true, ui: { notify: (text) => notifications.push(text) } }), { action: 'handled' });
  const ui = { confirm: async (_title, body) => { assert.ok(!body.includes(github)); return false; }, notify: (text) => notifications.push(text) };
  assert.deepEqual(await handler(event, { mode: 'tui', hasUI: true, ui }), { action: 'handled' });
  assert.ok(notifications.every((text) => !text.includes(github)));
  assert.deepEqual(await handler(event, { mode: 'tui', hasUI: true, ui: { ...ui, confirm: async () => true } }), { action: 'continue' });
  assert.deepEqual(await handler({ text: 'hello' }, { mode: 'rpc', hasUI: false }), { action: 'continue' });
  console.log('vault input: passed');
} finally {
  process.env.HOME = original;
  process.env.USERPROFILE = original;
  rmSync(home, { recursive: true, force: true });
}
