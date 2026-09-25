# Takomi Credential Gateway

## Status

Proposed feature / implementation blueprint. Pi first.

## Working Name

**takomi-vault**

## Problem

Agents refuse pasted passwords and API keys, with good reason. Pasted secrets land in chat transcripts, session HTML files, tool logs, and the prompt sent to the model vendor. Telling the user to go add it in settings breaks flow. Pasting it in chat leaks it.

Takomi needs a way for the agent to say it needs a credential, for the user to provide it through secure UI outside the transcript, and for the agent to use it without ever seeing the raw value.

## Goal

Build a Pi extension that acts as authentication infrastructure for agents, not a password manager page.

> The agent gets handles and short lived grants. The gateway injects secrets at use time. Raw values never enter chat, prompts, logs, or tool results unless explicitly granted.

The extension code lives in the repo at:

```text
.pi/extensions/takomi-vault
```

Runtime vault data stays outside the repo under the user Pi data directory:

```text
~/.pi/agent/takomi-vault/
  vault.json
  grants.json
  key.json
  audit.log
  tempfiles.json
```

v1 uses JSON files with the same locking and permission pattern as `oauth-router`. SQLite remains an option if the vault outgrows files.

Do not commit vault data into the repository.

## Non-Goals

- No browser extension in v1.
- No team sync, cloud backup, or cross machine auto sync in v1.
- No global always on agent access in v1.
- No automatic secret detection in chat in v1.
- No SSH signing, TOTP generation, certificates, cookies, or passkeys in v1.
- No casual `get_password` style tool that returns plaintext by default.
- Do not fork Pi internals unless extension hooks are insufficient.

## Core Terminology

| Term | Meaning |
|---|---|
| Credential | One labeled entry, for example GitHub Personal. Has an internal ID like `cred_A18F`, never addressed by label alone. |
| Handle | The opaque ID the agent sees and passes back. Contains no secret material. |
| Field | One value inside a credential, for example username or password. Each field has its own visibility. |
| Discover | Agent can see the label, type, host, and grant status. No values. |
| Use | Agent can ask an adapter to inject the secret for one approved operation. Agent never sees plaintext. |
| Read | Agent actually receives plaintext. Rare, explicit, logged, and off by default. |
| Manage | Create, rename, or delete credentials. Human only in v1. Agent may propose a label, human confirms. |
| Grant | Short lived capability binding credential plus agent plus tool plus target plus operation plus expiry. |
| Adapter | The injection path: process env, stdin responder, temporary file. Browser fill is v2. |

## Credential Types in v1

Support two shapes only:

- login pair: username field plus password field
- token: single opaque secret string such as API key, deploy token, database URL

Field visibility defaults:

- username: agent readable
- password, token: inject only

OAuth subscription tokens stay in the existing `oauth-router`. Do not migrate them.

Deferred to v2 or later: SSH private keys with `sign` instead of `read`, TOTP seeds, certificates, session cookies, passkeys and WebAuthn.

## Capabilities

- Manual vault CRUD with redacted output: add, list, describe, rename, delete.
- Agent proposed labels with human confirmation. Agent can suggest `Convex - JStar F5`, user accepts or renames. Labels never act as IDs.
- Agent flow in two tools with different intent:
  - `credentials.request` is human facing. It may interrupt execution and show secure UI.
  - `credentials.use` is machine facing. It consumes an existing grant through an adapter.
- Semantic lookup by service and project in v1 is exact match on service plus host only. No fuzzy search in v1.
- Per credential permissions view: which agents may discover, which may use on which target, read status.
- One command revoke that kills session grants immediately.
- Audit timeline per credential with no secret values.

## Commands

```text
/vault-add
/vault-list
/vault-describe [id]
/vault-rename [id] [label]
/vault-delete [id]
/vault-status
/vault-revoke [grant-id | credential-id | all]
/vault-find <service> [host]
```

Export and import are v2. Until then, moving machines means copying the vault directory and re-establishing the OS key or passphrase.

Most commands accept an optional ID. In the Pi UI, omitting the ID opens a picker instead of dumping lists repeatedly. This matches the existing `/router-login` behavior.

## Agent Tools

```text
vault_list()
vault_describe(id)
vault_find({ service, host })
vault_request({ service, host, operation, purpose, suggestedLabel, scope, kind })
vault_use_env({ grantId, credentialId, target, command, args, envMap })
vault_use_stdin({ grantId, credentialId, target, command, args, field })
vault_write_env_file({ grantId, credentialId, target, path, entries, persistent })
vault_request_reveal({ id, field, reason })
vault_grants({ credentialId })
vault_revoke({ grantId, credentialId, all })
```

