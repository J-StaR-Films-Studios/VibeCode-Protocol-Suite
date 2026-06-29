param(
  [string]$Root,
  [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-DefaultRoot {
  $pluginRoot = Split-Path -Parent $PSScriptRoot
  $pluginsRoot = Split-Path -Parent $pluginRoot
  return Split-Path -Parent $pluginsRoot
}

function Resolve-PathSafe([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return $null }
  try { return (Resolve-Path -LiteralPath $PathValue -ErrorAction Stop).Path } catch { return $PathValue }
}

function Test-File([string]$PathValue) {
  return [bool](Test-Path -LiteralPath $PathValue -PathType Leaf)
}

function Test-Dir([string]$PathValue) {
  return [bool](Test-Path -LiteralPath $PathValue -PathType Container)
}

function Get-CommandInfo([string]$Name, [string[]]$VersionArgs) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    return [pscustomobject]@{ available = $false; path = $null; version = $null }
  }

  $version = $null
  foreach ($args in $VersionArgs) {
    try {
      $parts = $args -split " "
      $output = & $cmd.Source @parts 2>$null | Select-Object -First 1
      if ($output) {
        $version = [string]$output
        break
      }
    } catch { }
  }

  return [pscustomobject]@{
    available = $true
    path = $cmd.Source
    version = $version
  }
}

$projectRoot = Resolve-PathSafe ($(if ($Root) { $Root } else { Get-DefaultRoot }))
$homeDir = [Environment]::GetFolderPath("UserProfile")
$pluginRoot = Split-Path -Parent $PSScriptRoot

$projectPi = Join-Path $projectRoot ".pi"
$projectAgents = Join-Path $projectPi "agents"
$projectPrompts = Join-Path $projectPi "prompts"
$projectPolicies = Join-Path $projectPi "takomi\policies"
$projectSettings = Join-Path $projectPi "settings.json"
$projectProfile = Join-Path $projectPi "takomi-profile.json"
$projectRouting = Join-Path $projectPi "takomi\model-routing.md"
$roadbooks = Join-Path $projectRoot "docs\tasks\orchestrator-sessions"

$userPiAgent = Join-Path $homeDir ".pi\agent"
$userAgentsSkills = Join-Path $homeDir ".agents\skills"

$result = [pscustomobject]@{
  projectRoot = $projectRoot
  pluginRoot = $pluginRoot
  project = [pscustomobject]@{
    pi = Test-Dir $projectPi
    settings = Test-File $projectSettings
    profile = Test-File $projectProfile
    routingPolicy = Test-File $projectRouting
    policies = Test-Dir $projectPolicies
    agents = Test-Dir $projectAgents
    prompts = Test-Dir $projectPrompts
    roadbooks = Test-Dir $roadbooks
  }
  user = [pscustomobject]@{
    piAgent = Test-Dir $userPiAgent
    agentsSkills = Test-Dir $userAgentsSkills
  }
  cli = [pscustomobject]@{
    takomi = Get-CommandInfo "takomi" @("--version", "version")
    pi = Get-CommandInfo "pi" @("--version", "version")
  }
  paths = [pscustomobject]@{
    projectPi = $projectPi
    projectSettings = $projectSettings
    projectProfile = $projectProfile
    projectRouting = $projectRouting
    projectPolicies = $projectPolicies
    roadbooks = $roadbooks
    userPiAgent = $userPiAgent
    userAgentsSkills = $userAgentsSkills
  }
}

if ($Json) {
  $result | ConvertTo-Json -Depth 8
  exit 0
}

Write-Output "Takomi Codex detection"
Write-Output "Project: $($result.projectRoot)"
Write-Output "Plugin:  $($result.pluginRoot)"
Write-Output ""
Write-Output "Project runtime:"
Write-Output "  .pi:             $($result.project.pi)"
Write-Output "  settings:        $($result.project.settings)"
Write-Output "  profile:         $($result.project.profile)"
Write-Output "  routing policy:  $($result.project.routingPolicy)"
Write-Output "  policies:        $($result.project.policies)"
Write-Output "  agents/prompts:  $($result.project.agents) / $($result.project.prompts)"
Write-Output "  roadbooks:       $($result.project.roadbooks)"
Write-Output ""
Write-Output "User runtime:"
Write-Output "  ~/.pi/agent:     $($result.user.piAgent)"
Write-Output "  ~/.agents/skills:$($result.user.agentsSkills)"
Write-Output ""
Write-Output "CLI:"
Write-Output "  takomi:          $($result.cli.takomi.available) $($result.cli.takomi.version)"
Write-Output "  pi:              $($result.cli.pi.available) $($result.cli.pi.version)"
