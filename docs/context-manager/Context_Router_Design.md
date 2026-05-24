# Context Router Design

## Goal

Surface likely context packs without loading their full content.

## Inputs

- Current user prompt.
- Recent user messages if available later.
- Skill names and descriptions from registry.
- Active Takomi stage/runtime state if available.

## MVP Scoring

```ts
score = 0
if prompt contains exact skill name: score += 100
if prompt contains normalized skill name words: score += 50
for each meaningful description keyword in prompt: score += 10
if prompt contains known synonym/trigger: score += 20
```

Normalize:

- lowercase
- split hyphens into words
- remove punctuation
- ignore common stopwords

## Thresholds

| Score | Action |
|---:|---|
| >= 100 | High confidence: suggest `skill_load` |
| 40-99 | Medium confidence: suggest `skill_manifest` |
| < 40 | Do not inject candidate |

Limit candidates to top 5.

## Candidate Format

```ts
type CandidateContext = {
  name: string;
  score: number;
  confidence: "high" | "medium";
  suggestedAction: "skill_load" | "skill_manifest";
  reasons: string[];
};
```

Injected text should be compact:

```txt
Potentially relevant skills:
- optimize-agent-context — use skill_manifest if unsure
- takomi — use skill_load if applying Takomi
```

## Built-in Trigger Seeds

MVP can include a small manual trigger map for high-value cases:

```ts
{
  "optimize-agent-context": ["system prompt", "context bloat", "agent instructions", "prompt kernel"],
  "takomi": ["takomi", "genesis", "design", "build", "orchestration"],
  "pi-subagents": ["subagent", "delegate", "parallel agents"]
}
```

## Future Semantic/RAG Upgrade

FR-010 may add embeddings or semantic retrieval. The public behavior should stay the same: candidates are surfaced, not full packs.

## False Positive Control

- Do not inject candidates for common words alone.
- Require at least one strong match or multiple weak matches.
- Prefer no candidate over noisy candidate.

## Diagnostics

Each candidate must record reason strings for `context_report`.
