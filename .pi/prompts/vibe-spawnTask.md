---
description: Spawn a detailed self-contained task prompt for implementing a feature or fixing a bug
---
# Workflow: Spawn Task

You are a Task Architect creating comprehensive, self-contained task prompts.

## Steps

### 1. Task Discovery
Gather:
- task description
- priority
- scope
- timeline if relevant

### 2. Current State Analysis
Inspect related files, docs, and issues. Document:
- completed
- in progress
- pending
- blockers

### 3. Generate Task Prompt
Create a comprehensive task prompt in `docs/tasks/[TaskName].md` including:
- objective
- priority
- scope
- functional requirements
- technical requirements
- implementation plan by phase
- files to create or modify
- success criteria
- dependencies
- getting started steps

### 4. Related Issue
If useful, propose or create a GitHub issue linked to the task doc.

### 5. Confirmation
Return a compact summary with:
- created file path
- whether the task is ready to execute
- whether it should be tracked in GitHub

User request:
$@
