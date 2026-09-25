import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const home = mkdtempSync(join(tmpdir(), 'takomi-vault-test-'));
const previousHome = homedir();
process.env.HOME = home;
process.env.USERPROFILE = home;
const root = join(home, '.pi', 'agent', 'takomi-vault');
try {
  const { VAULT_PATH, GRANTS_PATH, AUDIT_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
  assert.equal(VAULT_PATH, join(root, 'vault.json'), 'tests must never touch the real vault');
  const { createCredential, findByService, findServiceCandidates, listCredentials } = await import('../.pi/extensions/takomi-vault/vault-store.ts');
  const { readAudit, logAudit } = await import('../.pi/extensions/takomi-vault/audit.ts');
  const { registerVaultCommands } = await import('../.pi/extensions/takomi-vault/commands.ts');
  const { issueGrant, spendGrant, listGrants, revokeGrants } = await import('../.pi/extensions/takomi-vault/grant-store.ts');
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
  assert.throws(() => writeTempEnvFile({ grantId: fileGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', path: file, expectedParent: home, entries: { PASS: 'password' }, persistent: false }), /fields/);
  assert.throws(() => writeTempEnvFile({ grantId: fileGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', path: file, expectedParent: home, entries: { USER: 'username' }, persistent: true }), /Permanent/);
  writeTempEnvFile({ grantId: fileGrant.grantId, credentialId: credential.id, target: 'example.test', operation: 'login', path: file, expectedParent: home, entries: { USER: 'username' }, persistent: false });
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
  const request = await handlers.get('vault_request')('id', { service: 'test', host: 'example.test', operation: 'login', scope: 'target' }, undefined, undefined, { mode: 'tui', hasUI: true, ui });
  assert.equal(request.details.scope, 'once');
  assert.equal(scopePrompts, 1, 'model-supplied scope must not bypass UI');
  assert.deepEqual(listGrants().find((g) => g.grantId === request.details.grantId)?.fields, ['username']);
  const denied = await handlers.get('vault_request')('id', { service: 'test', host: 'example.test', scope: 'target' }, undefined, undefined, { hasUI: false });
  assert.equal(denied.isError, true);

  const near = createCredential({ label: 'similar', service: 'github', host: 'github.com', type: 'token', fields: [{ name: 'token', value: 'never-in-audit' }] });
  assert.deepEqual(findByService('githb', 'github.com'), []);
  assert.deepEqual(findServiceCandidates('githb', 'github.com').map((entry) => entry.id), [near.id]);
  assert.deepEqual(findServiceCandidates('githb', 'other.com'), []);
  const found = await handlers.get('vault_find')('id', { service: 'githb', host: 'github.com' });
  assert.equal(found.details.matches[0].id, near.id);
  assert.match(found.content[0].text, /approximate/);
  assert.deepEqual(findByService('githb', 'github.com'), [], 'grant selection stays exact');

  const deniedUse = async (name, params, ctx = { cwd: home }) => {
    const result = await handlers.get(name)('id', params, undefined, undefined, ctx);
    assert.equal(result.isError, true);
    assert.equal(JSON.stringify(result).includes('never-in-audit'), false);
    return readAudit(1)[0];
  };
  const badInput = { grantId: request.details.grantId, credentialId: credential.id, target: 'never-in-audit', operation: 'never-in-audit' };
  for (const name of ['vault_use_env', 'vault_use_stdin']) {
    const event = await deniedUse(name, name === 'vault_use_env'
      ? { ...badInput, command: process.execPath, envMap: { NAME: 'username' } }
      : { ...badInput, command: process.execPath, field: 'username' });
    assert.deepEqual({ grantId: event.grantId, tool: event.tool, target: event.target, operation: event.operation },
      { grantId: request.details.grantId, tool: 'terminal', target: 'example.test', operation: 'login' });
  }
  const mismatched = await deniedUse('vault_use_env', { ...badInput, credentialId: near.id, command: process.execPath, envMap: { NAME: 'token' } });
  assert.equal(mismatched.grantId, request.details.grantId);
  assert.equal(mismatched.target, undefined);
  assert.equal(mismatched.operation, undefined);
  assert.equal(readFileSync(AUDIT_PATH, 'utf8').includes('never-in-audit'), false);

  const fileHandler = handlers.get('vault_write_env_file');
  const freshGrant = () => issueGrant({ credentialId: credential.id, target: 'example.test', tool: 'file', scope: 'session', fields: ['username'] });
  const writeParams = (grantId, path) => ({ grantId, credentialId: credential.id, target: 'example.test', path, entries: { USER: 'username' } });
  const output = join(home, 'new.env');
  const deniedGrant = freshGrant();
  assert.equal((await fileHandler('id', { ...writeParams(deniedGrant.grantId, output), target: 'never-in-audit', operation: 'never-in-audit' }, undefined, undefined, { hasUI: false, cwd: home })).isError, true);
  assert.deepEqual((({ grantId, tool, target, operation }) => ({ grantId, tool, target, operation }))(readAudit(1)[0]),
    { grantId: deniedGrant.grantId, tool: 'file', target: 'example.test', operation: 'use' });
  assert.equal(listGrants().find((g) => g.grantId === deniedGrant.grantId).useCount, 0);
  let prompt = '';
  const deniedUi = { confirm: async (_title, body) => { prompt = body; return false; } };
  assert.equal((await fileHandler('id', writeParams(deniedGrant.grantId, output), undefined, undefined, { hasUI: true, cwd: home, ui: deniedUi })).isError, true);
  assert.match(prompt, /Repo\/cwd:.*Resolved path:.*Keys: USER.*Plaintext file/s);
  assert.equal(existsSync(output), false);
  const approvedUi = { confirm: async (_title, body) => { prompt = body; return true; } };
  const written = await fileHandler('id', writeParams(deniedGrant.grantId, output), undefined, undefined, { hasUI: true, cwd: home, ui: approvedUi });
  assert.equal(written.isError, undefined);
  assert.equal(readFileSync(output, 'utf8'), 'USER=tester\n');
  assert.equal(JSON.stringify(written).includes(output), false);
  assert.equal((await fileHandler('id', writeParams(freshGrant().grantId, output), undefined, undefined, { hasUI: true, cwd: home, ui: approvedUi })).isError, true);
  assert.equal(readFileSync(output, 'utf8'), 'USER=tester\n');
  const persistentPath = join(home, 'persistent.env');
  const persistent = await fileHandler('id', { ...writeParams(freshGrant().grantId, persistentPath), persistent: true }, undefined, undefined, { hasUI: true, cwd: home, ui: approvedUi });
  assert.equal(persistent.isError, undefined);
  assert.match(prompt, /Persistent plaintext file/);
  assert.equal(readFileSync(persistentPath, 'utf8'), 'USER=tester\n');
  const ephemeral = createCredential({ label: 'one-use', service: 'test', host: 'example.test', type: 'token', createdBy: 'agent-once', fields: [{ name: 'token', value: 'temp-secret' }] });
  const failedGrant = issueGrant({ credentialId: ephemeral.id, target: 'example.test', tool: 'file', scope: 'once', fields: ['token'] });
  assert.throws(() => writeTempEnvFile({ grantId: failedGrant.grantId, credentialId: ephemeral.id, target: 'example.test', path: output, expectedParent: home, entries: { TOKEN: 'token' }, persistent: false }), /EEXIST/);
  assert.equal(listGrants().find((g) => g.grantId === failedGrant.grantId).useCount, 1);
  assert.equal(listCredentials().some((entry) => entry.id === ephemeral.id), false, 'spent grant failure removes one-time credential');
  const revocable = createCredential({ label: 'revoke-once', service: 'test', host: 'example.test', type: 'token', createdBy: 'agent-once', fields: [{ name: 'token', value: 'scratch-revoke' }] });
  const revocableGrant = issueGrant({ credentialId: revocable.id, target: 'example.test', scope: 'once' });
  const revokedOnce = await handlers.get('vault_revoke')('id', { grantId: revocableGrant.grantId });
  assert.deepEqual(revokedOnce.details.removed, [revocable.id]);
  assert.equal(listCredentials().some((entry) => entry.id === revocable.id), false, 'revoke by grant must remove one-time credential');

  const first = join(home, 'first');
  const second = join(home, 'second');
  mkdirSync(first);
  mkdirSync(second);
  const parentLink = join(home, 'parent-link');
  symlinkSync(first, parentLink, 'dir');
  const swapped = join(parentLink, 'swapped.env');
  const swapUi = { confirm: async () => { unlinkSync(parentLink); symlinkSync(second, parentLink, 'dir'); return true; } };
  const swapGrant = freshGrant();
  assert.equal((await fileHandler('id', writeParams(swapGrant.grantId, swapped), undefined, undefined, { hasUI: true, cwd: home, ui: swapUi })).isError, true);
  assert.equal(existsSync(join(first, 'swapped.env')), false);
  assert.equal(existsSync(join(second, 'swapped.env')), false);
  assert.equal(listGrants().find((g) => g.grantId === swapGrant.grantId).useCount, 1);

  const link = join(home, 'linked.env');
  symlinkSync(output, link);
  assert.equal((await fileHandler('id', writeParams(freshGrant().grantId, link), undefined, undefined, { hasUI: true, cwd: home, ui: approvedUi })).isError, true);
  assert.equal(readFileSync(output, 'utf8'), 'USER=tester\n');
  assert.equal(JSON.stringify(await fileHandler('id', writeParams(freshGrant().grantId, link), undefined, undefined, { hasUI: true, cwd: home, ui: approvedUi })).includes(link), false);
  const saveBefore = listCredentials().length;
  const cancelledUi = { input: async () => 'new-label', custom: async (factory) => {
    let result;
    const component = factory({ requestRender() {} }, {}, { matches: (data, action) => action === 'tui.input.submit' && data === '\r' }, (value) => { result = value; });
    component.handleInput('new-secret-value');
    component.handleInput('\r');
    return result;
  }, select: async (title) => {
    if (title === 'Save this credential?') return 'Save to vault';
    if (title.startsWith('Fields')) return 'All fields';
    return undefined;
  } };
  await assert.rejects(handlers.get('vault_request')('id', { service: 'brandnew', host: 'brandnew.test' }, undefined, undefined, { mode: 'tui', hasUI: true, ui: cancelledUi }), /Cancelled/);
  assert.equal(listCredentials().length, saveBefore, 'cancelled approval must not persist credentials');
  const suspicious = 'never-in-audit';
  logAudit({ at: Date.now(), credentialId: near.id, event: 'denied', result: suspicious, target: suspicious, operation: 'secret/password', grantId: 'grant_bad' });
  assert.equal(readFileSync(AUDIT_PATH, 'utf8').includes(suspicious), false, 'new audit lines discard raw text');
  writeFileSync(AUDIT_PATH, JSON.stringify({ at: Date.now(), credentialId: near.id, event: 'used', result: suspicious, target: suspicious }) + '\n', { flag: 'a' });
  assert.equal(readFileSync(AUDIT_PATH, 'utf8').includes(suspicious), true, 'legacy line contains unsafe text');
  assert.equal(JSON.stringify(readAudit(50, near.id)).includes(suspicious), false);
  const requestEvents = readAudit(50, credential.id);
  assert.ok(requestEvents.some((entry) => entry.event === 'requested' && entry.grantId === request.details.grantId && entry.operation === 'login' && entry.target === 'example.test'));
  assert.ok(requestEvents.some((entry) => entry.event === 'approved' && entry.grantId === request.details.grantId && entry.scope === 'once'));
  revokeGrants({ grantId: request.details.grantId });
  assert.equal(readAudit(50, credential.id).find((entry) => entry.event === 'revoked' && entry.grantId === request.details.grantId)?.target, 'example.test');
  const commands = new Map();
  registerVaultCommands({ registerCommand: (name, definition) => commands.set(name, definition.handler) });
  let notice = '';
  await commands.get('vault-audit')(near.id, { hasUI: true, ui: { notify: (text) => { notice = text; } } });
  assert.match(notice, /used/);
  assert.equal(notice.includes(suspicious), false);
  await commands.get('vault-audit')(credential.id, { hasUI: true, ui: { notify: (text) => { notice = text; } } });
  assert.match(notice, /revoked.*grant_[A-F0-9]{32}.*example\.test/);
  await commands.get('vault-status')('', { hasUI: true, ui: { notify: (text) => { notice = text; } } });
  assert.match(notice, /grant_[A-F0-9]{32}/);

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

  const validGrants = readFileSync(GRANTS_PATH, 'utf8');
  const beforeFailure = listCredentials().length;
  writeFileSync(GRANTS_PATH, 'null');
  try {
    await assert.rejects(handlers.get('vault_request')('id', { service: 'failed-approval', host: 'example.test' }, undefined, undefined, {
      mode: 'tui', hasUI: true,
      ui: {
        input: async () => 'scratch saved',
        custom: async () => 'scratch-secret',
        select: async (title) => title.startsWith('Save') ? 'Save to vault' : title.startsWith('Fields') ? 'All fields' : 'once — one operation',
      },
    }), /invalid structure/);
    assert.equal(listCredentials().length, beforeFailure, 'failed grant issuance must remove newly saved credential');
  } finally {
    writeFileSync(GRANTS_PATH, validGrants);
  }
  const auditFailureEphemeral = createCredential({ label: 'audit-failure-once', service: 'test', host: 'example.test', type: 'token', createdBy: 'agent-once', fields: [{ name: 'token', value: 'scratch-audit-failure' }] });
  const auditFailureGrant = issueGrant({ credentialId: auditFailureEphemeral.id, target: 'example.test', scope: 'once' });
  const grantsBeforeAuditFailure = new Set(listGrants().map((entry) => entry.grantId));
  const credentialsBeforeAuditFailure = listCredentials().length;
  unlinkSync(AUDIT_PATH);
  mkdirSync(AUDIT_PATH); // An unwritable audit destination, entirely inside the scratch home.
  await assert.rejects(handlers.get('vault_request')('id', { service: 'audit-failure-saved', host: 'example.test' }, undefined, undefined, {
    mode: 'tui', hasUI: true,
    ui: {
      input: async () => 'scratch saved',
      custom: async () => 'scratch-secret',
      select: async (title) => title.startsWith('Save') ? 'Save to vault' : title.startsWith('Fields') ? 'All fields' : 'once — one operation',
    },
  }), (error) => ['EISDIR', 'EPERM', 'EACCES'].includes(error.code), 'approval must fail at the audit write');
  assert.equal(listCredentials().length, credentialsBeforeAuditFailure, 'audit failure must remove the saved credential');
  assert.deepEqual(new Set(listGrants().map((entry) => entry.grantId)), grantsBeforeAuditFailure, 'failed approval must not leave a live or orphaned grant');
  const revokedOnAuditFailure = await handlers.get('vault_revoke')('id', { grantId: auditFailureGrant.grantId });
  assert.equal(revokedOnAuditFailure.isError, undefined);
  assert.equal(revokedOnAuditFailure.details.revoked, 1);
  assert.deepEqual(revokedOnAuditFailure.details.removed, [auditFailureEphemeral.id]);
  assert.equal(listGrants().find((entry) => entry.grantId === auditFailureGrant.grantId)?.revoked, true);
  assert.equal(listCredentials().some((entry) => entry.id === auditFailureEphemeral.id), false, 'grantId revoke removes the ephemeral credential despite audit failure');
  const { KEY_PATH } = await import('../.pi/extensions/takomi-vault/config.ts');
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
