import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import * as typebox from "typebox";
import * as paths from "node:path";

// A closed module graph. No original key-provider, config, crypto or credential storage runs.
const directory = join(dirname(fileURLToPath(import.meta.url)), "../.pi/extensions/takomi-vault");
const sentinel = "SYNTHETIC_PRIVATE_SENTINEL";
let records = { version: 1, grants: [] };
let failAudit = false;
let fsFailure;
let fsCode;
let parent = "/synthetic";
let startFailure = false;
let exitStatus = 0;
let effects = 0;
let secretHook;
let invocationAborted = false;
let deleted = 0;
let disposed = 0;
let nextId = 0;
let currentCredential;
let pendingCredential;
const audit = [];
const credential = {
  id: "cred_TEST",
  createdBy: "human",
  fields: [{ name: "username" }, { name: "password" }],
};
const modules = new Map([
  ["typebox", typebox],
  ["node:path", paths],
  ["node:crypto", { randomUUID: () => String(++nextId).padStart(32, "0") }],
  [
    "node:child_process",
    {
      spawnSync: () => {
        effects++;
        return startFailure ? { error: new Error(sentinel) }
          : { status: exitStatus, stdout: sentinel, stderr: sentinel };
      },
    },
  ],
  [
    "node:fs",
    {
      existsSync: () => false,
      readFileSync: () => {
        throw new Error("Unexpected synthetic read");
      },
      rmSync() {},
      chmodSync() {},
      realpathSync() {
        if (fsFailure === "parent") throw Object.assign(new Error(sentinel), { code: fsCode });
        return parent;
      },
      writeFileSync() {
        effects++;
        if (fsFailure === "write") throw Object.assign(new Error(sentinel), { code: fsCode });
      },
    },
  ],
  [
    "./config.ts",
    {
      GRANTS_PATH: "synthetic",
      DATA_ROOT: "/synthetic",
      readJsonFile: () => structuredClone(records),
      writeJsonFile(_path, value) {
        if (value?.version === 1 || value?.version === 2) records = structuredClone(value);
      },
      withJsonFileLock: (_path, fn) => fn(),
    },
  ],
  [
    "./audit.ts",
    {
      logAudit(value) {
        if (failAudit) throw new Error(sentinel);
        audit.push(value);
      },
    },
  ],
  ["./crypto-store.ts", { peekBackend: () => "not-initialized" }],
  [
    "./secret-input.ts",
    {
      supportsSecretEntry: () => true,
      vaultSecretInvocation: () => ({
        signal: { get aborted() { return invocationAborted; } },
        dispose() {
          disposed++;
        },
      }),
      maskedSecret: async () => { secretHook?.(); return sentinel; },
    },
  ],
  [
    "./vault-store.ts",
    {
      getCredential: (id) => (id === pendingCredential?.id ? pendingCredential : id === credential.id ? credential : undefined),
      getFieldValue: () => sentinel,
      touchUsed() {},
      deleteIfEphemeral: (id) => {
        if (id === pendingCredential?.id) {
          currentCredential = undefined;
          pendingCredential = undefined;
        }
        deleted++;
        return true;
      },
      isEphemeral: (value) => value.createdBy === "agent-once",
      findByService: () => (currentCredential ? [currentCredential] : []),
      createCredential: (value) => ({ ...value, id: credential.id }),
      deleteCredential: () => {
        deleted++;
      },
    },
  ],
]);
function load(name, exports) {
  const source = stripTypeScriptTypes(readFileSync(join(directory, name), "utf8"))
    .replace(/import \{([^}]+)\} from "([^"]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (async )?function /g, "$1function ")
    .replace(/export class /g, "class ");
  const module = { exports: {} };
  runInNewContext(`${source}\nmodule.exports = {${exports}};`, {
    module,
    Date,
    process: { env: {} },
    require(name) {
      if (!modules.has(name)) throw new Error("Unmocked Vault import");
      return modules.get(name);
    },
  });
  modules.set(`./${name}`, module.exports);
  return module.exports;
}
load("types.ts", "VaultOperationError");
const grants = load(
  "grant-store.ts",
  "issueGrant, spendGrant, listGrants, revokeGrants, revokeExpiredSessionGrants",
);
load("adapters.ts", "execWithEnv, execWithStdin, writeTempEnvFile");
const { registerVaultTools } = load("tools.ts", "registerVaultTools");
const tools = new Map();
registerVaultTools({ registerTool: (tool) => tools.set(tool.name, tool) });
let owner = "synthetic-chat-A";
const sessionManager = { getSessionId: () => owner, getSessionFile: () => "/synthetic/chat.jsonl" };
const ctx = { hasUI: true, cwd: "/synthetic", sessionManager, ui: { confirm: async () => true } };
const invoke = (name, params, context = ctx) =>
  tools.get(name).execute("synthetic-call", params, undefined, undefined, context);
