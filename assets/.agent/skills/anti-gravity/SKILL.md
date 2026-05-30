---
name: anti-gravity
description: Use when the user asks to run Anti-Gravity CLI (agy) for Gemini-like code review, plan review, design critique, or large-context analysis. Anti-Gravity replaces the legacy Gemini CLI workflow.
---

# Anti-Gravity Skill Guide

## When to Use Anti-Gravity
- When the user asks for Gemini-like analysis, review, planning, design critique, or broad context work.
- When a second-model perspective is useful.
- When the task can be expressed as a short, direct `agy` prompt.

## Tested Behavior in This Harness
`agy -p` may produce an empty captured stdout inside the Pi/sandbox harness even when the model answered successfully. The reliable way to verify output here is:
1. run `agy -p` with a short exact prompt,
2. capture a log with `--log-file`,
3. read the created conversation id from the log,
4. inspect `C:/Users/johno/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` for the final model response.

The CLI stores conversation state under:
`C:/Users/johno/.gemini/antigravity-cli/`

If the harness reports `Access is denied` while renaming files in `conversations/`, the response may still be present in the transcript. Prefer checking the transcript before retrying.

## Core CLI Modes
- `agy -p "prompt"` or `agy --print "prompt"` — run a single prompt and print/respond non-interactively.
- `agy --prompt "prompt"` — alias for print mode.
- `agy -c` or `agy --continue` — continue the most recent conversation.
- `agy --conversation <ID>` — resume a previous conversation by ID.
- `agy -i "prompt"` or `agy --prompt-interactive "prompt"` — start interactively and continue the session.
- `agy --sandbox` — run with terminal restrictions enabled.

## Workspace and Safety Flags
- `--add-dir <DIR>` — add a directory to the workspace; repeat for multiple directories.
- `--log-file <PATH>` — write CLI logs to a known path for debugging and transcript discovery.
- `--print-timeout <DURATION>` — set print-mode wait time, e.g. `60s`, `5m`.
- `--dangerously-skip-permissions` — auto-approve tool permission requests. Use only when explicitly appropriate.

## Prompting Rules
Anti-Gravity follows instructions better when prompts are short and strict.

Use this style:
```text
Do not use tools. Return exactly AGY_OK and nothing else.
```

For shell-like requests:
```text
Return only the names of files and folders in the current directory, one per line, with no commentary.
```

Avoid vague prompts such as:
```text
Can you look around and tell me what's here?
```

## Reliable Pi/Harness Pattern
Use this when running from Pi/tooling and stdout is unreliable:

```bash
rm -f C:/Temp/agy-run.log
agy -p "Do not use tools. Return exactly AGY_OK and nothing else." \
  --print-timeout 60s \
  --log-file C:/Temp/agy-run.log

conv=$(grep -oE 'conversation=[0-9a-f-]+' C:/Temp/agy-run.log | tail -1 | cut -d= -f2)
read "C:/Users/johno/.gemini/antigravity-cli/brain/$conv/.system_generated/logs/transcript.jsonl"
```

Expected successful indicators:
- process exits `0`, and
- transcript contains a `MODEL` entry with the requested answer.

## Human Terminal Pattern
When the user runs Anti-Gravity directly in PowerShell, this can print normally:

```powershell
agy -p "reply me with exactly the list of files in this directory and nothing more"
```

## Common Use Cases

### Direct exact response
```bash
agy -p "Do not use tools. Return exactly AGY_OK and nothing else."
```

### Focused review
```bash
agy -p "Review this plan for missing risks. Return 5 bullets max."
```

### Resume prior work
```bash
agy --conversation <conversation-id> -p "Continue the prior review. Focus only on deployment risks."
```

### Multi-directory analysis
```bash
agy --add-dir src --add-dir docs -p "Map the feature flow across these directories. Return concise bullets."
```

## Troubleshooting
- Empty stdout in Pi does not necessarily mean failure; inspect the transcript.
- `Access is denied` under `conversations/` is a local storage/permission issue, not necessarily a model failure.
- If the prompt requires tool use, expect Anti-Gravity to narrate tool intent unless instructed otherwise.
- Use `--log-file` on every automated run so the conversation id and failure mode are recoverable.

## Notes
- Treat Anti-Gravity as the canonical successor to the old Gemini CLI skill.
- Do not use deprecated Gemini CLI flags or model names.
- Prefer exact, bounded prompts over broad exploratory ones.
