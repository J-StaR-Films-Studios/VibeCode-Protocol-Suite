param(
  [ValidateSet("status", "doctor", "launch", "takomi", "pi")]
  [string]$Action = "status",
  [string]$Root,
  [string]$ArgsLine = "",
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

function Get-DefaultRoot {
  $pluginRoot = Split-Path -Parent $PSScriptRoot
  $pluginsRoot = Split-Path -Parent $pluginRoot
  return Split-Path -Parent $pluginsRoot
}

function Get-Tool([string]$Name) {
  return Get-Command $Name -ErrorAction SilentlyContinue
}

function Split-ArgsLine([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
  return [System.Management.Automation.PSParser]::Tokenize($Text, [ref]$null) |
    Where-Object { $_.Type -in @("CommandArgument", "String", "Number") } |
    ForEach-Object { $_.Content }
}

$projectRoot = if ($Root) { $Root } else { Get-DefaultRoot }
$projectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
$takomi = Get-Tool "takomi"
$pi = Get-Tool "pi"

Write-Output "Takomi Pi dispatch"
Write-Output "Project: $projectRoot"
Write-Output "Mode:    $(if ($Execute) { "execute" } else { "dry-run" })"
Write-Output ""

if (-not $takomi) { Write-Output "takomi CLI: missing" } else { Write-Output "takomi CLI: $($takomi.Source)" }
if (-not $pi) { Write-Output "pi CLI:     missing" } else { Write-Output "pi CLI:     $($pi.Source)" }
Write-Output ""

if ($Action -eq "status") {
  Write-Output "Recommended diagnostics:"
  Write-Output "  .\takomi-detect.ps1 -Root `"$projectRoot`""
  Write-Output "  .\takomi-policy.ps1 -Root `"$projectRoot`""
  Write-Output "  takomi doctor"
  exit 0
}

$command = $null
$commandArgs = @()

switch ($Action) {
  "doctor" {
    if (-not $takomi) { throw "takomi CLI is not available." }
    $command = $takomi.Source
    $commandArgs = @("doctor")
  }
  "launch" {
    if (-not $takomi) { throw "takomi CLI is not available." }
    $command = $takomi.Source
    $commandArgs = @()
  }
  "takomi" {
    if (-not $takomi) { throw "takomi CLI is not available." }
    $command = $takomi.Source
    $commandArgs = Split-ArgsLine $ArgsLine
  }
  "pi" {
    if (-not $pi) { throw "pi CLI is not available." }
    $command = $pi.Source
    $commandArgs = Split-ArgsLine $ArgsLine
  }
}

if (-not $command) { throw "No command resolved for action '$Action'." }

Write-Output "Resolved command:"
Write-Output "  $command $($commandArgs -join ' ')"
Write-Output ""

if (-not $Execute) {
  Write-Output "Dry run only. Re-run with -Execute to execute this command."
  exit 0
}

Push-Location $projectRoot
try {
  & $command @commandArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
