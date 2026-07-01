# TakomiFlow Portable Plugin

## Goal

Move the proven TakomiFlow Google Flow automation into this repository as the source-of-truth portable package so users and agents can install it on fresh machines, reuse existing trusted Chrome sessions, and operate through MCP when available or CLI when not.

## Components

### Codex Plugin

- `plugins/takomi-flow/`
  - source-of-truth plugin package
  - bundled skill, MCP server, CLI, schemas, prompts, and provider contract
  - browser automation scripts for trusted Chrome attach and Flow generation
- `.agents/plugins/marketplace.json`
  - repo-local marketplace entry for `takomi-flow`
- `scripts/install-takomi-flow.ps1`
  - optional installer for copying/registering the plugin into user/global Codex plugin paths

### Agent Surface

- First-run agents should run `doctor`, then check whether `http://127.0.0.1:9222` is already serving Chrome DevTools Protocol.
- If CDP is alive, agents should reuse it.
- If CDP is missing, agents should start `trusted-chrome` and ask the user to sign into Google Flow manually.
- Agents should prefer MCP tools when the harness supports MCP.
- Agents should fall back to CLI commands when MCP is absent or unsupported.

### Runtime Surface

- CLI-first core: `node scripts/takomi-flow.mjs <command>`.
- MCP adapter: `node scripts/mcp-server.mjs`.
- Browser profile: user-local trusted Chrome profile by default.
- Outputs: run folders with `run.json`, `assets.json`, `report.md`, screenshots, downloads, and optional video frames.

## Data Flow

1. Agent discovers or installs the plugin from this repo.
2. Agent runs readiness checks.
3. Agent checks for an existing trusted Chrome CDP instance.
4. Agent reuses the instance or launches trusted Chrome.
5. User signs in manually when needed.
6. Agent prepares and validates a Flow request.
7. Agent submits only with explicit spend approval.
8. Agent records `projectUrl`, downloads assets, catalogs outputs, and writes a report.

## Database Schema

No database is required.

Persistent state is file-based:

- request JSON under `requests/`
- run metadata in `run.json`
- asset metadata in `assets.json`
- Markdown handoff in `report.md`

## Install / Portability Rules

- MCP is optional, not required.
- A harness without MCP can still use the CLI and skill instructions.
- A fresh computer can bootstrap by running the repo installer or directly invoking the plugin CLI from this repo.
- Global/user writes must be explicit installer actions, not hidden side effects.
- Project URLs must be captured for every generated Flow project.

## Verification

- Plugin validation should pass with the Codex plugin validator.
- Skill validation should pass with the Codex skill validator.
- MCP smoke should pass when Node dependencies are installed.
- CLI `doctor`, `capabilities`, `template`, `workflow`, `inspect`, `assets`, and `report` should work without MCP.
