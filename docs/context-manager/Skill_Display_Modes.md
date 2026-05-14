# Skill Display Modes

`takomi-context-manager` supports configurable skill visibility in the rewritten system prompt.

## Config

Optional project/user config path:

```txt
.pi/takomi/context-manager/config.json
```

Default behavior is built into the extension, so this file is not required.

```json
{
  "skillDisplay": {
    "mode": "candidates",
    "maxVisibleSkillNames": 80,
    "alwaysShowToolInstructions": true
  }
}
```

## Modes

### `hidden`

Shows only the skill count and points the agent to `skill_index`.

```txt
Skills: 71 available. Use skill_index if this task may need a skill.
```

### `candidates` default

Shows skill count plus dynamically ranked candidates for the current request. If no high-confidence candidates are surfaced, the prompt gives a soft reminder to use `skill_index` rather than claiming no skill is relevant.

```txt
Skills: 71 available.
Potentially relevant skills:
- takomi — use skill_load if relevant
- optimize-agent-context — use skill_manifest if relevant
```

Each user request can surface a different candidate list. Candidate surfacing is a heuristic hint, not an authority.

### `all-names`

Shows all skill names in the prompt, but still omits descriptions.

Use for debugging or smaller skill registries.

### `auto`

Shows all names only when the skill count is less than or equal to `maxVisibleSkillNames`; otherwise behaves like `candidates`.

## Relationship to Context Router Candidate Surfacing

These features do not compete:

- **Context Router Candidate Surfacing** computes likely relevant skills.
- **Skill Display Mode** decides how much of that information appears in the system prompt.
- **Progressive Skill Loading Tools** (`skill_index`, `skill_manifest`, `skill_load`) let the agent fetch more detail when needed.

The prompt rewriter is the only place that renders candidate hints, preventing duplicate candidate blocks.
