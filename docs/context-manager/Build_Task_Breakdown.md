# Build Task Breakdown: takomi-context-manager

## Build Stage Tasks

### TCM-BLD-001: Extension Scaffold

**Role:** coder  
**Model:** oauth-router/gpt-5.4 high  
**Depends on:** Design complete

Create `.pi/extensions/takomi-context-manager/index.ts` with Pi extension factory, imports, basic state, and no-op diagnostics.

DoD:

- Extension loads without syntax errors.
- No tool name conflicts.
- `/reload` works.

### TCM-BLD-002: Skill Registry Normalization

**Role:** coder  
**Model:** oauth-router/gpt-5.4 high

Implement skill extraction from `event.systemPromptOptions.skills` and fallback XML parsing.

DoD:

- Registry contains name/description/location.
- Names are sorted/stable.
- Missing fields are handled.

### TCM-BLD-003: Progressive Skill Tools

**Role:** coder  
**Model:** oauth-router/gpt-5.4 high

Register `skill_index`, `skill_manifest`, and `skill_load`.

DoD:

- Index returns names only.
- Manifest supports multiple skills.
- Load reads one full `SKILL.md` safely.

### TCM-BLD-004: Prompt Rewrite / Context Firewall

**Role:** coder  
**Model:** oauth-router/gpt-5.5 medium

Implement `before_agent_start` prompt rewrite replacing `<available_skills>` with names-only index and progressive loading rules.

DoD:

- Full descriptions are removed from always-on block.
- Tool guidance remains intact.
- Failures are non-blocking and diagnostic.

### TCM-BLD-005: Candidate Router

**Role:** coder  
**Model:** oauth-router/gpt-5.4 high

Implement MVP string scoring and candidate hint injection.

DoD:

- Exact skill names produce high confidence.
- Vague context prompts suggest relevant skills.
- Low-confidence prompts add no noise.

### TCM-BLD-006: Context Diagnostics

**Role:** coder/reviewer  
**Model:** oauth-router/gpt-5.4 high

Implement `context_report` tool and `/context-report` command.

DoD:

- Shows prompt before/after length.
- Shows candidates and reasons.
- Shows warnings.

### TCM-BLD-007: Duplicate Extension Conflict Diagnostics

**Role:** coder  
**Model:** oauth-router/gpt-5.4 high

Investigate whether active extension/tool metadata can detect duplicate global/project Takomi extensions. If not feasible, document limitation and add manual guidance to report.

DoD:

- Conflict is at least documented in diagnostics/help.
- No risky workaround is added without evidence.

### TCM-BLD-008: Integration Verification

**Role:** reviewer  
**Model:** oauth-router/gpt-5.5 high

Run verification prompts using local Pi dev and/or global Pi path.

DoD:

- Results recorded in `docs/context-manager/Test_Report.md`.
- Bugs are listed with severity.
- Build is accepted or sent back with concrete fixes.

## Build Order

```txt
TCM-BLD-001
  -> TCM-BLD-002
  -> TCM-BLD-003
  -> TCM-BLD-004
  -> TCM-BLD-005
  -> TCM-BLD-006
  -> TCM-BLD-007
  -> TCM-BLD-008
```

## Recommended Next Step

Expand the Takomi board into Build using the tasks above, then implement in order.
