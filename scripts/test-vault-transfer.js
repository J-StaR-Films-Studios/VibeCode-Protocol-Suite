import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'takomi-transfer-'));
const original = homedir();
process.env.HOME = home;
process.env.USERPROFILE = home;
const root = join(home, '.pi', 'agent', 'takomi-vault');
const archive = join(home, 'vault.transfer');
try {
  const { VAULT_PATH, KEY_PATH, GRANTS_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
  assert.equal(VAULT_PATH, join(root, 'vault.json'), 'scratch home only');
  const { createCredential } = await import('../.pi/extensions/takomi-vault/vault-store.ts');
  const { issueGrant } = await import('../.pi/extensions/takomi-vault/grant-store.ts');
  const { registerVaultCommands } = await import('../.pi/extensions/takomi-vault/commands.ts');
  const credential = createCredential({ label: 'portable', service: 'test', host: 'example.test', type: 'login', fields: [
    { name: 'username', value: 'transfer-user', visibility: 'agent-readable' },
    { name: 'password', value: 'transfer-secret-987', visibility: 'inject-only' },
  ] });
  issueGrant({ credentialId: credential.id, target: 'example.test', scope: 'target' });
  const commands = new Map();
  registerVaultCommands({ registerCommand: (name, def) => commands.set(name, def.handler) });
  let confirmation = '';
  let notice = '';
  const ctx = { hasUI: true, cwd: home, ui: {
    confirm: async (_title, body) => { confirmation = body; return true; },
    notify: (text) => { notice = text; },
  } };
  await assert.rejects(commands.get('vault-export')(archive, { ...ctx, mode: 'tui', hasUI: false }), /interactive Pi TUI/);
  let rpcPrompted = false;
  await assert.rejects(commands.get('vault-export')(archive, { ...ctx, mode: 'rpc', ui: {
    confirm: async () => { rpcPrompted = true; throw new Error('RPC must not prompt'); },
    notify: () => { throw new Error('RPC must not show a key'); },
  } }), /interactive Pi TUI/);
  assert.equal(rpcPrompted, false);
  assert.equal(existsSync(archive), false);
  await commands.get('vault-export')(archive, { ...ctx, mode: 'tui' });
  assert.ok(confirmation.includes(archive));
  const key = notice.match(/[a-f0-9]{64}/)?.[0];
  assert.ok(key, 'transfer key appears in UI notification');
  if (process.platform !== 'win32') assert.equal(statSync(archive).mode & 0o777, 0o600);
  const bytes = readFileSync(archive, 'utf8');
  for (const raw of ['transfer-user', 'transfer-secret-987', credential.id, 'grants']) assert.equal(bytes.includes(raw), false);
  await assert.rejects(commands.get('vault-export')(archive, { ...ctx, mode: 'tui' }), /export failed/);
  assert.equal(readFileSync(archive, 'utf8'), bytes);
  const dest = mkdtempSync(join(tmpdir(), 'takomi-import-'));
  const child = `
    import assert from 'node:assert/strict';
    import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
    import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
    import { join } from 'node:path';
    const root = join(process.env.HOME, '.pi', 'agent', 'takomi-vault');
    const { importVault } = await import('./.pi/extensions/takomi-vault/transfer.ts');
    const { registerVaultCommands } = await import('./.pi/extensions/takomi-vault/commands.ts');
    const { listCredentials, getFieldValue } = await import('./.pi/extensions/takomi-vault/vault-store.ts');
    const { KEY_PATH, VAULT_PATH } = await import('./.pi/extensions/takomi-vault/config.ts');
    const { clearKeyCache } = await import('./.pi/extensions/takomi-vault/crypto-store.ts');
    const { archive, key, id } = JSON.parse(readFileSync(0, 'utf8'));
    assert.equal(VAULT_PATH, join(root, 'vault.json'));
    assert.throws(() => importVault(archive, '0'.repeat(64)), /transfer failed/);
    assert.equal(existsSync(KEY_PATH), false);
    assert.equal(existsSync(VAULT_PATH), false);
    mkdirSync(root, { recursive: true });
    writeFileSync(VAULT_PATH, '{"version":1,"credentials":[]}');
    const emptyBefore = readFileSync(VAULT_PATH, 'utf8');
    const { resolveDataKey } = await import('./.pi/extensions/takomi-vault/key-provider.ts');
    assert.throws(() => resolveDataKey(), /Vault key is missing/);
    assert.throws(() => importVault(archive, key), /transfer failed/);
    assert.equal(readFileSync(VAULT_PATH, 'utf8'), emptyBefore);
    assert.equal(existsSync(KEY_PATH), false);
    const { unlinkSync } = await import('node:fs');
    unlinkSync(VAULT_PATH);
    writeFileSync(KEY_PATH, 'existing-key');
    assert.throws(() => importVault(archive, key), /transfer failed/);
    assert.equal(readFileSync(KEY_PATH, 'utf8'), 'existing-key');
    unlinkSync(KEY_PATH);
    const grantPath = join(root, 'grants.json');
    writeFileSync(grantPath, '{"version":1,"grants":[]}');
    assert.throws(() => importVault(archive, key), /transfer failed/);
    assert.equal(readFileSync(grantPath, 'utf8'), '{"version":1,"grants":[]}');
    unlinkSync(grantPath);
    const altered = join(process.env.HOME, 'altered.transfer');
    writeFileSync(altered, 'x'.repeat(12 * 1024 * 1024 + 1));
    assert.throws(() => importVault(altered, key), /transfer failed/);
    assert.equal(existsSync(KEY_PATH), false);
    const parsed = JSON.parse(readFileSync(archive, 'utf8'));
    parsed.tag = 'AAAAAAAAAAAAAAAAAAAAAA==';
    writeFileSync(altered, JSON.stringify(parsed));
    assert.throws(() => importVault(altered, key), /transfer failed/);
    assert.equal(existsSync(KEY_PATH), false);
    assert.equal(existsSync(VAULT_PATH), false);
    parsed.tag = JSON.parse(readFileSync(archive, 'utf8')).tag;
    parsed.data = '!!!';
    writeFileSync(altered, JSON.stringify(parsed));
    assert.throws(() => importVault(altered, key), /transfer failed/);
    const original = JSON.parse(readFileSync(archive, 'utf8'));
    const dec = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(original.iv, 'base64'));
    dec.setAuthTag(Buffer.from(original.tag, 'base64'));
    const payload = JSON.parse(Buffer.concat([dec.update(Buffer.from(original.data, 'base64')), dec.final()]).toString('utf8'));
    payload.credentials[0].fields[0].visibility = 'untrusted';
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    original.data = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]).toString('base64');
    original.iv = iv.toString('base64');
    original.tag = cipher.getAuthTag().toString('base64');
    writeFileSync(altered, JSON.stringify(original));
    assert.throws(() => importVault(altered, key), /transfer failed/);
    assert.equal(existsSync(KEY_PATH), false);
    assert.equal(existsSync(VAULT_PATH), false);
    const handlers = new Map();
    registerVaultCommands({ registerCommand: (name, def) => handlers.set(name, def.handler) });
    let notice = '';
    const ctx = { hasUI: true, mode: 'tui', cwd: process.env.HOME, ui: {
      confirm: async (_title, body) => { assert.ok(body.includes(archive)); return true; },
      custom: async (factory) => {
        let captured;
        const component = factory({ requestRender() {} }, {}, { matches: (data, action) => action === 'tui.input.submit' && data === '\\r' }, (result) => { captured = result; });
        component.handleInput('\\x1b[200~' + key + '\\x1b[201~');
        component.handleInput('\\r');
        return captured;
      },
      notify: (message) => { notice = message; },
    } };
    await handlers.get('vault-import')(archive, ctx);
    assert.match(notice, /Imported 1 credential/);
    assert.equal(notice.includes(key), false);
    clearKeyCache();
    const entry = listCredentials()[0];
    assert.equal(entry.id, id);
    assert.equal(entry.label, 'portable');
    assert.equal(entry.createdBy, 'human');
    assert.equal(getFieldValue(entry, 'username'), 'transfer-user');
    assert.equal(getFieldValue(entry, 'password'), 'transfer-secret-987');
    assert.equal(existsSync(join(root, 'grants.json')), false);
    assert.equal(readFileSync(VAULT_PATH, 'utf8').includes('transfer-secret-987'), false);
    const before = readFileSync(VAULT_PATH, 'utf8');
    const keyBefore = readFileSync(KEY_PATH, 'utf8');
    assert.throws(() => importVault(archive, key), /transfer failed/);
    assert.equal(readFileSync(VAULT_PATH, 'utf8'), before);
    assert.equal(readFileSync(KEY_PATH, 'utf8'), keyBefore);
    console.log('vault transfer: roundtrip passed');
  `;
  try {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', child], { cwd: process.cwd(), input: JSON.stringify({ archive, key, id: credential.id }), encoding: 'utf8', env: { ...process.env, HOME: dest, USERPROFILE: dest } });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /roundtrip passed/);
  } finally { rmSync(dest, { recursive: true, force: true }); }
  const originalKey = readFileSync(KEY_PATH, 'utf8');
  const originalGrants = readFileSync(GRANTS_PATH, 'utf8');
  await assert.rejects(commands.get('vault-import')(archive, { ...ctx, mode: 'rpc' }), /interactive Pi TUI/);
  assert.equal(readFileSync(KEY_PATH, 'utf8'), originalKey);
  assert.equal(readFileSync(GRANTS_PATH, 'utf8'), originalGrants);
  console.log('vault transfer: passed');
} finally {
  process.env.HOME = original;
  process.env.USERPROFILE = original;
  rmSync(home, { recursive: true, force: true });
}
