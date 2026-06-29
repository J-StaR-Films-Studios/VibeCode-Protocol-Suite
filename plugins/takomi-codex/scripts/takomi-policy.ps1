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

function Read-TextSafe([string]$PathValue) {
  if (Test-Path -LiteralPath $PathValue -PathType Leaf) {
    return Get-Content -Raw -LiteralPath $PathValue
  }
  return $null
}

function Read-JsonSafe([string]$PathValue) {
  if (Test-Path -LiteralPath $PathValue -PathType Leaf) {
    try { return Get-Content -Raw -LiteralPath $PathValue | ConvertFrom-Json } catch { return $null }
  }
  return $null
}

function Get-PolicyFiles([string]$Dir) {
  if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { return @() }
  return Get-ChildItem -LiteralPath $Dir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in @(".md", ".json", ".txt") } |
    Sort-Object Name |
    ForEach-Object {
      [pscustomobject]@{
        name = $_.Name
        path = $_.FullName
        preview = ((Get-Content -Raw -LiteralPath $_.FullName) -split "\r?\n" | Select-Object -First 8) -join "`n"
      }
    }
}

$projectRoot = if ($Root) { $Root } else { Get-DefaultRoot }
$projectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
$homeDir = [Environment]::GetFolderPath("UserProfile")

$projectSettingsPath = Join-Path $projectRoot ".pi\settings.json"
$projectProfilePath = Join-Path $projectRoot ".pi\takomi-profile.json"
$projectRoutingPath = Join-Path $projectRoot ".pi\takomi\model-routing.md"
$projectPoliciesDir = Join-Path $projectRoot ".pi\takomi\policies"

$userRoutingPath = Join-Path $homeDir ".pi\agent\takomi\model-routing.md"
$userPoliciesDir = Join-Path $homeDir ".pi\agent\takomi\policies"

$result = [pscustomobject]@{
  projectRoot = $projectRoot
  project = [pscustomobject]@{
    settingsPath = $projectSettingsPath
    settings = Read-JsonSafe $projectSettingsPath
    profilePath = $projectProfilePath
    profile = Read-JsonSafe $projectProfilePath
    routingPath = $projectRoutingPath
    routing = Read-TextSafe $projectRoutingPath
    policies = Get-PolicyFiles $projectPoliciesDir
  }
  user = [pscustomobject]@{
    routingPath = $userRoutingPath
    routing = Read-TextSafe $userRoutingPath
    policies = Get-PolicyFiles $userPoliciesDir
  }
}

if ($Json) {
  $result | ConvertTo-Json -Depth 10
  exit 0
}

Write-Output "Takomi policy context"
Write-Output "Project: $projectRoot"
Write-Output ""
Write-Output "Project settings: $projectSettingsPath"
if ($result.project.settings) { $result.project.settings | ConvertTo-Json -Depth 6 } else { Write-Output "  missing or invalid" }
Write-Output ""
Write-Output "Project profile: $projectProfilePath"
if ($result.project.profile) { $result.project.profile | ConvertTo-Json -Depth 8 } else { Write-Output "  missing or invalid" }
Write-Output ""
Write-Output "Project model routing: $projectRoutingPath"
if ($result.project.routing) { Write-Output $result.project.routing } else { Write-Output "  missing" }
Write-Output ""
Write-Output "Project policy files:"
if ($result.project.policies.Count) {
  foreach ($policy in $result.project.policies) {
    Write-Output "  - $($policy.name): $($policy.path)"
  }
} else {
  Write-Output "  none"
}
Write-Output ""
Write-Output "User/global model routing: $userRoutingPath"
if ($result.user.routing) { Write-Output $result.user.routing } else { Write-Output "  missing" }
Write-Output ""
Write-Output "User/global policy files:"
if ($result.user.policies.Count) {
  foreach ($policy in $result.user.policies) {
    Write-Output "  - $($policy.name): $($policy.path)"
  }
} else {
  Write-Output "  none"
}