`vault_request_reveal` reveals one named field only, always prompts, and is denied without UI. There is no silent plaintext read path. `vault_find` returns handles with field names and active grant counts so the agent maps env vars without guessing.

Example agent sequence:

```text
Pi calls credentials.request for convex deploy token
Takomi shows secure TUI with save options and allow scope
User approves once for this project
Pi receives { credential_id, grant_id }, no token value
Pi calls credentials.use with adapter env and variable CONVEX_DEPLOY_KEY
Gateway launches the child process with the injected env
Agent sees stdout and stderr only
Grant expires, audit log records the use
```

## Grant Model

Scopes in v1, with time-to-live enforced by expiry timestamps:

- once: exactly one operation, 5 minute window
- turn: 15 minute window standing in for the agent turn
- session: 12 hour window, revoked early on session shutdown
- target: 30 day window for one service host, for example `github.com`, until revoked

No persistent global grant in v1. Enforcement binds target plus tool plus scope plus expiry. Operation and agent are recorded on every grant and audit event but matching on them is v2, so the prompt-injection defense in v1 is target binding: a grant for one host is denied on any other host.

Every grant binds:

```json
{
  "grant_id": "grant_B11D",
  "credential": "cred_A18F",
  "agent": "pi",
  "tool": "terminal",
  "target": "github.com",
  "operation": "login",
  "expires": "2026-09-24T10:15:00+01:00"
}
```

The gateway enforces agent plus target plus operation plus lifetime outside the model. A grant for `github.com` used against another host is denied automatically. This is the main prompt injection defense.

Default save behavior: do not save unless the user selects save. One time use creates an ephemeral credential row that is deleted automatically after first use, on revoke, or on revoke-all, so it never accumulates as vault trash. The window between request and use is the only time it appears in listings, marked one-time.

## Client Components

### Secure input UI

Masked TUI prompt rendered outside the chat transcript. Shown when the agent calls `credentials.request` and no matching credential or grant exists.

Contains:

- service name and purpose
- masked fields, for example token or username plus password
- save choice: do not save, save to vault
- allow scope: once, turn, session, this target
- cancel and provide actions

Pressing provide does not create a chat message with values. Pi receives IDs only.

### Vault management UI

- Credential list with redacted values, last used time, and grant status per agent.
- Detail view with field visibility, allowed targets, and permission matrix for Pi, Codex, Claude.
- Clear separation between revoke Takomi permission and revoke the real credential. Deleting from Takomi does not invalidate a leaked token elsewhere. The UI must say this.

## Server Components

The Pi extension owns:

- vault CRUD and labeling
- grant issuance, validation, expiry, and revocation
- adapter injection for env and stdin
- audit logging with redaction
- storage backend selection per OS

### Adapters in v1

- process env injection: gateway starts the child process with the secret in env, agent sees output only, env disappears on exit
- stdin responder: gateway writes the secret to PTY stdin for interactive prompts such as Password, transcript shows `[SECRET INJECTED]`
- temporary file: gateway writes immediately before execution, tracks the path, and removes it on session shutdown; non-persistent writes only

Permanent `.env` writes require explicit approval showing repo, path, and key names, never values. The UI warns that values land as plaintext on disk.

Browser form fill, HTTP header injection, SSH, and OTP adapters are v2.

## Data Flow

1. Pi needs auth and calls `credentials.request`.
2. Gateway checks for a matching credential and active grant.
3. If none exists, gateway opens secure input UI.
4. User enters values and picks save scope plus allow scope.
5. Pi receives credential ID and grant ID, no plaintext.
6. Pi calls `credentials.use` with the grant and an adapter.
7. Gateway validates agent plus target plus operation plus lifetime.
8. Gateway decrypts locally and injects through the adapter.
9. Plaintext exists for the shortest practical time and never enters chat or logs.
10. Gateway logs the use and expires or revokes the grant on schedule.

## Database Schema

Single SQLite file plus sidecar config. Metadata is plaintext. Secret values are always encrypted blobs.

`vault.json` holds credentials with encrypted field blobs, `grants.json` holds grants, `audit.log` holds append-only audit lines, `key.json` holds the wrapped data key, `tempfiles.json` tracks non-persistent env files for session-end cleanup. Shapes:

