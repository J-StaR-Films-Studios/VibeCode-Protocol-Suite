# 🛠️ Antigravity Toolbox

> A comprehensive reference of all tools available to the Antigravity AI agent.

---

## 📁 File System Operations

### `view_file`
**Purpose:** View the contents of a file from the local filesystem.
- Supports text files (with line range selection) and some binary files (images, videos).
- First read of a new file enforces 800 lines to understand context.
- Max 800 lines viewable at a time.

### `view_file_outline`
**Purpose:** View the structural outline of a file.
- Shows functions, classes, and their signatures with line ranges.
- **Preferred first-step** for exploring file contents.
- Only works on files, not directories.

### `view_code_item`
**Purpose:** View specific code nodes (classes/functions) by their fully qualified names.
- Example: `Foo.bar` to view function `bar` inside class `Foo`.
- Useful for targeted inspection of specific symbols.

### `list_dir`
**Purpose:** List contents of a directory.
- Shows files and subdirectories with sizes and child counts.
- Requires absolute paths.

### `find_by_name`
**Purpose:** Search for files and subdirectories using `fd`.
- Supports glob patterns, extensions, depth limits, and exclusions.
- Results capped at 50 matches.
- Uses smart case and ignores gitignored files by default.

### `grep_search`
**Purpose:** Find exact pattern matches within files using `ripgrep`.
- Returns filename, line number, and matching line content.
- Supports regex, case-insensitive search, and glob filters.
- Results capped at 50 matches.

---

## ✏️ File Editing Operations

### `write_to_file`
**Purpose:** Create new files.
- Automatically creates parent directories if needed.
- Supports creating artifacts for planning/documentation.
- Can overwrite existing files if explicitly specified.

### `replace_file_content`
**Purpose:** Edit an existing file with a **single contiguous block** of changes.
- Requires exact match of target content.
- Use for single-area modifications.

### `multi_replace_file_content`
**Purpose:** Edit an existing file with **multiple non-contiguous** changes.
- Specify multiple `ReplacementChunks` for scattered edits.
- More efficient than multiple single-edit calls.

---

## 💻 Terminal & Command Operations

### `run_command`
**Purpose:** Propose and execute shell commands.
- OS: Windows, Shell: PowerShell.
- Commands require user approval unless marked safe.
- Can run synchronously or in background.

### `command_status`
**Purpose:** Get status of a background command.
- Check if running or done.
- Retrieve output with configurable character count.

### `send_command_input`
**Purpose:** Send stdin to a running command or terminate it.
- Useful for interactive REPLs and long-running processes.

### `read_terminal`
**Purpose:** Read the contents of a terminal by process ID.
- View output from active terminal sessions.

---

## 🌐 Web & Browser Operations

### `browser_subagent`
**Purpose:** Spawn a browser agent to perform web interactions.
- Click, type, navigate, resize browser.
- Actions are **automatically recorded as WebP videos**.
- Returns control after task completion.

### `read_url_content`
**Purpose:** Fetch content from a URL via HTTP.
- Converts HTML to markdown.
- No JavaScript execution or authentication.
- For static/public content only.

### `view_content_chunk`
**Purpose:** View a specific chunk of previously fetched document content.
- Requires prior `read_url_content` call for that document.

### `search_web`
**Purpose:** Perform a web search for a query.
- Returns summarized information with URL citations.
- Supports optional domain prioritization.

---

## 🖼️ Image Generation

### `generate_image`
**Purpose:** Generate or edit images based on text prompts.
- Create UI mockups, assets, or visual content.
- Can combine/edit up to 3 existing images.
- Results saved as artifacts.

---

## 🔌 MCP (Model Context Protocol) Operations

### `list_resources`
**Purpose:** List available resources from an MCP server.
- Discover what data sources are available.

### `read_resource`
**Purpose:** Retrieve contents of a specific MCP resource.
- Access external data sources via URI.

---

## 📋 Task & Communication Operations

### `task_boundary`
**Purpose:** Indicate the start or update of a task.
- Sets mode: `PLANNING`, `EXECUTION`, or `VERIFICATION`.
- Tracks `TaskName`, `TaskStatus`, and `TaskSummary`.
- Synchronizes with `task.md` checklist.

### `notify_user`
**Purpose:** Communicate with the user during task mode.
- Request artifact review, ask questions, or report status.
- Set `BlockedOnUser` if approval is needed to proceed.
- **Only way to message user during active tasks.**

---

## 📊 Quick Reference Table

| Tool | Category | Primary Use Case |
|------|----------|------------------|
| `view_file` | File System | Read file contents |
| `view_file_outline` | File System | Explore file structure |
| `view_code_item` | File System | Inspect specific functions/classes |
| `list_dir` | File System | Browse directories |
| `find_by_name` | File System | Search for files by name/pattern |
| `grep_search` | File System | Search file contents |
| `write_to_file` | File Editing | Create new files |
| `replace_file_content` | File Editing | Single contiguous edit |
| `multi_replace_file_content` | File Editing | Multiple scattered edits |
| `run_command` | Terminal | Execute shell commands |
| `command_status` | Terminal | Check background command status |
| `send_command_input` | Terminal | Interact with running commands |
| `read_terminal` | Terminal | Read terminal output |
| `browser_subagent` | Browser | Automate browser interactions |
| `read_url_content` | Web | Fetch webpage content |
| `view_content_chunk` | Web | View fetched content chunks |
| `search_web` | Web | Search the internet |
| `generate_image` | Image | Create/edit images via AI |
| `list_resources` | MCP | List MCP server resources |
| `read_resource` | MCP | Read MCP resource content |
| `task_boundary` | Task Mgmt | Track task progress |
| `notify_user` | Communication | Message user during tasks |

---

## 💡 Prompting Tips

1. **For file exploration:** Start with `view_file_outline` before diving into `view_file`.
2. **For search:** Use `find_by_name` for filenames, `grep_search` for content.
3. **For edits:** Use `replace_file_content` for single changes, `multi_replace_file_content` for multiple.
4. **For web content:** Use `read_url_content` for static pages, `browser_subagent` for interactive sites.
5. **For long tasks:** Request artifacts like `implementation_plan.md` for planning and `walkthrough.md` for summaries.
6. **For commands:** Long-running commands go to background; use `command_status` to monitor.

---

*Last Updated: 2026-01-08*

---

MANDATORY: 
1. Use view_file BEFORE every edit to get EXACT current content
2. Fix ONE error at a time, then re-read the file
3. Verify all variables/props exist before using them
4. Check @[current_problems] before declaring done
5. DO NOT PANIC if you make errors - read, understand, fix methodically