const issue = (changes = {}) =>
  grants.issueGrant({
    credentialId: credential.id,
    target: "example.test",
    operation: "I am happy",
    tool: "terminal",
    scope: "once",
    fields: ["username"],
    ...((changes.scope === "session" || changes.scope === "turn") ? { ownerSessionId: owner } : {}),
    ...changes,
  });
// Raw legacy records preserve the old authorization contract, including optional fields.
const issueLegacy = (changes = {}) => {
  const current = issue({ ...changes, fields: ["username"] });
  const row = records.grants.find((entry) => entry.grantId === current.grantId);
  delete row.policyVersion;
  delete row.ownerSessionId;
  if (Object.hasOwn(changes, "fields")) row.fields = changes.fields;
  return row;
};
const params = (grant) => ({
  grantId: grant.grantId,
  credentialId: credential.id,
  target: "example.test",
  operation: "I am happy",
  command: "synthetic-executable",
  envMap: { USER: "username" },
});
const count = (grant) => grants.listGrants().find((row) => row.grantId === grant.grantId).useCount;
async function denied(grant, changes, reason, expected = 0, name = "vault_use_env") {
  const result = await invoke(name, { ...params(grant), ...changes });
  assert.equal(result.isError, true);
  assert.equal(result.details?.reason, reason);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
  assert.equal(count(grant), expected);
  return result;
}
const policies = [
  [{ grantId: "grant_MISSING" }, "grant_missing"],
  [{ target: "terminal" }, "target_mismatch"],
  [{ target: "file" }, "target_mismatch"],
  [{ operation: undefined }, "operation_mismatch"],
  [{ operation: "Iamhappy" }, "operation_mismatch"],
  [{ operation: "i am happy" }, "operation_mismatch"],
  [{ envMap: { PASS: "password" } }, "fields_denied"],
  [{ envMap: { USER: "unknown" } }, "field_missing"],
  [{ envMap: { "invalid-key": "username" } }, "env_name_invalid"],
  [{ credentialId: "cred_MISSING" }, "credential_missing"],
];
for (const [changes, reason] of policies) await denied(issueLegacy(), changes, reason);
await denied(issue({ tool: "file" }), {}, "tool_mismatch");
const expired = issue();
records.grants.find((g) => g.grantId === expired.grantId).expiresAt = 0;
await denied(expired, { target: "terminal" }, "grant_expired");
const revoked = issue();
grants.revokeGrants({ grantId: revoked.grantId });
await denied(revoked, { target: "terminal" }, "grant_revoked");
await denied(issue({ agent: "different" }), {}, "agent_mismatch");
await denied(issue({ credentialId: "cred_DIFFERENT" }), {}, "credential_mismatch");
const spent = issue();
const successful = await invoke("vault_use_env", params(spent));
assert.equal(successful.isError, undefined);
assert.equal(successful.content[0].text.includes(sentinel), false);
assert.equal(count(spent), 1);
await denied(spent, {}, "grant_spent", 1);
const legacy = issueLegacy({ fields: undefined });
assert.equal(
  (await invoke("vault_use_env", { ...params(legacy), envMap: { PASS: "password" } })).isError,
  undefined,
);
assert.equal(count(legacy), 1);
startFailure = true;
await denied(issue(), {}, "command_start", 1);
await denied(issue(), { field: "username" }, "command_start", 1, "vault_use_stdin");
startFailure = false;
const fileParams = (grant) => ({
  ...params(grant),
  path: "/synthetic/private.env",
  entries: { USER: "username" },
});
async function fileDenied(grant, reason, expected, changes = {}) {
  const result = await invoke("vault_write_env_file", { ...fileParams(grant), ...changes });
  assert.equal(result.isError, true);
  assert.equal(result.details?.reason, reason);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
  assert.equal(JSON.stringify(result).includes("private.env"), false);
  assert.equal(count(grant), expected);
}
await fileDenied(issue({ tool: "file" }), "persistent_scope", 0, { persistent: true });
await fileDenied(issue({ tool: "file" }), "target_mismatch", 0, { target: "file" });
fsFailure = "parent";
fsCode = "ENOENT";
await fileDenied(issue({ tool: "file" }), "parent_missing", 0);
fsCode = "EACCES";
await fileDenied(issue({ tool: "file" }), "parent_access", 0);
fsFailure = undefined;
const changed = issue({ tool: "file" });
const changedResult = await invoke("vault_write_env_file", fileParams(changed), {
  ...ctx,
  ui: {
    confirm: async () => {
      parent = "/changed";
      return true;
    },
  },
});
assert.equal(changedResult.details.reason, "parent_changed");
assert.equal(count(changed), 1);
parent = "/synthetic";
const missingAfter = issue({ tool: "file" });
const missingResult = await invoke("vault_write_env_file", fileParams(missingAfter), {
  ...ctx,
  ui: {
    confirm: async () => {
      fsFailure = "parent";
      fsCode = "ENOENT";
      return true;
    },
  },
});
assert.equal(missingResult.details.reason, "parent_missing");
assert.equal(count(missingAfter), 1);
fsFailure = "write";
for (const [code, reason] of [
  ["EEXIST", "destination_exists"],
  ["EACCES", "write_permission"],
  ["EPERM", "write_permission"],
]) {
  const grant = issue({ tool: "file" });
  fsCode = code;
  failAudit = true;
  await fileDenied(grant, reason, 1);
  failAudit = false;
}
fsCode = "UNEXPECTED";
await fileDenied(issue({ tool: "file" }), undefined, 1);
fsFailure = undefined;
const listing = await invoke("vault_grants", {});
assert.equal(listing.details.grants.find((g) => g.grantId === spent.grantId).status, "spent");
assert.deepEqual(
  Array.from(listing.details.grants.find((g) => g.grantId === legacy.grantId).fields),
  ["username", "password"],
);
assert.equal(listing.details.grants.find((g) => g.grantId === legacy.grantId).allFields, true);
assert.equal(JSON.stringify(listing).includes(sentinel), false);

