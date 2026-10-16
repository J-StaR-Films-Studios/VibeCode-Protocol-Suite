# Takomi Credential Gateway

## Status

Vault v1 is shipped in the Pi extension. BLD-001 closes grant and structured-storage bypasses. A bounded v2 pass adds approximate discovery, a redacted per-credential audit command, and human confirmation for every env-file write. Human-only encrypted export/import and TUI-only masked secret entry are implemented. A best-effort input hook warns on a narrow set of likely pasted keys. Browser fill remains unimplemented.

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
| Grant | Time-limited permission for a credential, agent, tool, target and fields. Chat scopes also require a trusted native session owner. |
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
- `/vault-find` and `vault_find` offer approximate service-name discovery with an optional exact host filter. `vault_request` still selects existing credentials by exact service and host only.
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
/vault-audit [id]
/vault-export <path>
/vault-import <path>
```

Export creates a new encrypted archive at the confirmed destination and shows a randomly generated 256-bit transfer key once through human UI. The archive alone is unusable. Anyone who copies both file and key can reuse them offline; the key is not cryptographically one-time. Import confirms the source, asks for the key through masked Pi TUI rather than command arguments, authenticates the archive before changing vault state, and accepts only a destination without vault, key, or grant files. It does not merge or overwrite existing files.

Most commands accept an optional ID. In the Pi UI, omitting the ID opens a picker instead of dumping lists repeatedly. This matches the existing `/router-login` behavior.

## Agent Tools

```text
vault_list()
vault_describe(id)
vault_find({ service, host })
vault_request({ service, host, operation, purpose, suggestedLabel, scope, kind, tool })
vault_use_env({ grantId, credentialId, target, operation, command, args, envMap })
vault_use_stdin({ grantId, credentialId, target, operation, command, args, field })
vault_write_env_file({ grantId, credentialId, target, operation, path, entries, persistent })
vault_request_reveal({ id, field, reason })
vault_grants({ credentialId })
vault_revoke({ grantId, credentialId, all })
```

`vault_request_reveal` reveals one named field only, always prompts, and is denied without UI. There is no silent plaintext read path. `vault_find` returns exact and approximate service matches with field names and active grant counts; an approximate match is only a discovery hint and cannot be auto-selected by `vault_request`.

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

## Grant model

The human chooses from these fixed durations, with session first regardless of the agent suggestion:

- `session`: this chat for up to 12 hours, reusable across messages, tasks and ordinary process restarts.
- `once`: one admitted attempt within 5 minutes.
- `turn`: 15 minutes in this chat, not one model turn.
- `target`: explicit remember for 30 days across chats using the same Vault.

Reuse, failure and restart never refresh expiry. Unsaved credentials remain once-only. Saving a credential and approving access are separate decisions; `/vault-add` issues no grant. `vault_request` always asks again, while the use tools reuse existing permission. Every file write still needs human confirmation, and persistent writes require session or target scope. Credential access never approves deployments, deletion or other actions.

New `policyVersion: 2` grants require an explicit nonempty field allowlist and terminal/file access method. They retain credential, normalized destination, agent, expiry, revocation and use-count restrictions. Operation prose explains purpose, not an arbitrary exact-string permission. Legacy once/target grants keep exact operation matching, with omitted use operation meaning `use`; legacy absent fields still mean all fields. Legacy turn/session grants lack a trustworthy owner and fail closed with reapproval required. They are never assigned to the next chat that reads them.

Chat ownership comes from each invocation's public `ctx.sessionManager.getSessionId()`, never model parameters, the generic `pi` agent name, a title, PID or registration-time context. The SDK retains this ID on resume/restart and creates distinct IDs for new/fork/clone. An unsaved native session supports current-chat permission but cannot promise recovery after exit. Missing or invalid identity refuses chat scopes, without silently choosing a different scope. Approval and file-confirmation awaits recheck cancellation and native identity before issuance or spending.

The gateway validates and increments use count under one cross-process file lock before any command or file effect. Once attempts are nonrefundable after admission, even on startup or write failure. Denied attempts do not spend. Reusable failures and nonzero exits leave permission valid for retries. Shutdown retains temporary-file and key-cache cleanup but never globally revokes chat grants. Another chat cannot use a grant, and cannot end its lifetime by shutting down.

These checks bind a caller-supplied target, not the destination of the child command. Terminal injection trusts that process with the approved values. Native identity isolates chats within the host; it does not authenticate against malicious code running as the same OS user.

Default save behavior: do not save unless the user selects save. Saved agent-request credentials are created only after the user completes grant approval. One time use creates an ephemeral credential row that is deleted after a spent grant even if the adapter fails, on revoke, or on revoke-all, so it never accumulates as vault trash. The window between request and use is the only time it appears in listings, marked one-time.

## Client Components

### Secure input UI

Masked TUI prompt rendered outside the chat transcript. Shown when the agent calls `credentials.request` and no matching credential or grant exists.

Contains:

- service name and purpose
- masked fields, for example token or username plus password
- save choice: do not save, save to vault
- allow scope: this chat, one attempt, 15 minutes in this chat, explicit remember across chats
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
- env file: gateway confirms every write through human UI, creates a new file exclusively, and tracks non-persistent files for session-shutdown cleanup. A persistent write also requires a session or target grant.

Every env-file write requires UI confirmation showing cwd, resolved destination and key names, never values. Without UI the tool refuses the write. Existing files and final symlinks cannot be overwritten. The tool records the confirmed parent's real path and rechecks it immediately before exclusive creation, refusing a changed symlinked parent. This is not an atomic directory handle: another process can still swap the parent between that check and creation. Both temporary and persistent writes put plaintext on disk; temporary cleanup is best-effort at session shutdown and cannot protect against crashes.

Browser form fill, HTTP header injection, SSH, and OTP adapters are v2.

## Data Flow

1. Pi needs auth and calls `credentials.request`.
2. Gateway offers exact matching saved credentials, or private input for new values.
3. Each request asks for approval, even when another grant already exists.
4. User enters values and picks save scope plus allow scope.
5. Pi receives credential ID and grant ID, no plaintext.
6. Pi calls `credentials.use` with the grant and an adapter.
7. Gateway validates credential, agent, tool, target, fields, expiry and native chat owner where required. Legacy once/target also require exact operation.
8. Gateway decrypts locally and injects through the adapter.
9. Plaintext exists for the shortest practical time and never enters chat or logs.
10. Gateway logs the use and expires or revokes the grant on schedule.

## Database Schema

JSON files persist credentials and grants under cross-process locks. Metadata is plaintext. Secret values are encrypted blobs.

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
  "policyVersion": 2,
  "grantId": "grant_<128-bit hex>",
  "credentialId": "cred_...",
  "agent": "pi",
  "tool": "terminal | file",
  "target": "convex.dev",
  "operation": "deploy",
  "fields": ["token"],
  "scope": "session",
  "ownerSessionId": "<trusted native session ID>",
  "expiresAt": 1777580854310,
  "revoked": false,
  "useCount": 0
}
```

