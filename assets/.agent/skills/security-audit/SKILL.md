---
name: security-audit
description: Perform a meticulous deep code audit covering Security, Logic, Completeness, and Quality. Manual analysis for critical systems.
---

# Security Audit Skill

A comprehensive, manual deep code audit protocol for security-critical systems.

## When to Use
- Before major releases
- Security review requests
- Auditing authentication/payment flows
- When "audit" or "security" is mentioned

## Audit Phases

### Phase 0: Scope Definition
Define boundaries:
- **FULL_SCAN**: Entire codebase
- **FEATURE_SCAN**: Specific feature (`docs/features/[Name].md`)
- **DIFF_SCAN**: `git diff --staged` or `git diff HEAD~1`

### Phase 1: The Detective (Static Analysis)
```bash
# 1. Dependency audit
pnpm audit  # or npm audit

# 2. Secret scanning (use jstar if available)
jstar detect

# 3. Manual grep patterns:
# Secrets
grep -rE "(api_key|secret|password|token)\s*[:=]\s*['\"\`][a-zA-Z0-9_\-\.]{10,}['\"\`]"

# RCE/Injection
grep -rE "(dangerouslySetInnerHTML|eval\(|exec\(|\.queryRaw)"

# Debugging
grep -rE "(console\.log|debugger|todo)"
```

### Phase 2: The Graph (Data Flow)
- Identify Entry Points (Routes, Actions, CLI)
- **Trace Input**: User input → Service → Database
- **Verify Validation**: Zod/Typebox at edge boundaries

### Phase 3: The Auditor (Spec vs Code)
- Read `docs/features/*.md` for scope
- **Gap Analysis**: Features in Docs but missing in Code
- **Orphan Analysis**: Code not in Docs (zombie code)

### Phase 4: The Judge (Logic Probing)
Pick highest-risk file and simulate:
- "What if I send `null`? Empty string? Negative ID?"
- "What if two requests hit this at once?" (race conditions)
- "Can I access this Service function directly?" (auth bypass)

### Phase 5: The Architect (Quality)
- **Performance**: `await` in loops → N+1 queries
- **Bloat**: Files > 200 lines? Functions > 50 lines?
- **Types**: Any use of `any` or `as unknown`?
- **Structure**: Feature-Sliced Design compliance?

### Phase 6: Report
Create `.jstar/audit_report.md`:

| Severity | Category | Location | Issue | Recommendation |
|----------|----------|----------|-------|----------------|
| CRITICAL | SECURITY | `api/auth` | ... | ... |
| HIGH | LOGIC | `service.ts:42` | ... | ... |

Severities: `CRITICAL`, `HIGH`, `WARNING`, `INFO`
Categories: `SECURITY`, `LOGIC`, `COMPLETENESS`, `QUALITY`

### Phase 7: Remediation
For each CRITICAL/HIGH:
1. Implement fix
2. Run build/tests
3. Re-verify with grep/logic check
4. Stage changes