const selections = [];
let save = false;
let cancelOnce = false;
const requestCtx = {
  hasUI: true,
  mode: "tui",
  sessionManager,
  ui: {
    input: async () => "Synthetic label",
    select: async (title, choices) => {
      selections.push({ title, choices });
      if (title.startsWith("Use an existing")) return choices[0];
      if (title === "Save this credential?") return save ? "Save to vault" : choices[0];
      if (title.startsWith("Purpose: ")) return "username";
      if (title.startsWith("Unsaved credential:")) return cancelOnce ? "Cancel" : choices[0];
      return choices.find((choice) => choice.startsWith("session"));
    },
  },
};
const requestArgs = {
  service: "synthetic",
  host: " Example.TEST ",
  operation: "I am happy",
  tool: "file",
  scope: "target",
  kind: "login",
};
function checkMetadata(result, saved, scope) {
  const grant = grants.listGrants().find((g) => g.grantId === result.details.grantId);
  assert.equal(result.isError, undefined);
  for (const key of [
    "credentialId",
    "grantId",
    "target",
    "tool",
    "operation",
    "scope",
    "expiresAt",
    "useCount",
  ])
    assert.equal(result.details[key], grant[key]);
  assert.deepEqual(Array.from(result.details.fields), ["username"]);
  assert.equal(result.details.saved, saved);
  assert.equal(result.details.ephemeral, !saved);
  assert.equal(result.details.scope, scope);
  assert.match(result.content[0].text, /vault_write_env_file/);
  assert.doesNotMatch(result.content[0].text, /vault_use_env|vault_use_stdin/);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
}
const before = Date.now();
checkMetadata(await invoke("vault_request", requestArgs, requestCtx), false, "once");
const onceChoice = selections.find(({ title }) => title.startsWith("Unsaved credential:"));
assert.deepEqual(Array.from(onceChoice.choices), ["Allow once, 5 minutes", "Cancel"]);
assert.match(onceChoice.title, /within 5 minutes/);
assert.ok(records.grants.at(-1).expiresAt >= before + 5 * 60 * 1000);
assert.ok(records.grants.at(-1).expiresAt <= Date.now() + 5 * 60 * 1000);