`ownerSessionId` is required only for v2 turn/session rows and forbidden on once/target rows. Public tools and commands never return it. The grant file accepts valid v1 legacy stores and mixed legacy/v2 rows in a v2 envelope. A v1 envelope cannot contain v2 rows. First new issuance writes outer `version: 2`; all later writes retain it, even after new grants are revoked. This makes old loaded readers refuse the file rather than silently ignoring ownership. Unknown or malformed rows/envelopes fail closed without overwrite. There is no private migration. Previously admitted operations in old processes cannot be recalled by this format guard.

`fields` may be absent on pre-existing legacy grants, which retain their all-field meaning. `createdBy: agent-once` marks ephemeral rows for auto-delete. New audit lines carry a timestamp, fixed event name, validated credential/grant IDs, scope, tool, simple operation identifier, and hostname when available. Readers discard free-form fields from older lines, including `result`, and accept only validated structured metadata. Grant issuance fails and rolls back the grant if its audit write fails. Revocation remains effective when audit is unavailable; revoke and ephemeral-deletion events are best-effort and may be missing from the log. `/vault-audit [id]` shows the latest 50 matching events for a credential; `/vault-status` shows the latest eight events across credentials. Older audit files may still contain previously recorded free-form strings on disk and need separate secure retention handling.

