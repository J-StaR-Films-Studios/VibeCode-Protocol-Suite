# Takomi
Type: Cloned Repository
Source: https://github.com/JStaRFilms/VibeCode-Protocol-Suite.git
Date: 2025-12-02


$repo = "c:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite"
$pi = Join-Path $HOME ".pi"

New-Item -ItemType Directory -Force "$pi\agent\extensions" | Out-Null
New-Item -ItemType Directory -Force "$pi\agent\prompts" | Out-Null
New-Item -ItemType Directory -Force "$pi\agent\themes" | Out-Null
New-Item -ItemType Directory -Force "$pi\src" | Out-Null

New-Item -ItemType Junction -Path "$pi\agent\extensions\takomi-runtime" -Target "$repo\.pi\extensions\takomi-runtime"
New-Item -ItemType Junction -Path "$pi\agent\extensions\takomi-subagents" -Target "$repo\.pi\extensions\takomi-subagents"
New-Item -ItemType Junction -Path "$pi\agent\prompts\takomi-prompts" -Target "$repo\.pi\prompts"
New-Item -ItemType Junction -Path "$pi\agent\themes\takomi-noir.json" -Target "$repo\.pi\themes\takomi-noir.json"
New-Item -ItemType Junction -Path "$pi\src\pi-takomi-core" -Target "$repo\src\pi-takomi-core"

---

powershell -ExecutionPolicy Bypass -File .\scripts\sync-pi-global.ps1

.\scripts\sync-pi-global.ps1

Get-Process node,pi -ErrorAction SilentlyContinue | Stop-Process -Force
Rename-Item -Path "$env:USERPROFILE\.pi" -NewName ".pi.local"