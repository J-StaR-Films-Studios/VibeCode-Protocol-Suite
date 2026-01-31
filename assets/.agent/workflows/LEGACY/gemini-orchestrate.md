---
description: Orchestrate parallel AI agents using the VibeCode CLI
---

# VibeCode Orchestrator Workflow

This workflow uses the `vibecode` CLI to spawn, manage, and merge parallel AI agents working in isolated git worktrees.

## Prerequisites
- `vibecode` CLI installed (`pnpm link --global`)
- Windows Terminal (`wt`)
- Git repository initialized

---

## 1. Single Agent Task

// turbo
1. Spawn an agent to build a specific feature:
```bash
vibecode spawn vibe-builder "Create a new [FeatureName] component in src/components/[Path]. Ensure strict typing." --worktree [feature-name]
```

## 2. Monitor Progress

// turbo
2. Watch agent status in real-time:
```bash
vibecode status --watch
```

## 3. Review & Merge

// turbo
3. Once the agent status is `[OK] complete`, merge the feature:
```bash
vibecode merge [feature-name]
```

---

## Advanced: Parallel Orchestration

To run multiple features at once:

1. Spawn multiple agents:
```bash
vibecode spawn vibe-builder "Build Auth Login" --worktree auth-login
vibecode spawn vibe-builder "Build Dashboard Stats" --worktree dash-stats
vibecode spawn vibe-designer "Design Landing Page" --worktree landing-ui
```

2. Watch them all:
```bash
vibecode status --watch
```

3. Merge as they finish:
```bash
vibecode merge auth-login
vibecode merge dash-stats
vibecode merge landing-ui
```
