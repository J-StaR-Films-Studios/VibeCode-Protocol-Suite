param(
  [ValidateSet("create", "show", "add-task", "update-task", "complete-task", "summary")]
  [string]$Action = "show",
  [string]$Root,
  [string]$SessionId,
  [string]$Title = "Takomi Codex Session",
  [string]$TaskId,
  [string]$TaskTitle,
  [string]$Objective,
  [ValidateSet("pending", "in-progress", "completed", "blocked")]
  [string]$Status,
  [string]$Notes
)

$ErrorActionPreference = "Stop"

function Get-DefaultRoot {
  $pluginRoot = Split-Path -Parent $PSScriptRoot
  $pluginsRoot = Split-Path -Parent $pluginRoot
  return Split-Path -Parent $pluginsRoot
}

function New-SafeSlug([string]$Text) {
  $value = ($Text ?? "task").ToLowerInvariant()
  $value = $value -replace "[^a-z0-9]+", "-"
  $value = $value.Trim("-")
  if (-not $value) { return "task" }
  return $value.Substring(0, [Math]::Min(48, $value.Length))
}

function New-SessionId {
  return "orch-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Get-BoardRoot([string]$ProjectRoot) {
  return Join-Path $ProjectRoot "docs\tasks\orchestrator-sessions"
}

function Get-SessionRoot([string]$ProjectRoot, [string]$Id) {
  return Join-Path (Get-BoardRoot $ProjectRoot) $Id
}

function Assert-SafeId([string]$Value, [string]$Name) {
  if ($Value -notmatch "^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$") {
    throw "$Name must use only letters, numbers, hyphen, or underscore."
  }
}

function Ensure-SessionFolders([string]$PathValue) {
  foreach ($folder in @("", "pending", "in-progress", "completed", "blocked")) {
    $target = if ($folder) { Join-Path $PathValue $folder } else { $PathValue }
    New-Item -ItemType Directory -Force -Path $target | Out-Null
  }
}

function Get-TaskPath([string]$SessionRoot, [string]$Folder, [string]$Id, [string]$TaskName) {
  $slug = New-SafeSlug $TaskName
  return Join-Path (Join-Path $SessionRoot $Folder) "$Id`_$slug.task.md"
}

function Find-TaskFile([string]$SessionRoot, [string]$Id) {
  foreach ($folder in @("pending", "in-progress", "completed", "blocked")) {
    $dir = Join-Path $SessionRoot $folder
    $match = Get-ChildItem -LiteralPath $dir -Filter "$Id`_*.task.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) { return $match.FullName }
  }
  return $null
}

function Write-MasterPlan([string]$PathValue, [string]$Name) {
  $text = @"
# $Name

## Goal

Define the work, route it through Takomi, and keep progress visible.

## Context Intake

- Project requirements reviewed: pending
- Feature docs reviewed: pending
- Runtime policy reviewed: pending

## Execution Mode

- Direct Codex work when sufficient
- Markdown roadbook for coordination
- Pi/Takomi or multi-Codex-thread delegation only when useful and available

## Tasks

| Task | Status | Notes |
| --- | --- | --- |

## Verification

- [ ] Required docs updated
- [ ] Implementation verified
- [ ] Summary written
"@
  Set-Content -LiteralPath (Join-Path $PathValue "master_plan.md") -Value $text -Encoding UTF8
}

$projectRoot = if ($Root) { $Root } else { Get-DefaultRoot }
$projectRoot = (Resolve-Path -LiteralPath $projectRoot).Path

if (-not $SessionId -and $Action -eq "create") { $SessionId = New-SessionId }
if (-not $SessionId) {
  $boardRoot = Get-BoardRoot $projectRoot
  $latest = Get-ChildItem -LiteralPath $boardRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($latest) { $SessionId = $latest.Name }
}
if (-not $SessionId) { throw "SessionId is required. Use -Action create first." }
Assert-SafeId $SessionId "SessionId"

$sessionRoot = Get-SessionRoot $projectRoot $SessionId

switch ($Action) {
  "create" {
    Ensure-SessionFolders $sessionRoot
    if (-not (Test-Path -LiteralPath (Join-Path $sessionRoot "master_plan.md"))) {
      Write-MasterPlan $sessionRoot $Title
    }
    Write-Output "Created Takomi roadbook: $sessionRoot"
    Write-Output "SessionId: $SessionId"
  }
  "show" {
    if (-not (Test-Path -LiteralPath $sessionRoot)) { throw "Roadbook not found: $sessionRoot" }
    Write-Output "Takomi roadbook: $sessionRoot"
    foreach ($folder in @("pending", "in-progress", "completed", "blocked")) {
      $count = @(Get-ChildItem -LiteralPath (Join-Path $sessionRoot $folder) -Filter "*.task.md" -ErrorAction SilentlyContinue).Count
      Write-Output "  $folder`: $count"
    }
  }
  "add-task" {
    if (-not $TaskTitle) { throw "TaskTitle is required." }
    Ensure-SessionFolders $sessionRoot
    $existing = Get-ChildItem -LiteralPath (Join-Path $sessionRoot "pending") -Filter "*.task.md" -ErrorAction SilentlyContinue
    if (-not $TaskId) { $TaskId = ("T{0:000}" -f ($existing.Count + 1)) }
    Assert-SafeId $TaskId "TaskId"
    $taskPath = Get-TaskPath $sessionRoot "pending" $TaskId $TaskTitle
    $text = @"
# $TaskId - $TaskTitle

## Objective

$($Objective ?? $TaskTitle)

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Scope completed
- [ ] Docs updated where needed
- [ ] Verification recorded

## Notes

$Notes
"@
    Set-Content -LiteralPath $taskPath -Value $text -Encoding UTF8
    Write-Output "Added task: $taskPath"
  }
  "update-task" {
    if (-not $TaskId) { throw "TaskId is required." }
    if (-not $Status) { $Status = "in-progress" }
    Assert-SafeId $TaskId "TaskId"
    $taskPath = Find-TaskFile $sessionRoot $TaskId
    if (-not $taskPath) { throw "Task not found: $TaskId" }
    $target = Join-Path (Join-Path $sessionRoot $Status) (Split-Path -Leaf $taskPath)
    if ($taskPath -ne $target) { Move-Item -LiteralPath $taskPath -Destination $target -Force }
    if ($Notes) { Add-Content -LiteralPath $target -Value "`n## Update $(Get-Date -Format s)`n`n$Notes" -Encoding UTF8 }
    Write-Output "Updated task $TaskId -> $Status"
  }
  "complete-task" {
    & $PSCommandPath -Action update-task -Root $projectRoot -SessionId $SessionId -TaskId $TaskId -Status completed -Notes $Notes
  }
  "summary" {
    Ensure-SessionFolders $sessionRoot
    $summary = Join-Path $sessionRoot "Orchestrator_Summary.md"
    $lines = @("# Orchestrator Summary", "", "Session: $SessionId", "", "## Task Counts", "")
    foreach ($folder in @("pending", "in-progress", "completed", "blocked")) {
      $count = @(Get-ChildItem -LiteralPath (Join-Path $sessionRoot $folder) -Filter "*.task.md" -ErrorAction SilentlyContinue).Count
      $lines += "- $folder`: $count"
    }
    $lines += @("", "## Notes", "", ($Notes ?? "No summary notes recorded."))
    Set-Content -LiteralPath $summary -Value $lines -Encoding UTF8
    Write-Output "Wrote summary: $summary"
  }
}
