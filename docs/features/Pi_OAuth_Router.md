# Pi OAuth Router

## Overview

Pi OAuth Router is a Pi extension that registers an `oauth-router` provider and routes requests across multiple OAuth-authenticated or API-key accounts without running a separate router process.

The extension code lives in the repo at:

```text
.pi/extensions/oauth-router
```

The global Pi extension path is linked to that repo folder by `scripts/sync-pi-global.ps1`:

```text
~/.pi/agent/extensions/oauth-router -> <repo>/.pi/extensions/oauth-router
```

Runtime credentials and health state remain outside the repo under the user's Pi data directory:

```text
~/.pi/agent/oauth-router/
  config.json
  credentials.json
  state.json
```

Do not commit or move those credential/state files into the repository.

## Capabilities

- Registers provider: `oauth-router`
- Exposes selectable models such as:
  - `oauth-router/gpt-5.4`
  - `oauth-router/gpt-5.4-mini`
  - `oauth-router/gpt-4o`
- Supports multiple accounts per upstream
- Stores credentials separately from extension source
- Tracks account health, cooldowns, failures, and routing metadata
- Supports routing policies:
  - round robin
  - weighted round robin
  - disabled-account skipping
  - 429 cooldowns
  - transient-failure penalties
  - auth failure quarantine
- Retries another account only while it is still safe, before meaningful output is emitted

## Commands

```text
/router-login add <upstream-id>
/router-login list
/router-login remove [id]
/router-login delete [id]
/router-login rename [id] [label]
/router-login relogin [id]
/router-login refresh [id]
/router-delete [id]
/router-rename [id] [label]
/router-relogin [id]
/router-status
/router-usage [id]
/router-quota [id]
/router-usage-raw [id]
/router-refresh-usage [id|all]
/router-enable [id]
/router-disable [id]
/router-policy <name>
```

## Default upstreams

### `chatgpt-codex`

- Auth mode: OAuth
- OAuth provider: `openai-codex`
- API: `openai-codex-responses`
- Default models: `gpt-5.1`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`

### `openai-compatible`

- Auth mode: API key fallback
- API: `openai-responses`
- Default models: `gpt-4o`, `gpt-4.1`, `o4-mini`

## Setup / verification

From the repo root, sync the extension into global Pi:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-pi-global.ps1
```

Then restart Pi or run:

```text
/reload
```

Verify provider registration:

```powershell
pi --list-models
```

Expected output should include rows with provider `oauth-router`.

## Account storage

Credentials live in:

```text
~/.pi/agent/oauth-router/credentials.json
```

Example shape:

```json
{
  "version": 1,
  "accounts": [
    {
      "id": "acct_ab12cd34",
      "label": "Primary Codex",
      "provider": "openai-codex",
      "upstreamId": "chatgpt-codex",
      "access": "<sensitive>",
      "refresh": "<sensitive>",
      "expires": 1777580854310,
      "enabled": true,
      "weight": 1,
      "createdAt": 1776000000000,
      "updatedAt": 1776000000000,
      "meta": {
        "accountId": "..."
      }
    }
  ]
}
```

Health/routing state and local usage samples live in:

```text
~/.pi/agent/oauth-router/state.json
```

Usage reporting includes router-observed rolling 5-hour and weekly windows per account. `/router-refresh-usage [id|all]` also probes configured authenticated provider endpoints for ChatGPT/Codex quota windows, then falls back to safe token metadata such as account id, expiry, issuer, subject, and claim keys. `/router-usage` shows a compact visual quota view; `/router-usage-raw [id]` shows detailed/raw provider data. OAuth tokens generally do not contain exact provider quota percentages; exact Codex/ChatGPT 5-hour and weekly remaining windows depend on undocumented provider-side endpoints and may change.

Most account commands accept an optional account ID. In the Pi UI, omitting the ID opens an account picker instead of printing the same account list repeatedly.

Configuration lives in:

```text
~/.pi/agent/oauth-router/config.json
```

## Security notes

- Credentials remain outside the repo.
- Command output redacts secrets.
- Token inspection reports metadata only, not raw access or refresh tokens.
- Credential files are written with restrictive permissions where the OS supports them.
- The extension does not intentionally log access or refresh tokens.

## Known limitations

- Pi's built-in `/login` is intentionally not used for multi-account routing because Pi stores one OAuth identity per provider entry.
- The shipped OAuth adapter reuses Pi's built-in `openai-codex` OAuth implementation.
- Generic OpenAI-compatible OAuth still requires provider-specific adapters.
- Safe failover only happens before meaningful output is emitted; no unsafe mid-stream account switching is attempted.
- Duplicate OAuth identities are detected after login and converted into an existing-account credential update unless explicitly allowed, because the same real account can cause refresh-token conflicts across router entries or clients.
- Local 5-hour/weekly usage windows only include traffic routed through this extension.

## Related docs

- [OAuth Router Genesis PRD](../oauth-router/genesis/Project_Requirements.md)
- [OAuth Router Builder Prompt](../oauth-router/genesis/Builder_Prompt.md)
- [OAuth Router Coding Guidelines](../oauth-router/genesis/Coding_Guidelines.md)
- [OAuth Router Genesis Issues](../oauth-router/genesis/issues/)
