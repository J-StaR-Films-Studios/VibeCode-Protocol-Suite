# oauth-router

Pi extension that auto-loads and registers an `oauth-router` provider with multi-account routing, health tracking, cooldowns, and extension-owned credential storage.

## What it does

- auto-loads from `~/.pi/agent/extensions/oauth-router`
- registers provider: `oauth-router`
- stores multiple accounts in `~/.pi/agent/oauth-router/credentials.json`
- stores health, cooldown, and routing state in `~/.pi/agent/oauth-router/state.json`
- supports account commands:
  - `/router-login add`
  - `/router-login list`
  - `/router-login remove <id>`
  - `/router-login refresh <id>`
  - `/router-status`
  - `/router-enable <id>`
  - `/router-disable <id>`
  - `/router-policy <name>`
- routes across healthy accounts with:
  - round robin
  - weighted round robin
  - 429 cooldowns
  - transient failure penalties
  - auth failure quarantine
  - safe pre-output failover

## Default upstreams

The extension ships with two default upstream profiles:

1. `chatgpt-codex`
   - auth mode: OAuth
   - oauth provider: `openai-codex`
   - api: `openai-codex-responses`
   - default models: `gpt-5.1`, `gpt-5.4`, `gpt-5.4-mini`

2. `openai-compatible`
   - auth mode: API key fallback
   - api: `openai-responses`
   - default models: `gpt-4o`, `gpt-4.1`, `o4-mini`

Edit `~/.pi/agent/oauth-router/config.json` to add more upstreams, swap endpoints, or change model catalogs.

## Setup

1. Restart Pi or run `/reload`
2. Confirm the provider is present:
   - `pi --list-models | grep oauth-router`
3. Add an account:
   - OAuth: `/router-login add chatgpt-codex`
   - API key fallback: `/router-login add openai-compatible`
4. Check state:
   - `/router-status`
5. Select a model:
   - `oauth-router/gpt-5.4`
   - `oauth-router/gpt-4o`

## Account storage format

Credentials live in:

- `~/.pi/agent/oauth-router/credentials.json`

Shape:

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

Health state lives separately in:

- `~/.pi/agent/oauth-router/state.json`

## Security notes

- credentials are stored separately from health state
- files are written with restrictive permissions where the OS allows it
- command output redacts secrets
- the extension does not log access or refresh tokens

## Known limitations

- Pi's built-in `/login` is intentionally not used for multi-account storage because Pi stores one OAuth identity per provider entry
- the shipped OAuth adapter reuses Pi's built-in `openai-codex` OAuth implementation; generic OpenAI-compatible upstream OAuth still requires provider-specific adapters
- safe failover only happens before meaningful output is emitted; no unsafe mid-stream account switching is attempted
- API key fallback is supported, but OAuth remains the primary path for subscription-style upstreams

## Validation

Run:

```bash
python scripts/vibe-verify.py
```

## Docs

OAuth Router documentation is maintained in the repo-level docs tree so it stays unified with the rest of Takomi/Pi documentation:

- `../../../docs/features/Pi_OAuth_Router.md`
- `../../../docs/oauth-router/genesis/Project_Requirements.md`
- `../../../docs/oauth-router/genesis/Coding_Guidelines.md`
- `../../../docs/oauth-router/genesis/Builder_Prompt.md`
- `../../../docs/oauth-router/genesis/issues/`
