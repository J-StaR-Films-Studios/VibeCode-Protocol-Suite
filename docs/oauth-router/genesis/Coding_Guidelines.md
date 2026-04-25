# Coding Guidelines

> **This document is the LAW.** Follow it without exception.

---

## 🛑 The Verification Protocol (MANDATORY)

### After EVERY TypeScript File Edit

```bash
python scripts/vibe-verify.py --quick
```

**If this command fails:**
1. **STOP.** Do not touch another file.
2. Read the error carefully.
3. Fix the problem.
4. Re-run the command.
5. Only proceed when it passes.

### Before Any Handoff or "Done" Claim

```bash
python scripts/vibe-verify.py
```

All checks must pass. No exceptions.

---

## The Blueprint & Build Protocol

### Phase 1: Blueprint (Before Writing Code)

Before implementing any non-trivial feature:

1. **Context Analysis**
   - Check `docs/issues/` for the matching FR
   - Check `README.md` and `docs/Builder_Prompt.md`
   - Identify routing, auth, and persistence impact

2. **Create the Plan**
   - Add or update a feature note in `docs/features/`
   - Document data flow, commands touched, and failover implications

3. **Get Approval**
   - Present the plan when the change is large or architectural

### Phase 2: Build (Implementation)

1. **Announce**: `Implementing FR-XXX`
2. **Reference**: Open the matching issue in `docs/issues/`
3. **Implement**: One module at a time
4. **Verify**: `python scripts/vibe-verify.py --quick`
5. **Mark Complete**: Check off acceptance criteria as work lands
6. **Update Issue**: Keep issue files aligned with reality

### Phase 3: Finalization

1. Run `python scripts/vibe-verify.py`
2. Update acceptance criteria
3. Generate a handoff summary with limits and follow-ups

---

## Architecture Rules

### Provider Layer

- `index.ts` wires the extension
- `provider.ts` owns provider registration and routing execution
- `commands.ts` owns user-facing slash commands
- `oauth-flow.ts` owns login and refresh flows
- `oauth-store.ts` owns secret persistence
- `state.ts` owns health and cooldown persistence
- `policies.ts` owns account selection strategy

### Security Rules

- Never print or persist secrets outside the credential store
- Separate health state from secrets
- Use restrictive file permissions where the OS allows it
- Redact sensitive fields in any user-visible output

### Failover Rules

- Retry another account only if no meaningful output has been emitted
- Do not switch mid-stream after content is visible
- Treat 401/403 as auth health failures
- Treat 429 as cooldown events
- Treat 5xx/network issues as temporary penalties

---

## File Structure

```
oauth-router/
├── index.ts
├── provider.ts
├── commands.ts
├── oauth-flow.ts
├── oauth-store.ts
├── state.ts
├── policies.ts
├── config.ts
├── types.ts
├── docs/
└── scripts/
```

---

## Recovery Protocol

If you break something:

```bash
git status
python scripts/vibe-verify.py --quick
pi --list-models | grep oauth-router
```

If provider registration fails, fix the extension load error before changing behavior.
