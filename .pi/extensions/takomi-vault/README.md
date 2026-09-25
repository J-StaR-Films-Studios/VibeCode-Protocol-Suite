# takomi-vault

Pi extension for secure credential handles and short-lived grants.

## What it does

- stores logins and tokens with encrypted values outside the repo
- agents see handles like `cred_AB12CD34`, never raw secrets
- grants bind credential plus agent plus tool plus target plus operation plus expiry
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

Export and import require human Pi UI and a confirmation showing the resolved path. Export exclusively creates a new file with mode `0600` on POSIX and shows a random 256-bit transfer key once in the UI. Save it separately from the file. The file alone cannot be opened, but anyone with both file and key can import it repeatedly offline. This is not cryptographically one-time. Never paste the key in chat or pass it in command arguments.

Import asks for the key through masked Pi TUI input, authenticates the bounded archive before writing, and refuses a destination with an existing `vault.json`, `key.json`, or `grants.json`, including an empty file. It re-encrypts fields under a new local key and does not transfer grants, audit history, or one-time credential status. Back up existing vault data separately; import never merges or overwrites it. Keep the archive and key secure until you deliberately discard both. Import requires an interactive Pi TUI. `/vault-add` and `vault_request` use masked prompts in the TUI. In RPC mode, they require UI support and `T3_TAKOMI_VAULT_SECRET_UI=1` set by the host on the Pi child. The host must intercept `ctx.ui.input` titles starting with `[takomi-vault-secret] ` and return the secret without persisting its response. Other RPC clients and non-interactive modes cannot enter secrets. Never put secrets in slash arguments. Usernames and labels remain visible. Cancelling secret entry saves nothing. On Windows, file permissions depend on the destination directory's inherited ACLs because Node's POSIX mode is not enforced.

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

`vault_request` is human facing and may show secure UI. `vault_use_env` and `vault_use_stdin` are machine facing and consume a grant. `vault_request_reveal` reveals one named field, always prompts, and is denied without UI.

## Grants

Scopes and time-to-live: `once` (one operation, 5 minutes), `turn` (15 minutes), `session` (12 hours, revoked on shutdown), `target` (30 days for one host). Enforcement binds target plus tool plus scope plus expiry. Operation and agent are recorded and audited. One-time credentials are ephemeral and auto-delete after first use or revoke.

Injection trusts the agent process with use. The guarantee is that secrets never enter transcripts, prompts, or logs — not that a hostile agent cannot misuse a value it was granted.

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
