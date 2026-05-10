# Design Architecture: takomi-context-manager

## Overview

`takomi-context-manager` is a Pi extension that reduces always-on prompt bloat while preserving discoverability and high-quality tool usage. It is implemented project-locally first, then packaged with Takomi later.

## Extension Location

MVP:

```txt
.pi/extensions/takomi-context-manager/index.ts
```

Expanded module layout after MVP:

```txt
.pi/extensions/takomi-context-manager/
  index.ts
  types.ts
  skill-registry.ts
  skill-tools.ts
  prompt-rewriter.ts
  context-router.ts
  diagnostics.ts
  policies.ts
```

For the first build, keep one `index.ts` acceptable if it remains readable.

## Pi APIs Used

- `pi.registerTool()` for progressive context tools.
- `pi.registerCommand()` for human diagnostics/inspection commands.
- `pi.on("before_agent_start")` for prompt compaction and candidate injection.
- `pi.on("context")` only if message-level pruning becomes necessary.
- `ctx.getSystemPrompt()` for diagnostics.

## Registered Tools

- `skill_index`
- `skill_manifest`
- `skill_load`
- `context_report`

Tool names intentionally avoid colliding with existing `takomi_*` tools.

## State Model

The extension keeps an in-memory last report:

```ts
type LastContextReport = {
  timestamp: string;
  cwd: string;
  userPrompt: string;
  skillCount: number;
  candidates: CandidateContext[];
  loadedByTool: string[];
  promptRewrite: {
    attempted: boolean;
    changed: boolean;
    originalLength: number;
    rewrittenLength: number;
    removedSections: string[];
    warnings: string[];
  };
};
```

This state is diagnostic only. It should not be persisted in LLM context.

## Skill Registry Source

Preferred source:

```ts
event.systemPromptOptions.skills
```

Fallback source:

- parse the current `<available_skills>` XML from `event.systemPrompt`
- discover local/global skill directories only if needed later

## Prompt Rewrite Strategy

MVP uses `before_agent_start` to transform the generated system prompt:

1. Detect `<available_skills>...</available_skills>`.
2. Parse skill names/descriptions/locations.
3. Replace the verbose block with a names-only Skill Index and progressive loading rule.
4. Preserve tool contract and edit rules.
5. Append tiny candidate hints if useful.

If parsing fails, do not block the turn. Add diagnostics warning and leave prompt unchanged.

## Packaging Strategy

Phase 1: project-local extension for rapid testing.

Phase 2: include in Takomi package under `.pi/extensions/takomi-context-manager` and add it to package files.

Phase 3: global installer/sync support through Takomi CLI.

## MVP Boundaries

MVP includes:

- skill index/manifest/load tools
- prompt skill-block replacement
- candidate surfacing by simple string scoring
- context report

MVP excludes:

- embeddings/RAG
- persistent cache
- full duplicate extension remediation
- complex UI widgets
