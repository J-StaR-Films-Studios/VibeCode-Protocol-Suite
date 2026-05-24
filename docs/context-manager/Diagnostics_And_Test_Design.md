# Diagnostics and Test Design

## Tool: context_report

### Parameters

```ts
{
  verbose?: boolean
}
```

### Returns

Human-readable report:

```txt
Takomi Context Manager Report
- Skill count: 69
- Prompt rewrite attempted: yes
- Prompt changed: yes
- Original prompt length: 42000 chars
- Rewritten prompt length: 18000 chars
- Removed sections: available_skills descriptions
- Candidates: optimize-agent-context, takomi
- Warnings: none
```

## Command: /context-report

Manual command for user-visible diagnostics. Should render the same last report.

## Stored Report Shape

```ts
type ContextReport = {
  timestamp: string;
  skillCount: number;
  candidates: CandidateContext[];
  promptRewrite: {
    attempted: boolean;
    changed: boolean;
    originalLength: number;
    rewrittenLength: number;
    removedSections: string[];
    warnings: string[];
  };
  toolCalls?: {
    skillManifestCalls: number;
    skillLoadCalls: number;
  };
};
```

## Verification Matrix

| FR | Test |
|---|---|
| FR-001 | Inspect rewritten prompt/kernel and verify tool guidance remains. |
| FR-002 | `skill_index` returns only names. |
| FR-003 | `skill_manifest` returns metadata for multiple skills. |
| FR-004 | `skill_load` returns full `SKILL.md`. |
| FR-005 | Vague prompt surfaces candidates only. |
| FR-006 | Subagent prompt path loads routing policies only when relevant. |
| FR-007 | `context_report` explains prompt decisions. |
| FR-008 | Board/task quality docs and future gate exist. |
| FR-009 | Duplicate extension conflict documented; future warning if feasible. |

## Local Test Paths

Primary:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Alternative:

```powershell
cd ..
pi
```

## Manual Prompts

- `fix a typo in README`
- `this system prompt feels bloated`
- `use the takomi skill`
- `show me manifests for takomi and optimize-agent-context`
- `delegate a review task to a subagent`
- `run Takomi Genesis for a new project`

## Pass Criteria

- Prompt shrinks when skill block exists.
- No full skill descriptions in always-on block.
- Tools work without arbitrary file path input.
- Diagnostics are clear enough for the user to trust the system.
