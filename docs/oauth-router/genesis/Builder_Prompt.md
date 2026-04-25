# Builder Prompt

Implement and maintain `oauth-router` as a Pi extension, not a separate service.

## Stack-specific instructions

- Extension entrypoint must remain `~/.pi/agent/extensions/oauth-router/index.ts`
- Register the provider with `pi.registerProvider(...)`
- Keep provider auth management extension-owned; do not depend on Pi’s single-provider OAuth slot for multi-account state
- Reuse Pi OAuth adapters from `@mariozechner/pi-ai/oauth` where possible
- Prefer Node built-ins over extra dependencies
- Keep secret storage and health state in separate files under `~/.pi/agent/oauth-router/`

## MUS priority order

1. Provider registration and auto-load
2. Multi-account credential store and commands
3. Routing policy with health awareness
4. Safe failover before meaningful output
5. Observability and docs

## Special considerations

- Never log access or refresh tokens
- Do not attempt unsafe mid-stream account switching
- Treat `openai-codex` OAuth reuse as an adapter, not proof that generic OpenAI-compatible OAuth is solved
- Update `docs/issues/FR-XXX.md` when scope or behavior changes materially
