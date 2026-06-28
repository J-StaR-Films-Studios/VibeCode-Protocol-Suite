param(
  [string]$Root
)

$ErrorActionPreference = "Stop"

function Get-DefaultRoot {
  $pluginRoot = Split-Path -Parent $PSScriptRoot
  $pluginsRoot = Split-Path -Parent $pluginRoot
  return Split-Path -Parent $pluginsRoot
}

function Add-Check([System.Collections.Generic.List[object]]$Checks, [string]$Name, [bool]$Ok, [string]$Detail, [string]$Fix = "") {
  $Checks.Add([pscustomobject]@{
    name = $Name
    ok = $Ok
    detail = $Detail
    fix = $Fix
  }) | Out-Null
}

function Test-JsonFile([string]$PathValue) {
  try {
    Get-Content -Raw -LiteralPath $PathValue | ConvertFrom-Json | Out-Null
    return $true
  } catch {
    return $false
  }
}

$projectRoot = if ($Root) { $Root } else { Get-DefaultRoot }
$projectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
$pluginRoot = Split-Path -Parent $PSScriptRoot
$manifest = Join-Path $pluginRoot ".codex-plugin\plugin.json"
$skillFile = Join-Path $pluginRoot "skills\takomi-codex\SKILL.md"
$detectScript = Join-Path $pluginRoot "scripts\takomi-detect.ps1"
$boardScript = Join-Path $pluginRoot "scripts\takomi-board.ps1"
$policyScript = Join-Path $pluginRoot "scripts\takomi-policy.ps1"
$dispatchScript = Join-Path $pluginRoot "scripts\takomi-pi-dispatch.ps1"
$harnessScript = Join-Path $pluginRoot "scripts\takomi-harness.ps1"

$checks = [System.Collections.Generic.List[object]]::new()

Add-Check $checks "plugin manifest exists" (Test-Path -LiteralPath $manifest -PathType Leaf) $manifest
Add-Check $checks "plugin manifest is valid json" (Test-JsonFile $manifest) $manifest

if (Test-Path -LiteralPath $manifest -PathType Leaf) {
  $parsed = Get-Content -Raw -LiteralPath $manifest | ConvertFrom-Json
  Add-Check $checks "plugin name" ($parsed.name -eq "takomi-codex") "name=$($parsed.name)"
  Add-Check $checks "skills path" ($parsed.skills -eq "./skills/") "skills=$($parsed.skills)"
  Add-Check $checks "default prompts array" ($parsed.interface.defaultPrompt -is [array]) "defaultPrompt type=$($parsed.interface.defaultPrompt.GetType().Name)" "Use an array with up to three prompts."
}

Add-Check $checks "skill entrypoint exists" (Test-Path -LiteralPath $skillFile -PathType Leaf) $skillFile
Add-Check $checks "detect script exists" (Test-Path -LiteralPath $detectScript -PathType Leaf) $detectScript
Add-Check $checks "board script exists" (Test-Path -LiteralPath $boardScript -PathType Leaf) $boardScript
Add-Check $checks "policy script exists" (Test-Path -LiteralPath $policyScript -PathType Leaf) $policyScript
Add-Check $checks "dispatch script exists" (Test-Path -LiteralPath $dispatchScript -PathType Leaf) $dispatchScript
Add-Check $checks "harness script exists" (Test-Path -LiteralPath $harnessScript -PathType Leaf) $harnessScript

$detect = & $detectScript -Root $projectRoot -Json | ConvertFrom-Json
Add-Check $checks "project root readable" (Test-Path -LiteralPath $projectRoot -PathType Container) $projectRoot
Add-Check $checks "project .pi detected" ([bool]$detect.project.pi) $detect.paths.projectPi "Run takomi setup project if this repo should have a local Pi runtime."
Add-Check $checks "project routing policy detected" ([bool]$detect.project.routingPolicy) $detect.paths.projectRouting "Add .pi/takomi/model-routing.md if model routing should be project-owned."
Add-Check $checks "takomi cli available" ([bool]$detect.cli.takomi.available) ($detect.cli.takomi.path ?? "missing") "Install or expose the takomi CLI if Pi dispatch should be available."
Add-Check $checks "pi cli available" ([bool]$detect.cli.pi.available) ($detect.cli.pi.path ?? "missing") "Install or expose Pi if direct Pi launch should be available."

$failed = $checks | Where-Object { -not $_.ok }

Write-Output "Takomi Codex doctor"
Write-Output "Project: $projectRoot"
Write-Output "Plugin:  $pluginRoot"
Write-Output ""

foreach ($check in $checks) {
  $mark = if ($check.ok) { "OK " } else { "WARN" }
  Write-Output "[$mark] $($check.name): $($check.detail)"
  if (-not $check.ok -and $check.fix) {
    Write-Output "      fix: $($check.fix)"
  }
}

Write-Output ""
if ($failed.Count -eq 0) {
  Write-Output "Takomi Codex doctor passed."
} else {
  Write-Output "Takomi Codex doctor found $($failed.Count) item(s) to review."
}
