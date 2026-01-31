# KiloCode Mode Prompts - Reference Documentation

This directory contains the exported YAML mode definitions from KiloCode. These serve as the foundation for creating VibeCode workflows.

## Overview

KiloCode uses a mode-based system where each mode has:
- **slug**: Unique identifier (e.g., `orchestrator`, `code`)
- **name**: Display name
- **roleDefinition**: Core identity and capabilities
- **whenToUse**: When to invoke this mode
- **description**: Short summary
- **groups**: Tool permissions (read, edit, browser, command, mcp)
- **customInstructions**: Detailed behavior instructions

## Available Modes

| Mode | Purpose | Key Capability |
|------|---------|----------------|
| [`orchestrator`](./orchestrator-export.yaml) | Coordinate complex multi-step projects | Delegates to other modes via `new_task` tool |
| [`code`](./code-export.yaml) | Write, modify, refactor code | Full tool access for implementation |
| [`architect`](./architect-export.yaml) | Plan and design before implementation | Creates todo lists, asks clarifying questions |
| [`ask`](./ask-export.yaml) | Answer questions and explain concepts | Read-only analysis, no code changes |
| [`debug`](./debug-export.yaml) | Systematic debugging and diagnosis | Investigates errors, adds logging |
| [`review`](./review-export.yaml) | Code review and quality assessment | Analyzes diffs, provides feedback |

## Key Insights for VibeCode Workflows

### 1. Orchestrator Pattern
The orchestrator mode is the most important for VibeCode's multi-agent workflow:

```yaml
customInstructions: >-
  1. Break down complex tasks into logical subtasks
  2. For each subtask, use `new_task` tool to delegate
  3. Track and manage progress of all subtasks
  4. Synthesize results when all subtasks complete
```

**Key features:**
- Uses `new_task` tool to spawn sub-agents
- Each subtask gets comprehensive instructions
- Sub-agents signal completion via `attempt_completion`
- Results flow back to orchestrator for synthesis

### 2. Code Mode Pattern
The code mode has full tool access and focuses on implementation:

```yaml
groups:
  - read
  - edit
  - browser
  - command
  - mcp
```

### 3. Tool Groups Reference

| Group | Tools Available |
|-------|-----------------|
| `read` | read_file, list_files, search_files |
| `edit` | write_to_file, apply_diff, edit_file |
| `browser` | browser_action (launch, click, type, etc.) |
| `command` | execute_command |
| `mcp` | MCP server tools |

## VibeCode Adaptation Strategy

Since VibeCode doesn't have a `new_task` tool like KiloCode, we adapt the orchestrator pattern:

1. **Task Spawning**: Use `/spawn_task` workflow to create detailed task files
2. **Sub-agent Simulation**: User manually spawns new chats with task files
3. **Completion Tracking**: Sub-agents create `.done` files or update task status
4. **Orchestrator Review**: Main chat reviews all completed tasks

### Proposed Task Folder Structure

```
docs/tasks/
├── pending/           # Tasks waiting to be worked on
│   ├── TASK-001.md
│   └── TASK-002.md
├── in-progress/       # Tasks currently being worked on
│   └── TASK-003.md
└── completed/         # Tasks that are done
    ├── TASK-001.md
    └── TASK-001.done  # Completion marker with summary
```

## Migration Notes

When converting KiloCode modes to VibeCode workflows:

1. **Keep the role definition** - The core identity remains the same
2. **Adapt tool references** - Map KiloCode tools to VibeCode equivalents
3. **Replace `new_task` with task file creation** - Document the manual handoff process
4. **Add VibeCode-specific conventions** - Reference existing workflows like `/spawn_task`
5. **Include completion protocols** - Define how sub-agents signal they're done

## Future Extensions

Additional KiloCode modes that could be adapted:

- **Test Mode**: Specialized for writing tests
- **Docs Mode**: Focused on documentation
- **Security Mode**: Security-focused analysis
- **Performance Mode**: Optimization specialist

---

*This documentation helps future developers understand the KiloCode foundation and extend the VibeCode workflow system.*
