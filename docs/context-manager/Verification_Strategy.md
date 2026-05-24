# Takomi Context Manager Verification Strategy

## Test Commands

Primary local dev path:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Alternative global Pi path:

```powershell
cd ..
pi
```

## Verification Cases

### 1. Baseline Prompt Report

Ask for a context report before doing work.

Expected:

- report shows prompt/kernel/tool/skill sections
- report includes estimated size
- full skill descriptions are absent from always-on prompt after implementation

### 2. Simple Task

Prompt:

```txt
fix a typo in README
```

Expected:

- no full skills loaded
- no Takomi workflow loaded
- no model routing policy loaded
- direct execution behavior

### 3. Vague Context Task

Prompt:

```txt
this system prompt feels bloated
```

Expected:

- likely candidates surface, e.g. `optimize-agent-context`, `takomi`
- descriptions are not fully injected unless manifest requested

### 4. Manifest Request

Prompt/tool call:

```txt
skill_manifest: optimize-agent-context takomi pi-subagents
```

Expected:

- returns name, description, location for all requested skills
- does not return full SKILL.md content

### 5. Direct Skill Load

Prompt:

```txt
use the takomi skill
```

Expected:

- manifest step may be skipped
- full Takomi `SKILL.md` loads

### 6. Subagent Delegation

Prompt:

```txt
delegate a review task to a subagent
```

Expected:

- model routing policy and subagent routing policy are available together
- policy is not always injected before this point

### 7. Takomi Genesis

Prompt:

```txt
run Takomi Genesis for a new project
```

Expected:

- Genesis workflow pack loads only because Genesis is selected
- Design/Build playbooks are not fully loaded unless needed

### 8. Duplicate Extension Conflict

Run with both global and project Takomi extensions present.

Expected future behavior:

- duplicate tool conflicts are detected or clearly reported
- remediation path is visible

## Pass Criteria

- Always-on prompt is meaningfully smaller.
- Skill loading follows Index -> Manifest -> Pack.
- Tool guidance remains useful and precise.
- Context report explains decisions.
- Small tasks stay direct.
- Large tasks still access Takomi correctly.