// Reapproval before first use must not turn an unsaved credential into reusable access.
pendingCredential = {
  ...credential,
  id: "cred_PENDING_UNSAVED",
  label: "Pending unsaved credential",
  service: requestArgs.service,
  host: "example.test",
  createdBy: "agent-once",
};
currentCredential = pendingCredential;
const pendingId = pendingCredential.id;
const pendingGrant = issue({ credentialId: pendingId, tool: "file" });
const beforeReapproval = selections.length;
const reapproved = await invoke("vault_request", requestArgs, requestCtx);
const reapprovalChoices = selections.slice(beforeReapproval);
assert.ok(reapprovalChoices[0].title.startsWith("Use an existing"));
const reapprovalScopes = reapprovalChoices.filter(({ title }) =>
  title.startsWith("Unsaved credential:") || title.startsWith("Allow Pi"));
assert.equal(reapprovalScopes.length, 1);
assert.deepEqual(Array.from(reapprovalScopes[0].choices), ["Allow once, 5 minutes", "Cancel"],
  "Reapproved unsaved credential must offer only once or cancel");
checkMetadata(reapproved, false, "once");
assert.equal(reapproved.details.credentialId, pendingId);
assert.notEqual(reapproved.details.grantId, pendingGrant.grantId);
assert.equal(count(pendingGrant), 0);
assert.equal(reapproved.details.useCount, 0);
const pendingUse = { ...fileParams(reapproved.details), credentialId: pendingId };
const beforePendingUse = effects;
const beforePendingDelete = deleted;
assert.equal((await invoke("vault_write_env_file", pendingUse)).isError, undefined);
assert.equal(count(reapproved.details), 1);
assert.equal(effects, beforePendingUse + 1);
assert.equal(deleted, beforePendingDelete + 1);
assert.equal(modules.get("./vault-store.ts").getCredential(pendingId), undefined);
assert.equal(currentCredential, undefined);
const repeatedPendingUse = await invoke("vault_write_env_file", pendingUse);
assert.equal(repeatedPendingUse.isError, true);
assert.equal(repeatedPendingUse.details.reason, "credential_missing");
assert.equal(count(reapproved.details), 1);
assert.equal(effects, beforePendingUse + 1);
assert.equal(deleted, beforePendingDelete + 1);

cancelOnce = true;
const beforeCancel = records.grants.length;
await assert.rejects(invoke("vault_request", requestArgs, requestCtx), /Cancelled/);
assert.equal(records.grants.length, beforeCancel);
assert.equal(deleted >= 1, true);
cancelOnce = false;
save = true;
checkMetadata(await invoke("vault_request", requestArgs, requestCtx), true, "session");
currentCredential = credential;
checkMetadata(await invoke("vault_request", requestArgs, requestCtx), true, "session");
assert.ok(disposed >= 4);
assert.equal(JSON.stringify(audit).includes(sentinel), false);

