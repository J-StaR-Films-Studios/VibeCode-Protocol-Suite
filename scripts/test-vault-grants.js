import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const home = mkdtempSync(join(tmpdir(), 'takomi-vault-test-'));
const previousHome = homedir();
process.env.HOME = home;
process.env.USERPROFILE = home;
const root = join(home, '.pi', 'agent', 'takomi-vault');
try {
  const { VAULT_PATH, GRANTS_PATH, KEY_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
  assert.equal(VAULT_PATH, join(root, 'vault.json'), 'tests must never touch the real vault');
  const { createCredential, listCredentials } = await import('../.pi/extensions/takomi-vault/vault-store.ts');
  const { issueGrant, spendGrant, listGrants } = await import('../.pi/extensions/takomi-vault/grant-store.ts');
  const { execWithEnv, execWithStdin, writeTempEnvFile } = await import('../.pi/extensions/takomi-vault/adapters.ts');
  const { registerVaultTools } = await import('../.pi/extensions/takomi-vault/tools.ts');
  const credential = createCredential({ label: 'scratch', service: 'test', host: 'example.test', type: 'login', fields: [
    { name: 'username', value: 'tester', visibility: 'agent-readable' },
    { name: 'password', value: 'scratch-secret-123', visibility: 'inject-only' },
  ] });
  const fields = ['username'];
  const grant = issueGrant({ credentialId: credential.id, target: 'example.test', operation: 'login', scope: 'once', fields });
  const use = { grantId: grant.grantId, credentialId: credential.id, target: 'example.test', agent: 'pi', tool: 'terminal', operation: 'login', fields };
  for (const change of [{ agent: 'other' }, { operation: 'reset' }, { target: 'other.test' }, { tool: 'file' }, { fields: ['password'] }]) {
    assert.throws(() => spendGrant({ ...use, ...change }));
  }
  assert.equal(listGrants()[0].useCount, 0);
  const env = execWithEnv({ grantId: grant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', command: process.execPath, args: ['-e', 'process.stdout.write(process.env.NAME)'], envMap: { NAME: 'username' } });
  assert.equal(env.stdout, '[REDACTED]');
  assert.throws(() => spendGrant(use), /spent/);

  const stdinGrant = issueGrant({ credentialId: credential.id, target: 'example.test', operation: 'login', scope: 'once', fields });
  assert.throws(() => execWithStdin({ grantId: stdinGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', field: 'password', command: process.execPath }), /fields/);
  assert.equal(listGrants().find((g) => g.grantId === stdinGrant.grantId)?.useCount, 0);
  const stdin = execWithStdin({ grantId: stdinGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', field: 'username', command: process.execPath, args: ['-e', 'process.stdin.on("data", d => process.stdout.write(d))'] });
  assert.equal(stdin.stdout.trim(), '[REDACTED]');
  const fileGrant = issueGrant({ credentialId: credential.id, target: 'example.test', operation: 'login', tool: 'file', scope: 'once', fields });
  const file = join(home, 'scratch.env');
  assert.throws(() => writeTempEnvFile({ grantId: fileGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', path: file, entries: { PASS: 'password' }, persistent: false }), /fields/);
  assert.throws(() => writeTempEnvFile({ grantId: fileGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', path: file, entries: { USER: 'username' }, persistent: true }), /Permanent/);
  writeTempEnvFile({ grantId: fileGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', path: file, entries: { USER: 'username' }, persistent: false });
  assert.equal(readFileSync(file, 'utf8'), 'USER=tester\n');

  const race = issueGrant({ credentialId: credential.id, target: 'example.test', scope: 'once', fields: ['username'] });
  const moduleUrl = pathToFileURL(join(process.cwd(), '.pi/extensions/takomi-vault/grant-store.ts')).href;
  const worker = `import { spendGrant } from ${JSON.stringify(moduleUrl)}; spendGrant(${JSON.stringify({ ...use, grantId: race.grantId, operation: 'use' })});`;
  const children = Array.from({ length: 6 }, () => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', worker], { env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: 'ignore' });
    child.on('exit', (code) => resolve(code));
  }));
  assert.deepEqual((await Promise.all(children)).filter((code) => code === 0), [0]);
  assert.equal(listGrants().find((g) => g.grantId === race.grantId)?.useCount, 1);

  const handlers = new Map();
  registerVaultTools({ registerTool: (tool) => handlers.set(tool.name, tool.execute) });
  let scopePrompts = 0;
  const ui = { select: async (title, choices) => {
    if (title.startsWith('Use an existing')) return choices[0];
    if (title.startsWith('Fields')) return 'username';
    scopePrompts++;
    return 'once — one operation';
  } };
  const request = await handlers.get('vault_request')('id', { service: 'test', host: 'example.test', operation: 'login', scope: 'target' }, undefined, undefined, { hasUI: true, ui });
  assert.equal(request.details.scope, 'once');
  assert.equal(scopePrompts, 1, 'model-supplied scope must not bypass UI');
  assert.deepEqual(listGrants().find((g) => g.grantId === request.details.grantId)?.fields, ['username']);
  const denied = await handlers.get('vault_request')('id', { service: 'test', host: 'example.test', scope: 'target' }, undefined, undefined, { hasUI: false });
  assert.equal(denied.isError, true);

  for (const cancelAt of ['Fields', 'Approve']) {
    const before = listCredentials().length;
    const result = handlers.get('vault_request')('id', { service: `cancel-${cancelAt}`, host: 'example.test', scope: 'target' }, undefined, undefined, {
      hasUI: true,
      ui: {
        input: async (title) => title.startsWith('Label') ? 'scratch saved' : 'scratch-secret',
        select: async (title) => {
          if (title.startsWith('Save')) return 'Save to vault';
          if (title.startsWith(cancelAt)) return undefined;
          if (title.startsWith('Fields')) return 'All fields';
          return 'session — until Pi exits';
        },
      },
    });
    await assert.rejects(result, /Cancelled by user/);
    assert.equal(listCredentials().length, before, `saved credential must be removed when ${cancelAt} approval is cancelled`);
    assert.equal(listGrants().filter((g) => g.target === 'example.test' && !listCredentials().some((c) => c.id === g.credentialId)).length, 0, 'cancellation must not leave a new grant');
  }

  const validGrants = readFileSync(GRANTS_PATH, 'utf8');
  writeFileSync(GRANTS_PATH, 'null');
  try {
    await assert.rejects(handlers.get('vault_request')('id', { service: 'failed-approval', host: 'example.test' }, undefined, undefined, {
      hasUI: true,
      ui: {
        input: async (title) => title.startsWith('Label') ? 'scratch saved' : 'scratch-secret',
        select: async (title) => title.startsWith('Save') ? 'Save to vault' : title.startsWith('Fields') ? 'All fields' : 'once — one operation',
      },
    }), /invalid structure/);
    assert.equal(listCredentials().length, 1, 'failed grant issuance must remove newly saved credential');
  } finally {
    writeFileSync(GRANTS_PATH, validGrants);
  }

  const permanentGrant = issueGrant({ credentialId: credential.id, target: 'example.test', tool: 'file', scope: 'session', fields: ['username'] });
  const permanentPath = join(home, 'folder', '..', 'permanent.env');
  const permanentInput = { grantId: permanentGrant.grantId, credentialId: credential.id, target: 'example.test', path: permanentPath, entries: { ACCOUNT: 'username' }, persistent: true };
  const writePermanent = (ctx) => handlers.get('vault_write_env_file')('id', permanentInput, undefined, undefined, ctx);
  const noUi = await writePermanent({ hasUI: false });
  assert.equal(noUi.isError, true);
  assert.equal(listGrants().find((g) => g.grantId === permanentGrant.grantId)?.useCount, 0);
  let confirmation = '';
  const rejected = await writePermanent({ hasUI: true, ui: { confirm: async (_title, message) => { confirmation = message; return false; } } });
  assert.equal(rejected.isError, true);
  assert.match(confirmation, /plaintext on disk/);
  assert.ok(confirmation.includes(`Path: ${resolve(permanentPath)}`));
  assert.match(confirmation, /Env keys: ACCOUNT/);
  assert.equal(listGrants().find((g) => g.grantId === permanentGrant.grantId)?.useCount, 0);
  assert.equal(existsSync(resolve(permanentPath)), false);
  assert.equal(listCredentials().length, 1);
  const approved = await writePermanent({ hasUI: true, ui: { confirm: async () => true } });
  assert.equal(approved.isError, undefined);
  assert.equal(approved.details.path, resolve(permanentPath));
  assert.equal(readFileSync(resolve(permanentPath), 'utf8'), 'ACCOUNT=tester\n');
  assert.equal(listGrants().find((g) => g.grantId === permanentGrant.grantId)?.useCount, 1);

  const ephemeral = createCredential({ label: 'ephemeral', service: 'scratch', host: 'example.test', type: 'token', fields: [{ name: 'token', value: 'scratch-ephemeral', visibility: 'inject-only' }], createdBy: 'agent-once' });
  const ephemeralGrant = issueGrant({ credentialId: ephemeral.id, target: 'example.test', scope: 'once', fields: ['token'] });
  const revoked = await handlers.get('vault_revoke')('id', { grantId: ephemeralGrant.grantId });
  assert.deepEqual(revoked.details.removed, [ephemeral.id]);
  assert.equal(listCredentials().some((entry) => entry.id === ephemeral.id), false);
  assert.equal(listGrants().find((g) => g.grantId === ephemeralGrant.grantId)?.revoked, true);

  const vaultOriginal = readFileSync(VAULT_PATH, 'utf8');
  const grantsOriginal = readFileSync(GRANTS_PATH, 'utf8');
  for (const malformed of ['null', '{}', '{"version":1,"credentials":[{}]}']) {
    writeFileSync(VAULT_PATH, malformed);
    assert.throws(() => listCredentials(), /invalid structure/);
    assert.equal(readFileSync(VAULT_PATH, 'utf8'), malformed);
  }
  writeFileSync(VAULT_PATH, vaultOriginal);
  for (const malformed of ['null', '{}', '{"version":1,"grants":[{}]}']) {
    writeFileSync(GRANTS_PATH, malformed);
    assert.throws(() => listGrants(), /invalid structure/);
    assert.equal(readFileSync(GRANTS_PATH, 'utf8'), malformed);
  }
  writeFileSync(GRANTS_PATH, grantsOriginal);
  const legacy = issueGrant({ credentialId: credential.id, target: 'example.test', scope: 'once' });
  assert.equal(spendGrant({ ...use, grantId: legacy.grantId, operation: 'use', fields: ['password'] }).useCount, 1);
  const { resolveDataKey } = await import('../.pi/extensions/takomi-vault/key-provider.ts');
  const encryptedVault = readFileSync(VAULT_PATH, 'utf8');
  rmSync(KEY_PATH);
  assert.throws(() => resolveDataKey(), /Vault key is missing/);
  assert.equal(readFileSync(VAULT_PATH, 'utf8'), encryptedVault, 'missing key cannot replace encrypted vault data');
  console.log('vault scratch grants: passed');
} finally {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousHome;
  rmSync(home, { recursive: true, force: true });
}
