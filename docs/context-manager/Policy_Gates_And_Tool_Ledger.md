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

If missing, the extension blocks the first attempted `takomi_subagent` call, returns the required policy content in the block reason, marks the policy as loaded for the session, and tells the agent to retry the original `takomi_subagent` call while following the policy.

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

The gate is intentionally visible instead of silently injecting policy context. A blocked tool call becomes an audit trail:

1. Agent attempts sensitive tool.
2. Gate blocks and explains missing context.
3. Agent calls `policy_load`.
4. Agent retries the original tool with the required context loaded.

This mirrors prerequisite safety systems in other harnesses while applying the idea only to model/subagent policy context for this extension.
