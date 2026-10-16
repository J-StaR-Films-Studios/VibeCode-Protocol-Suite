import './vault-test-loader.js';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'takomi-vault-input-'));
const original = homedir();
const originalSecretUi = process.env.T3_TAKOMI_VAULT_SECRET_UI;
const originalOwnership = process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY;
delete process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY;
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.T3_TAKOMI_VAULT_SECRET_UI;
try {
  const { maskedSecret } = await import('../.pi/extensions/takomi-vault/secret-input.ts');
  const { registerVaultCommands } = await import('../.pi/extensions/takomi-vault/commands.ts');
  const { registerVaultTools } = await import('../.pi/extensions/takomi-vault/tools.ts');
  const { containsLikelySecret, registerVaultInputGuard } = await import('../.pi/extensions/takomi-vault/input-guard.ts');
  const { VAULT_PATH, KEY_PATH, AUDIT_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
  const { createCredential, getCredential, getFieldValue, listCredentials } = await import('../.pi/extensions/takomi-vault/vault-store.ts');
  const { listGrants } = await import('../.pi/extensions/takomi-vault/grant-store.ts');
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
  const ctx = { mode: 'tui', hasUI: true, cwd: home, sessionManager: { getSessionId: () => 'synthetic-test-session' }, ui: makeUI(['\x1b[200~secret-value\x1b[201~', '\r']) };
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
  let disposed = 0;
  const lifecycle = new Map();
  registerVaultTools({ registerTool: (def) => tools.set(def.name, def.execute), on: (event, handler) => {
    const listeners = lifecycle.get(event) ?? new Set();
    lifecycle.set(event, listeners);
    listeners.add(handler);
    return () => { listeners.delete(handler); disposed++; };
  } });
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
  const selects = [];
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
    select: async (title, choices) => {
      selects.push({ title, choices });
      if (title === 'Credential fields') return 'token — single API key or token';
      if (title === 'Save this credential?') return 'Save to vault';
      if (title.startsWith('Purpose: ')) return 'All fields';
      return choices.find((choice) => choice.startsWith('once:'));
    },
    notify: (text) => rpcNotices.push(text),
  };
  const rpcCtx = { ...ctx, mode: 'rpc', ui: rpcUi };
  assert.equal((await request({ service: 'test', host: 'example.test' }, rpcCtx)).isError, true,
    'model entry requires ownership capability, not just a private input title');
  process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY = '1';
  assert.equal(await maskedSecret({ ...rpcCtx, ui: { ...rpcUi, input: async () => undefined } }, 'Token:'), null);
  await assert.rejects(commands.get('vault-add')('test example.test ' + secret, rpcCtx), /slash arguments/);
  await commands.get('vault-add')('test example.test', rpcCtx);
  assert.equal(listGrants().length, 0, 'manual save alone issues no permission');
  const granted = await request({ service: 'different', host: 'different.test', kind: 'login' }, rpcCtx);
  assert.equal(granted.isError, undefined);
  assert.equal(granted.details.saved, true);
  assert.deepEqual(titles.map(([title]) => title), [
    '[takomi-vault-secret] token:',
    '[takomi-vault-secret] username for different on different.test:',
    '[takomi-vault-secret] password for different on different.test:',
  ]);
  assert.equal(titles[0][1], undefined, 'slash-command admission remains unchanged');
  for (const [, placeholder] of titles.slice(1)) assert.match(placeholder, /^\[takomi-vault-owner:v1\] [a-f0-9-]{36}$/);
  const ownership = rpcNotices.filter((text) => text.startsWith('[takomi-vault-ownership:v1] '))
    .map((text) => JSON.parse(text.slice('[takomi-vault-ownership:v1] '.length)));
  assert.deepEqual(ownership.map(({ phase }) => phase), ['open', 'close', 'open', 'close']);
  assert.equal(ownership[0].requestId, ownership[1].requestId);
  assert.equal(ownership[0].displayContext.fieldName, 'username');
  assert.equal(disposed, 5, 'request removes all invocation lifecycle listeners');
  const customFields = [
    { name: 'GOOGLE_CLIENT_ID' },
    { name: 'GOOGLE_CLIENT_SECRET', visibility: 'inject-only' },
  ];
  const custom = await request({ service: 'google-local', host: 'accounts.google.com',
    operation: 'configure OAuth', purpose: 'Use the local study app', fields: customFields }, rpcCtx);
  assert.equal(custom.isError, undefined);
  assert.deepEqual(getCredential(custom.details.credentialId).fields.map(({ name, visibility }) => ({ name, visibility })),
    customFields.map(({ name }) => ({ name, visibility: 'inject-only' })));
  assert.equal(getFieldValue(getCredential(custom.details.credentialId), 'GOOGLE_CLIENT_SECRET'), secret);
  assert.deepEqual(listGrants(custom.details.credentialId).find(({ grantId }) => grantId === custom.details.grantId).fields,
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  assert.deepEqual(selects.findLast(({ title }) => title.startsWith('Purpose: ')).choices,
    ['All fields', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  assert.match(selects.findLast(({ title }) => title.startsWith('Allow Pi terminal access')).title, /does not approve deployments/);
  assert.deepEqual(titles.slice(-2).map(([title]) => title), [
    '[takomi-vault-secret] GOOGLE_CLIENT_ID for google-local on accounts.google.com:',
    '[takomi-vault-secret] GOOGLE_CLIENT_SECRET for google-local on accounts.google.com:',
  ]);
  const readable = createCredential({ label: 'readable', service: 'readable', host: 'example.test', type: 'token',
    fields: [{ name: 'CLIENT_ID', value: 'fake-id', visibility: 'agent-readable' }] });
  const reused = await request({ service: 'readable', host: 'example.test', fields: [{ name: 'CLIENT_ID' }] }, {
    ...rpcCtx, ui: { ...rpcUi,
      input: async () => { throw new Error('Existing credential must not prompt for a value'); },
      select: async (title, choices) => title.startsWith('Use an existing credential') ? choices[0] : rpcUi.select(title, choices),
    },
  });
  assert.equal(reused.details.credentialId, readable.id);
  assert.equal(listCredentials().filter(({ service }) => service === 'readable').length, 1);
  assert.equal((await request({ service: 'invalid', host: 'example.test', fields: [
    { name: 'CLIENT_ID' }, { name: 'client_id' },
  ] }, { ...rpcCtx, ui: { ...rpcUi, input: async () => { throw new Error('Invalid fields must not prompt'); } } })).isError, true);
  const count = listCredentials().length;
  const customUi = {
    ...makeUI(['secret-value', '\r']),
    input: async (title) => title.startsWith('Number of fields') ? '2'
      : title.startsWith('Field 1 name') ? 'GOOGLE_CLIENT_ID'
      : title.startsWith('Field 2 name') ? 'GOOGLE_CLIENT_SECRET' : 'OAuth test',
    select: async (title) => title === 'Credential fields' ? 'custom — name each field' : 'Keep private (inject only)',
  };
  await commands.get('vault-add')('custom example.test', { ...ctx, ui: customUi });
  assert.equal(listCredentials().length, count + 1);
  assert.deepEqual(listCredentials().at(-1).fields.map(({ name, visibility }) => ({ name, visibility })), [
    { name: 'GOOGLE_CLIENT_ID', visibility: 'inject-only' },
    { name: 'GOOGLE_CLIENT_SECRET', visibility: 'inject-only' },
  ]);
  let entryCount = 0;
  const cancelledCustom = { ...customUi, custom: async (factory) =>
    (entryCount++ === 0 ? makeUI(['secret-value', '\r']) : makeUI(['\x1b'])).custom(factory) };
  await assert.rejects(commands.get('vault-add')('custom2 example.test', { ...ctx, ui: cancelledCustom }), /Cancelled/);
  assert.equal(listCredentials().length, count + 1, 'cancelled multi-field entry must save nothing');
  assert.ok(!JSON.stringify({ granted, rpcNotices, titles }).includes(secret));
  assert.ok(!readFileSync(VAULT_PATH, 'utf8').includes(secret));
  assert.ok(!readFileSync(AUDIT_PATH, 'utf8').includes(secret));
  await assert.rejects(tools.get('vault_request')('id', { service: 'cancelled-service', host: 'example.test', kind: 'token' }, undefined, undefined, {
    ...ctx, ui: { ...makeUI(['secret-value', '\x1b']), select: async () => { throw new Error('approval should not start'); } },
  }), /Cancelled/);
  assert.equal(existsSync(KEY_PATH), true);

  // Actual invocation listeners cancel saved approvals and private entry, then detach.
  const beforeStaleApproval = listGrants().length;
  const beforeStaleCredentials = listCredentials().length;
  const cancelApproval = () => { for (const listener of lifecycle.get('session_before_switch') ?? []) listener(); };
  const staleSaved = await request({ service: 'readable', host: 'example.test' }, {
    ...rpcCtx, ui: { ...rpcUi, select: async (title, choices) => {
      if (title.startsWith('Use an existing')) return choices[0];
      if (title.startsWith('Allow Pi')) cancelApproval();
      return rpcUi.select(title, choices);
    } },
  });
  assert.equal(staleSaved.details.reason, 'approval_cancelled');
  const staleSecret = await request({ service: 'stale-secret', host: 'example.test' }, {
    ...rpcCtx, ui: { ...rpcUi, input: async () => { cancelApproval(); return secret; } },
  });
  assert.equal(staleSecret.details.reason, 'approval_cancelled');
  assert.equal(listGrants().length, beforeStaleApproval);
  assert.equal(listCredentials().length, beforeStaleCredentials);
  assert.ok([...lifecycle.values()].every((listeners) => listeners.size === 0));

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
  if (originalOwnership === undefined) delete process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY;
  else process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY = originalOwnership;
  rmSync(home, { recursive: true, force: true });
}
