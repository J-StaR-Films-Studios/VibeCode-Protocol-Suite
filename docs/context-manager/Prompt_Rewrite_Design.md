# Prompt Rewrite and Context Firewall Design

## Objective

Compact the system prompt by replacing bulky always-on context with progressive loading instructions, without weakening tool usage quality.

## Hook

Use:

```ts
pi.on("before_agent_start", async (event, ctx) => { ... })
```

Inputs:

- `event.prompt`
- `event.systemPrompt`
- `event.systemPromptOptions`

Output:

- `{ systemPrompt: rewrittenPrompt }`

## What Must Stay Always-On

- Assistant identity.
- Core tool contract.
- Exact edit safety rules.
- Pi docs routing compact note.
- Task sizing / anti-ceremony rule.
- Skill loading rule.
- Names-only skill index.
- Compact Takomi runtime state if available.

## What Must Move Out

- Full skill descriptions.
- Full model routing policy.
- Full Takomi workflow playbooks unless selected.
- Long repeated orchestration instructions.
- Verbose Pi docs path map unless user asks about Pi internals.

## Skill XML Replacement

Detect:

```xml
<available_skills> ... </available_skills>
```

Replace with:

```txt
Available skills (names only):
- skill-a
- skill-b

Skill loading:
- You are given a skill index containing skill names only.
- For uncertain matches, request skill_manifest for likely skills; manifests include descriptions and locations.
- If a skill is clearly relevant or the user names it directly, use skill_load without requesting a manifest first.
- Load full skill instructions only for skills you will actually use.
```

## Candidate Hint Injection

Append after the Skill Index only when candidates meet threshold:

```txt
Potentially relevant context:
- optimize-agent-context (consider skill_manifest if unsure)
- takomi (consider skill_load if using Takomi)
```

Keep this list to 3-5 items.

## Fallbacks

If XML parsing fails:

- Do not fail the turn.
- Leave system prompt unchanged.
- Record warning in context report.

If `systemPromptOptions.skills` is missing:

- Parse XML.
- If parse fails, use empty registry and report warning.

## Risks

- Pi's prompt format may change.
- Extensions may chain and rewrite prompt after this extension.
- Some models may rely on descriptions for skill selection.

## Mitigations

- Use diagnostics to show before/after sizes.
- Keep manifest tool easy to discover.
- Keep candidate hints based on descriptions internally, even when descriptions are not injected.
- Avoid rewriting tool contract until proven safe.
