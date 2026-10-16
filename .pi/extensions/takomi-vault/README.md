# takomi-vault

Pi extension for secure credential handles and short-lived grants.

## What it does

- stores logins and tokens with encrypted values outside the repo
- agents see handles like `cred_AB12CD34`, never raw secrets
- grants bind credential, agent, terminal/file access, destination, fields and expiry, with chat ownership for reusable chat approval
- injection adapters run commands with secrets in env or stdin without returning values
- audit log records requests, approvals, denials, uses, and revocations with no secret values

## Storage

Runtime data lives outside the repo:

```text
~/.pi/agent/takomi-vault/
  vault.json
  grants.json
  config.json
  audit.log
  key.json
```

Backend selection is automatic with no native modules:

- Windows: DPAPI through PowerShell, tied to the Windows user
- macOS: Keychain through the `security` CLI
- Linux: `secret-tool` when present
- fallback: passphrase wrapped key with `TAKOMI_VAULT_PASSPHRASE`, otherwise a file-permission key with a warning state

Do not commit vault data into the repository.

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
/vault-export <path>
/vault-import <path>
```

Export and import require human Pi UI. In the Pi TUI, use `/vault-export <path>` and `/vault-import <path>`. Export exclusively creates a new file with mode `0600` on POSIX and shows a random 256-bit transfer key in a temporary TUI screen. Save it separately before closing the screen; the key cannot be shown again. The file alone cannot be opened, but anyone with both file and key can import it repeatedly offline. This is not cryptographically one-time. Never paste the key in chat or pass it in command arguments.

In T3 Code on web, desktop, or mobile, `/vault-export` asks for a new path **on the environment host** (or pass it as an argument). After confirmation, use the thread's Vault download control to save the encrypted file to your device and see the key once. `/vault-import` asks you to select the archive from your device, then enter the transfer key in a masked prompt. Do not put a path or key in its RPC slash arguments. The host must opt in with `T3_TAKOMI_VAULT_TRANSFER_UI=1`; it intercepts private `takomi_vault_export` JSONL records and `[takomi-vault-archive]` inputs before native logging, and transfers the archive and key through private authenticated RPC, never thread history or tool results. Other RPC hosts cannot use these transfer commands. The archive remains on the exporting environment host until you remove it separately.

Import authenticates the bounded archive before writing and refuses a destination with an existing `vault.json`, `key.json`, or `grants.json`, including an empty file. It re-encrypts fields under a new local key and does not transfer grants, audit history, or one-time credential status. Back up existing vault data separately; import never merges or overwrites it. Keep the archive and key secure until you deliberately discard both. `/vault-add` and `vault_request` use masked prompts in the TUI. In RPC mode, they require UI support and `T3_TAKOMI_VAULT_SECRET_UI=1` set by the host on the Pi child. The host must intercept `ctx.ui.input` titles starting with `[takomi-vault-secret] ` and return the secret without persisting its response. Other RPC clients and non-interactive modes cannot enter secrets. Never put values in slash arguments. Field names and credential labels remain visible; field values do not enter the thread. Cancelling entry saves nothing. On Windows, file permissions depend on the destination directory's inherited ACLs because Node's POSIX mode is not enforced.

## Agent tools

```text
vault_list
vault_describe
vault_find
vault_request
vault_use_env
vault_use_stdin
vault_write_env_file
vault_request_reveal
vault_grants
vault_revoke
```

`vault_request` asks the human for values. The agent can specify `fields` by name, for example `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, without supplying either value. Every field uses private entry; fields default to inject-only. Use `kind: "login"` only for actual username/password credentials. `/vault-add` offers custom named fields in both the TUI and T3 Code. The grant screen shows the stored field names, not generic username/password labels. `vault_use_env` and `vault_use_stdin` are machine facing and consume a grant. `vault_request_reveal` reveals one named field, always prompts, and is denied without UI.

## Grants

