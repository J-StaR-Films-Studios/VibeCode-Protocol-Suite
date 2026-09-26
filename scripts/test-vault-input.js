import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'takomi-vault-input-'));
const original = homedir();
const originalSecretUi = process.env.T3_TAKOMI_VAULT_SECRET_UI;
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.T3_TAKOMI_VAULT_SECRET_UI;
try {
  const { maskedSecret } = await import('../.pi/extensions/takomi-vault/secret-input.ts');
  const { registerVaultCommands } = await import('../.pi/extensions/takomi-vault/commands.ts');
  const { registerVaultTools } = await import('../.pi/extensions/takomi-vault/tools.ts');
  const { containsLikelySecret, registerVaultInputGuard } = await import('../.pi/extensions/takomi-vault/input-guard.ts');
  const { VAULT_PATH, KEY_PATH, AUDIT_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
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
  await assert.rejects(maskedSecret({ ...ctx, mode: 'rpc' }, 'Token'), /supported RPC secret UI/);
  const commands = new Map();
  registerVaultCommands({ registerCommand: (name, def) => commands.set(name, def.handler) });
  await assert.rejects(commands.get('vault-add')('test example.test', { ...ctx, ui: makeUI(['secret-value', '\x1b']) }), /Cancelled/);
  assert.equal(existsSync(VAULT_PATH), false);
  assert.equal(existsSync(KEY_PATH), false);
  await assert.rejects(commands.get('vault-add')('test example.test', { ...ctx, mode: 'rpc' }), /supported RPC secret UI/);
  const tools = new Map();
  registerVaultTools({ registerTool: (def) => tools.set(def.name, def.execute) });
  const request = (params, rpcCtx) => tools.get('vault_request')('id', params, undefined, undefined, rpcCtx);
  const result = await request({ service: 'test', host: 'example.test', kind: 'token' }, { ...ctx, mode: 'rpc' });
  assert.equal(result.isError, true);
  process.env.T3_TAKOMI_VAULT_SECRET_UI = 'true';
  assert.equal((await request({ service: 'test', host: 'example.test' }, { ...ctx, mode: 'rpc' })).isError, true);
  process.env.T3_TAKOMI_VAULT_SECRET_UI = '1';
  await assert.rejects(maskedSecret({ ...ctx, mode: 'rpc', hasUI: false }, 'Token'), /supported RPC secret UI/);
  assert.equal((await request({ service: 'test', host: 'example.test' }, { ...ctx, mode: 'rpc', hasUI: false })).isError, true);
  await assert.rejects(maskedSecret({ ...ctx, mode: 'json' }, 'Token'), /supported RPC secret UI/);
  const titles = [];
  const rpcNotices = [];
  const secret = 'rpc-secret-value-never-output';
  const rpcUi = {
    input: async (title, placeholder) => {
      if (title.startsWith('[takomi-vault-secret] ')) {
        titles.push([title, placeholder]);
        return secret;
      }
      return 'visible-label';
    },
    select: async (title) => {
      if (title === 'Credential type') return 'token — single API key or token';
      if (title === 'Save this credential?') return 'Save to vault';
      if (title.startsWith('Fields')) return 'All fields';
      return 'once — one operation';
    },
    notify: (text) => rpcNotices.push(text),
  };
  const rpcCtx = { ...ctx, mode: 'rpc', ui: rpcUi };
  assert.equal(await maskedSecret({ ...rpcCtx, ui: { ...rpcUi, input: async () => undefined } }, 'Token:'), null);
  await assert.rejects(commands.get('vault-add')('test example.test ' + secret, rpcCtx), /slash arguments/);
  await commands.get('vault-add')('test example.test', rpcCtx);
  const granted = await request({ service: 'different', host: 'different.test', kind: 'login' }, rpcCtx);
  assert.equal(granted.isError, undefined);
  assert.equal(granted.details.saved, true);
  assert.deepEqual(titles, [
    ['[takomi-vault-secret] Token:', undefined],
    ['[takomi-vault-secret] Password for different on different.test:', undefined],
  ]);
  assert.ok(!JSON.stringify({ granted, rpcNotices, titles }).includes(secret));
  assert.ok(!readFileSync(VAULT_PATH, 'utf8').includes(secret));
  assert.ok(!readFileSync(AUDIT_PATH, 'utf8').includes(secret));
  await assert.rejects(tools.get('vault_request')('id', { service: 'cancelled-service', host: 'example.test', kind: 'token' }, undefined, undefined, {
    ...ctx, ui: { ...makeUI(['secret-value', '\x1b']), select: async () => { throw new Error('approval should not start'); } },
  }), /Cancelled/);
  assert.equal(existsSync(KEY_PATH), true);

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
  if (originalSecretUi === undefined) delete process.env.T3_TAKOMI_VAULT_SECRET_UI;
  else process.env.T3_TAKOMI_VAULT_SECRET_UI = originalSecretUi;
  rmSync(home, { recursive: true, force: true });
}