// Scope selection is exact, ordered and never preselected from the model suggestion.
const scopeChoice = selections.find(({ title }) => title.startsWith("Allow Pi"));
assert.deepEqual(Array.from(scopeChoice.choices, (choice) => choice.split(":")[0]), ["session", "once", "turn", "target"]);
assert.match(scopeChoice.choices[3], /requested by agent/);
assert.doesNotMatch(scopeChoice.choices[0], /requested by agent/);
assert.match(scopeChoice.choices[0], /including ordinary restarts/);
const requestWithSelection = (select, context = requestCtx, signal) =>
  tools.get("vault_request").execute("synthetic-call", requestArgs, signal, undefined, {
    ...context, ui: { ...context.ui, select },
  });
const normalSelect = requestCtx.ui.select;
const beforeUnknown = records.grants.length;
await assert.rejects(requestWithSelection(async (title, choices) =>
  title.startsWith("Allow Pi") ? "target: forged option" : normalSelect(title, choices)), /Cancelled/);
assert.equal(records.grants.length, beforeUnknown);
const noOwner = { ...requestCtx, sessionManager: undefined };
const missingOwner = await invoke("vault_request", requestArgs, noOwner);
assert.equal(missingOwner.details.reason, "owner_unavailable");
assert.equal(records.grants.length, beforeUnknown);
const unpersistedOptions = [];
await requestWithSelection(async (title, choices) => {
  if (title.startsWith("Allow Pi")) unpersistedOptions.push(...choices);
  return normalSelect(title, choices);
}, { ...requestCtx, sessionManager: { getSessionId: () => owner, getSessionFile: () => undefined } });
assert.match(unpersistedOptions[0], /cannot resume after exit/);
const explicitRemember = await requestWithSelection(async (title, choices) =>
  title.startsWith("Allow Pi") ? choices[3] : normalSelect(title, choices));
assert.equal(explicitRemember.details.scope, "target");
assert.equal(records.grants.at(-1).ownerSessionId, undefined);
assert.equal(explicitRemember.details.operationMeaning, "purpose only");

// Fresh uses resolve the current native owner, not registration-time context.
for (const scope of ["session", "turn"]) {
  const grant = issue({ scope });
  const expiresAt = grant.expiresAt;
  assert.equal((await invoke("vault_use_env", { ...params(grant), operation: undefined })).isError, undefined);
  assert.equal((await invoke("vault_use_stdin", { ...params(grant), field: "username", operation: "different task" })).isError, undefined);
  owner = "synthetic-fork";
  await denied(grant, {}, "owner_mismatch", 2);
  owner = undefined;
  await denied(grant, {}, "owner_unavailable", 2);
  owner = "synthetic-chat-A";
  assert.equal((await invoke("vault_use_env", { ...params(grant), operation: "another task" })).isError, undefined);
  assert.equal(count(grant), 3);
  assert.equal(records.grants.find((row) => row.grantId === grant.grantId).expiresAt, expiresAt);
}
const oldChat = issueLegacy({ scope: "session" });
await denied(oldChat, {}, "legacy_reapproval");
const oldTurn = issueLegacy({ scope: "turn" });
await denied(oldTurn, {}, "legacy_reapproval");
const oldTarget = issueLegacy({ scope: "target" });
await denied(oldTarget, { operation: "different" }, "operation_mismatch");
assert.equal((await invoke("vault_use_env", params(oldTarget))).isError, undefined);
const remember = issue({ scope: "target" });
owner = "synthetic-new-chat";
assert.equal((await invoke("vault_use_env", { ...params(remember), operation: undefined })).isError, undefined);
owner = "synthetic-chat-A";

// Denied owner checks precede all effects and do not spend any adapter's permission.
for (const scope of ["session", "turn"]) {
  const envGrant = issue({ scope });
  const fileGrant = issue({ scope, tool: "file" });
  const beforeEffects = effects;
  owner = "synthetic-clone";
  await denied(envGrant, { ownerSessionId: "synthetic-chat-A" }, "owner_mismatch");
  await denied(envGrant, { field: "username" }, "owner_mismatch", 0, "vault_use_stdin");
  await fileDenied(fileGrant, "owner_mismatch", 0);
  assert.equal(effects, beforeEffects);
  owner = "synthetic-chat-A";
}

