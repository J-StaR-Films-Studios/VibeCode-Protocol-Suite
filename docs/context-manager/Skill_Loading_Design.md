# Skill Loading Design

## Progressive Flow

```txt
Skill Index -> Skill Manifest -> Skill Pack
```

The manifest step is optional.

Rules:

- Always expose skill names only by default.
- If uncertain, request one or more manifests.
- If confident or user names the skill directly, load full `SKILL.md` directly.
- Load full skill instructions only for skills actually used.

## Skill Record

```ts
type SkillRecord = {
  name: string;
  description?: string;
  location?: string;
  source?: "systemPromptOptions" | "xml" | "manual";
};
```

## Tool: skill_index

### Parameters

```ts
{}
```

### Returns

```txt
Available skills:
- takomi
- optimize-agent-context
- pdf
```

### Notes

Should include only names. No descriptions unless a debug flag is added later.

## Tool: skill_manifest

### Parameters

```ts
{
  skills: string[]
}
```

### Returns

For each requested skill:

```txt
Skill: takomi
Description: Unified Takomi protocol skill for Codex...
Location: C:\Users\...\takomi\SKILL.md
```

### Behavior

- Supports multiple skills in one call.
- Preserves input order.
- Unknown skills return a clear `not found` entry.
- Does not read full `SKILL.md`.

## Tool: skill_load

### Parameters

```ts
{
  skill: string
}
```

### Returns

- skill name
- location
- full `SKILL.md` content

### Behavior

- Requires exact skill name or unique case-insensitive match.
- Reads only `SKILL.md` for the selected skill.
- If location is absent, return an actionable error.
- If the path is outside known skill directories, warn and refuse unless explicitly allowed later.

## Path Safety

MVP should allow paths already supplied by Pi's discovered skills metadata or parsed prompt XML. Do not accept arbitrary paths from the model.

## Coexistence with Pi Native Skills

Pi already supports `/skill:name`. `takomi-context-manager` should not remove that behavior. The new tools add model-callable progressive loading.

## Error Examples

Unknown skill:

```txt
Skill not found: foo
Known close matches: frontend-design, prompt-engineering
```

Missing location:

```txt
Skill found but no SKILL.md location is available. Request a manifest after Pi reload or check skill discovery.
```

## Tests

- `skill_index` returns names only.
- `skill_manifest` returns multiple descriptions/locations.
- `skill_load` returns full content for `takomi`.
- Unknown skill produces clear error.
- Direct user-named skill can skip manifest.