The first approval choice is `session`, this chat for up to 12 hours. It works across messages, tasks and ordinary process restarts when the host resumes the same saved native Pi session. `turn` means 15 minutes in this chat. Neither scope transfers to a new, forked or cloned chat. An unsaved native chat cannot resume after exit. If the host cannot identify the chat, chat-scoped approval is refused.

`once` permits one admitted attempt within 5 minutes. `target` is an explicit choice to remember approval for 30 days across chats using the same Vault. Every scope still restricts the approved host, credential, fields and terminal/file access. The agent can suggest a scope but cannot preselect remember. Reuse, retries and restarts never extend expiry. Do not save offers only once approval or cancellation. Unsaved credentials auto-delete after the admitted attempt or revoke. Saving alone, including `/vault-add`, does not grant access.

Every successful `vault_request` returns the issued credential ID, grant ID, target host, tool, purpose, approved fields, scope, expiry, use count and saved status. Pass that target host, such as `github.com`, not `terminal` or `file`. Terminal grants use `vault_use_env` or `vault_use_stdin`; file grants use `vault_write_env_file`. `envMap` and `entries` map environment variable names to approved stored field names, never values. For new policy-version-2 grants, operation text explains purpose. Changing or omitting it does not invalidate approval. Credential access does not approve deployments, deletion or other actions; normal action confirmations still apply.

Reuse the issued grant through the use tools. Calling `vault_request` again always asks for approval again. Legacy once/target grants retain exact operation matching, including spaces and capitalization; omitting operation means `use`. Legacy turn/session grants have no trusted chat owner and require approval again. The extension never assigns old grants to the current chat.

Enforcement checks target, tool, agent, approved fields, native chat owner where required, expiry, revocation, once-use count, credential ID and persistent-write scope. Legacy once/target grants also check exact operation; legacy grants without a field restriction retain their all-field meaning. Policy denials do not spend a grant. Each admitted attempt increments use count before command execution or file creation. A failed once attempt cannot be refunded. Reusable grants survive startup failures, nonzero exits and file-creation failures until expiry or revoke.

File creation requires confirmation for every write and an existing parent, and never overwrites files or symlinks. Known denials return fixed reasons; unknown failures hide private error details. `vault_grants` distinguishes usable-here, other-chat, legacy-reapproval, expired, revoked and spent status without showing owner IDs. Applicability alone does not prove a requested destination, tool or field is allowed. Shutdown cleans temporary files and the key cache, not chat grants. New grants use a version-2 grant-file envelope that old loaded extension code refuses. Copying extension files does not replace code already loaded in a running process.

Injection gives the agent process access to the approved values. Output redaction and private entry keep those values out of ordinary tool results; they cannot prevent a hostile process from misusing or transforming them.

For model-driven private entry, RPC hosts must also set `T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY=1` and handle the versioned ownership open/close notifications emitted through native `ctx.ui.notify`. Ownership is tied to the validated tool invocation and session, with cancellation on session changes. This is transport capability negotiation, not proof that the child process is trustworthy. Native RPC owns stdout; direct extension writes are not a supported ownership channel. Slash-command admission is unchanged. Hosts must keep entered values and ownership records out of public tool results and persisted transcripts.

## Security notes

- tool and command output redacts secret values
- audit log stores IDs, targets, decisions, and expiry only
- target binding is enforced in code, so a grant for one host cannot be used on another
- revoking Takomi permission does not invalidate the real key at the provider; rotate leaked keys there
- permanent `.env` writes need a session or target grant and are flagged as plaintext on disk
- Pi's pre-send input hook warns on likely pasted PEM private keys, GitHub tokens, and labeled AWS access key IDs; TUI users may explicitly send anyway, while non-interactive matches are blocked. The warning does not show the value. This is best-effort, not universal prevention: attachments, other formats, and input paths outside this hook are not covered

## Setup

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-pi-global.ps1
```

Then restart Pi or run `/reload` and verify with `/vault-status`.