// Failed reusable attempts and nonzero exits keep permission and fixed expiry.
for (const name of ["vault_use_env", "vault_use_stdin"]) {
  const reusable = issue({ scope: "session" });
  startFailure = true;
  await denied(reusable, { field: "username" }, "command_start", 1, name);
  startFailure = false;
  exitStatus = 9;
  const retry = await invoke(name, { ...params(reusable), field: "username", operation: "retry" });
  assert.equal(retry.details.exitCode, 9);
  assert.equal(count(reusable), 2);
  exitStatus = 0;
  assert.equal((await invoke(name, { ...params(reusable), field: "username" })).isError, undefined);
  assert.equal(count(reusable), 3);
}
const retryFile = issue({ scope: "session", tool: "file" });
fsFailure = "write";
fsCode = "EEXIST";
await fileDenied(retryFile, "destination_exists", 1);
fsFailure = undefined;
assert.equal((await invoke("vault_write_env_file", fileParams(retryFile))).isError, undefined);
assert.equal(count(retryFile), 2);

// Changes or cancellation while waiting for any approval cannot mint permission.
for (const useExisting of [false, true]) {
  currentCredential = useExisting ? credential : undefined;
  for (const trigger of ["identity", "signal", "lifecycle"]) {
    const total = records.grants.length;
    const controller = new AbortController();
    const result = await requestWithSelection(async (title, choices) => {
      const selected = await normalSelect(title, choices);
      if (title.startsWith("Allow Pi")) {
        if (trigger === "identity") owner = "switched-chat";
        if (trigger === "signal") controller.abort();
        if (trigger === "lifecycle") invocationAborted = true;
      }
      return selected;
    }, requestCtx, controller.signal);
    assert.equal(result.details.reason, "approval_cancelled");
    assert.equal(records.grants.length, total);
    owner = "synthetic-chat-A";
    invocationAborted = false;
  }
}
currentCredential = undefined;
secretHook = () => { owner = "switched-during-secret"; };
const secretStaleCount = records.grants.length;
assert.equal((await invoke("vault_request", requestArgs, requestCtx)).details.reason, "approval_cancelled");
assert.equal(records.grants.length, secretStaleCount);
secretHook = undefined;
owner = "synthetic-chat-A";
const staleFile = issue({ scope: "session", tool: "file" });
const effectCount = effects;
assert.equal((await invoke("vault_write_env_file", fileParams(staleFile), {
  ...ctx, ui: { confirm: async () => { owner = "switched-during-confirmation"; return true; } },
})).details.reason, "approval_cancelled");
assert.equal(count(staleFile), 0);
assert.equal(effects, effectCount);
owner = "synthetic-chat-A";
const fileCancel = new AbortController();
assert.equal((await tools.get("vault_write_env_file").execute("file", fileParams(staleFile), fileCancel.signal, undefined, {
  ...ctx, ui: { confirm: async () => { fileCancel.abort(); return true; } },
})).details.reason, "approval_cancelled");
assert.equal(count(staleFile), 0);

// Public status distinguishes eligibility without exposing native owner IDs.
owner = "different-listing-chat";
const statuses = await invoke("vault_grants", {});
assert.equal(statuses.details.grants.find((row) => row.grantId === staleFile.grantId).status, "other-chat");
assert.equal(statuses.details.grants.find((row) => row.grantId === oldChat.grantId).status, "legacy-reapproval");
assert.equal(statuses.details.grants.find((row) => row.grantId === expired.grantId).status, "expired");
assert.equal(JSON.stringify(statuses).includes("ownerSessionId"), false);
assert.equal(JSON.stringify(statuses).includes("synthetic-chat-A"), false);
owner = "synthetic-chat-A";
const deniedConfirm = issue({ scope: "session", tool: "file" });
assert.equal((await invoke("vault_write_env_file", fileParams(deniedConfirm), {
  ...ctx, ui: { confirm: async () => false },
})).isError, true);
assert.equal(count(deniedConfirm), 0);

console.log("vault synthetic operations: passed");
