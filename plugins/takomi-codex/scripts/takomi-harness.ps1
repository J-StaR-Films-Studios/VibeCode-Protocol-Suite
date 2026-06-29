param(
  [ValidateSet("status", "harnesses", "sync", "setup", "refresh")]
  [string]$Action = "status",
  [string]$Root,
  [string]$Target = "",
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

function Get-DefaultRoot {
  $pluginRoot = Split-Path -Parent $PSScriptRoot
  $pluginsRoot = Split-Path -Parent $pluginRoot
  return Split-Path -Parent $pluginsRoot
}

function Get-Takomi {
  $cmd = Get-Command "takomi" -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "takomi CLI is not available." }
  return $cmd.Source
}

$projectRoot = if ($Root) { $Root } else { Get-DefaultRoot }
$projectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
$takomi = Get-Takomi

$argsList = switch ($Action) {
  "status" { @("status") }
  "harnesses" { @("harnesses") }
  "sync" { if ($Target) { @("sync", $Target) } else { @("sync") } }
  "setup" { if ($Target) { @("setup", $Target) } else { @("setup") } }
  "refresh" { if ($Target) { @("refresh", $Target) } else { @("refresh") } }
}

Write-Output "Takomi harness bridge"
Write-Output "Project: $projectRoot"
Write-Output "Mode:    $(if ($Execute) { "execute" } else { "dry-run" })"
Write-Output "Command: $takomi $($argsList -join ' ')"
Write-Output ""

if (-not $Execute) {
  Write-Output "Dry run only. Re-run with -Execute after confirming the target harness and write scope."
  exit 0
}

Push-Location $projectRoot
try {
  & $takomi @argsList
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