Event names include requested, approved, denied, used, expired, revoked, created, deleted, renamed, and revealed. No new audit event stores values or arbitrary paths or commands.

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
- syntactically invalid or structurally malformed vault and grant files fail closed with an error instead of being overwritten with empty state; corrupt key files also fail closed
- a key file that cannot be unwrapped (different user, wrong passphrase) throws instead of rekeying; a missing key alongside existing vault data also fails closed instead of generating a new key

Moving PCs uses explicit encrypted export/import. The transfer key appears once in UI, but a saved copy remains usable with the archive. No auto sync. The archive uses AES-256-GCM with a new random key and nonce; its encrypted payload contains metadata and plaintext fields before sealing. Import limits the archive to 12 MiB and plaintext to 8 MiB, validates credential IDs, timestamps, names, visibility, uniqueness, and field limits, then re-encrypts each field under the destination key. It keeps credential IDs and safe metadata, resets `createdBy` to `human`, and transfers no grants or audit history. A destination must have no `vault.json`, `key.json`, or `grants.json`, and no existing OS-stored key. A failure after destination key creation may leave a new key file but cannot overwrite an existing vault or key; remove that new empty destination only after checking its contents before retrying.

## Security Notes

- Secrets stay outside the repo under `~/.pi/agent/takomi-vault`.
- Command and tool output redacts secret values. Child stdout is scrubbed for verbatim secrets, which stops accidental leaks but not a hostile agent encoding exfiltration. Injection trusts the agent process with use; the guarantee is that secrets never enter transcripts, prompts, or logs.
- Extension does not log secrets. Audit logs IDs, targets, decisions, and expiry only.
- Target binding is enforced in code, not in the prompt.
- Every `.env` write requires human UI approval and exclusive creation; permanent writes also need a session or target grant. Both are plaintext on disk.
- `/vault-add`, `vault_request`, and `/vault-import` collect password, token, and transfer key values through a masked `ctx.ui.custom()` TUI component. RPC and non-TUI modes refuse secret entry; usernames and labels still use ordinary prompts. Cancelled entry does not save a credential or import an archive.
- Pi's `input` hook checks raw submitted text for PEM private keys, GitHub tokens, and labeled AWS access key IDs. In the TUI it asks before sending the original text; without interactive UI it blocks matching input. The warning never includes the matched value. This is best-effort only: it cannot protect every entry path, attachment, unknown token format, or secret already submitted before this hook runs.

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
- The narrow chat input check is not universal prevention. Use `/vault-add` or `vault_request` rather than pasting secrets; choosing to send anyway puts the original text in chat.
- Approximate service lookup is for `/vault-find` and `vault_find` only. Host filtering and `vault_request` matching remain exact. Lookup recognizes normalized names, substrings, and one-character edits for names of at least five characters.
- Linux without a secret service needs `TAKOMI_VAULT_PASSPHRASE` each session, otherwise the key rests on file permissions only.
- Export/import requires human Pi UI. The key never enters tool results, audit entries, or command arguments. Import uses masked TUI input; the confirmed path is shown in UI, so do not choose a shared destination.
- Export creates the file exclusively with POSIX mode `0600`. On Windows, Node file modes do not enforce an ACL; protection depends on the destination directory's inherited ACL. The archive is reusable by anyone with its key.
- Browser fill remains unimplemented. Masking hides values on screen, not from the terminal's paste source or a compromised local process. macOS Keychain storage uses `security -w` with stdin and never retries with the key in argv; this path has not been exercised on a Mac in the scratch-data test suite.
- A field allowlist on a new grant currently supports all fields or one named field. Legacy grants with no allowlist retain all-field access. The terminal target is caller-supplied; do not treat host binding as network destination verification.

## Related Docs

- [Pi OAuth Router](./Pi_OAuth_Router.md)
- [Takomi Context Manager](./Takomi_Context_Manager.md)
- [Lean Unified Skills Architecture](./Lean_Unified_Skills_Architecture.md)
