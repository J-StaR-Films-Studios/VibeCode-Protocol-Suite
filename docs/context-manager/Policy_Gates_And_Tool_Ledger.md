# Policy Gates and Tool Usage Ledger

## Purpose

`takomi-context-manager` now enforces context prerequisites before sensitive tool calls. This keeps heavy policies out of the always-on prompt while still preventing unsafe or under-informed actions.

## Policy Pack Source of Truth

`takomi-context-manager` does **not** own model-routing policy content.

Model routing is created/updated by Takomi's existing `/takomi routing` flow and discovered from:

```json
.pi/settings.json -> takomi.modelRoutingPolicyFile
```

In this project that points to:

```txt
.pi/takomi/model-routing.md
```

Supplemental/default policy packs can still live in configured discovery paths such as `.pi/takomi/policies`, but they do not replace Takomi's routing source of truth.

## Implemented / Discoverable Policy Packs

- `model-routing` from Takomi settings / `/takomi routing`
- `subagent-routing` optional supplemental policy pack
- `takomi-lifecycle-routing` optional supplemental policy pack

## Implemented Tools

### `policy_manifest`

Returns descriptions for available policy packs without loading full policy text.

### `policy_load`

Loads one or more full policy packs and records them in the tool usage ledger.

Example:

```json
{ "policies": ["model-routing"] }
```

## Context Prerequisite Gates

### `takomi_subagent`

Requires:

- `model-routing`

When a project, global, or bundled routing policy is available, the context manager puts its guidance in the system prompt before delegation. The first `takomi_subagent` call does not need a blocked retry. The routing text remains available on later turns.

If no routing policy is available, the first delegation asks the user to continue with harness defaults for this session or set up a routing policy. Continuing is session-only and writes no files. Setting up pauses delegation so the user can choose project or global scope through `/takomi routing`. Without an interactive UI, delegation pauses instead of assuming consent. Other configured policy prerequisites still use the block-and-load gate.

No global read-before-edit/write gate is installed. The earlier read-before-edit idea was only an analogy and is intentionally not enforced by `takomi-context-manager`.

## Tool Usage Ledger

The extension tracks:

- loaded policies
- loaded skills
- blocked actions
- loaded policies
- loaded skills
- tool call counts

This is visible through `context_report`.

## Behavior Philosophy

Available routing guidance is supplied before the model chooses a subagent, rather than blocking the call after the choice. When no policy exists, the gate records a pause or the user's session-only approval. Other configured prerequisites still block and supply missing policy context for retry.