```json
{
  "id": "cred_<128-bit hex>",
  "label": "Convex - JStar F5",
  "service": "convex",
  "host": "convex.dev",
  "type": "token",
  "createdBy": "human | agent-request | agent-once",
  "fields": [{ "name": "token", "visibility": "inject-only", "valueEnc": { "iv": "...", "tag": "...", "data": "..." } }]
}
```

```json
{
  "grantId": "grant_<128-bit hex>",
  "credentialId": "cred_...",
  "agent": "pi",
  "tool": "terminal | file",
  "target": "convex.dev",
  "operation": "deploy",
  "scope": "once | turn | session | target",
  "expiresAt": 1777580854310,
  "revoked": false,
  "useCount": 0
}
```

`createdBy: agent-once` marks ephemeral rows for auto-delete. Audit lines carry `at, credentialId, agent, event, target, result` and never secret values or free-form labels.

Audit events include requested, approved, denied, used, expired, and revoked. Audit never stores secret values.

Example credential shape seen by the agent:

```json
{
  "id": "cred_A18F",
  "label": "Convex - JStar F5",
  "service": "convex",
  "host": "convex.dev",
  "type": "token",
  "fields": {
    "token": { "visibility": "inject-only" }
  }
}
```

## Storage Backend

Portable extension, machine local vault. Same code on Windows, Mac, Linux. No native modules, so install never breaks.

Tier 1, OS native where available through built in OS tools:

- Windows: DPAPI through PowerShell and .NET `ProtectedData`, tied to the Windows user account
- macOS: Keychain through the `security` CLI
- Linux: `secret-tool` through libsecret when present

Tier 2, encrypted file fallback when no OS store exists:

- AES-256-GCM through Node built in crypto, scrypt with N=131072, r=8, p=1 for passphrase wrapping
- random data key, wrapped by the OS store when available, otherwise wrapped by a passphrase from `TAKOMI_VAULT_PASSPHRASE`
- without an OS store or passphrase the key is stored with file permissions only, reported as backend `file-permissions`, and treated as machine-local protection, not real encryption
- corrupt vault, grant, or key files fail closed with an error instead of being overwritten with empty state
- a key file that cannot be unwrapped (different user, wrong passphrase) throws instead of rekeying, so a bad unlock never destroys the vault

Moving PCs is explicit export and import with a one time transfer key. No auto sync.

## Security Notes

- Secrets stay outside the repo under `~/.pi/agent/takomi-vault`.
- Command and tool output redacts secret values. Child stdout is scrubbed for verbatim secrets, which stops accidental leaks but not a hostile agent encoding exfiltration. Injection trusts the agent process with use; the guarantee is that secrets never enter transcripts, prompts, or logs.
- Extension does not log secrets. Audit logs IDs, targets, decisions, and expiry only.
- Target binding is enforced in code, not in the prompt.
- Permanent `.env` writes need a session or target grant and are flagged as plaintext on disk.
- `vault_request` collects values through Pi `ui.input`, which has no masked password mode. Values still bypass the transcript, but shoulder-surfing masking depends on Pi UI support.

## Setup / Verification

From the repo root, sync the extension into global Pi:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-pi-global.ps1
```

Then restart Pi or run:

```text
/reload
```

Verify with:

```text
/vault-list
/vault-status
```

Expected result is an empty vault with storage backend reported, for example `windows-dpapi`, `macos-keychain`, `linux-secret-tool`, `passphrase`, or `file-permissions`.

## Known Limitations

- v1 has no browser field injection. CLI and API key flows come first.
- v1 has no chat interception. The agent must call `vault_request`. Magic detection of pasted secrets is deferred.
- v1 lookup is exact service plus host match. Fuzzy naming comes later.
- Linux without a secret service needs `TAKOMI_VAULT_PASSPHRASE` each session, otherwise the key rests on file permissions only.
- Export and import are not built yet. Copying the vault directory moves it; the OS key or passphrase must move with it.
- Operation and agent matching on grants, per-field allowlists, and atomic multi-process grant spending are v2. v1 binds target plus tool plus scope.

## Related Docs

- [Pi OAuth Router](./Pi_OAuth_Router.md)
- [Takomi Context Manager](./Takomi_Context_Manager.md)
- [Lean Unified Skills Architecture](./Lean_Unified_Skills_Architecture.md)
