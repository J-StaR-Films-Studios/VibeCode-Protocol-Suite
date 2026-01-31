---
description: Perform a meticulous, manual deep code audit covering Security, Logic, Completeness, and Quality.
---

# Deep Code Audit Protocol

## Phase 0: Scope Definition
**Objective:** Define the boundaries of the audit.
1. **Determine Scope:**
   - **FULL_SCAN**: Audit the entire codebase.
   - **FEATURE_SCAN**: Audit a specific feature (look for `docs/features/[FeatureName].md`).
   - **DIFF_SCAN**: Audit `git diff --staged` or `git diff HEAD~1`.

## Phase 1: The Detective (Static Analysis)
**Objective:** Hard facts and red flags.

2. **Detect Package Manager & Audit**
   - Check lockfiles (`pnpm-lock.yaml`, `package-lock.json`, etc.).
   - Run `[manager] audit` (Critical/High).

3. **Secret & Risk Scanning (Grep or Detective)**
   - **Recommended:** Run `jstar detect` (if installed) to perform static analysis.
   - **Manual Fallback:** `grep_search` patterns:
     - **Secrets:** `(api_key|secret|password|token)\s*[:=]\s*['"\`][a-zA-Z0-9_\-\.]{10,}['"\`]`
     - **RCE/Injection:** `(dangerouslySetInnerHTML|eval\(|exec\(|\.queryRaw)`
     - **Debugging:** `(console\.log|debugger|todo)`

## Phase 2: The Graph (Relational Analysis)
**Objective:** Trace data flow and impact.

4. **Entry Point Analysis**
   - Identify Entry Points (Routes, Actions, CLI Commands) relevant to the Scope.
   - **Trace Input:** Follow user input -> Service -> Database.
   - **Verify Validation:** Ensure Zod/Typebox validation exists at the *edge*.

## Phase 3: The Auditor (Spec vs Code)
**Objective:** Completeness check.

5. **Documentation Comparison**
   - Read specific `docs/features/*.md` relevant to the scope.
   - **Gap Analysis:** List features present in Docs but missing in Code.
   - **Orphan Analysis:** List code that exists but isn't mentioned in Docs (Zombie code).

## Phase 4: The Judge (Deep Logic Audit)
**Objective:** Mental Sandboxing.

6. **Logic Probing**
   - Pick the most complex High-Risk file.
   - **Simulate Attacks:** "What if I send `null`? Empty string? Negative ID?"
   - **Race Conditions:** "What if two requests hit this at once?"
   - **Auth Bypass:** "Can I access this Service function directly?"

## Phase 5: The Architect (Code Quality)
**Objective:** Maintainability and Standards.

7. **Quality Checks**
   - **Performance:** Look for `await` in loops (N+1).
   - **Bloat:** Files > 200 lines? Functions > 50 lines?
   - **Types:** any Usage of `any` or `as unknown`?
   - **Structure:** Does it follow FSD (Feature-Sliced Design)?

## Phase 6: Reporting
**Objective:** Structured Output.

8. **Generate Report**
   - Create `.jstar/audit_report.md`.
   - Table Columns: `[Severity] [Category] [Location] [Issue] [Recommendation]`
   - Severities: `CRITICAL`, `HIGH`, `WARNING`, `INFO`.
   - Categories: `SECURITY`, `LOGIC`, `COMPLETENESS`, `QUALITY`.

## Phase 7: Remediation & Verification
**Objective:** Fix and Prove.

9. **Fix & Verify Loop**
   - For each CRITICAL/HIGH issue:
     - Implement Fix.
     - **Verify:** Run build/tests.
     - **Re-Verify:** Run the specific check (Grep/Logic) to confirm the fix.
     - Git Add.
