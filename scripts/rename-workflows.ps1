# VibeCode Workflow Rename Script
# This script renames workflows to the new naming convention and updates all references

# Mode workflows: Add "mode-" prefix
$modeRenames = @{
    "architect.md" = "mode-architect.md"
    "ask.md" = "mode-ask.md"
    "code.md" = "mode-code.md"
    "debug.md" = "mode-debug.md"
    "orchestrator.md" = "mode-orchestrator.md"
    "review.md" = "mode-review.md"
}

# Project workflows: Rename to vibe- prefix with camelCase
$projectRenames = @{
    "init_vibecode_genesis_v3.md" = "vibe-genesis.md"
    "init_vibecode_design.md" = "vibe-design.md"
    "build_vibecode_project_v3.md" = "vibe-build.md"
    "continue_build.md" = "vibe-continueBuild.md"
    "finalize_build.md" = "vibe-finalize.md"
    "spawn_task.md" = "vibe-spawnTask.md"
    "prime_agent.md" = "vibe-primeAgent.md"
    "sync_docs.md" = "vibe-syncDocs.md"
}

$workflowDir = "assets/.agent/workflows"

Write-Host "=== VibeCode Workflow Rename Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Rename mode workflows
Write-Host "Step 1: Renaming mode workflows..." -ForegroundColor Yellow
foreach ($oldName in $modeRenames.Keys) {
    $newName = $modeRenames[$oldName]
    $oldPath = Join-Path $workflowDir $oldName
    $newPath = Join-Path $workflowDir $newName
    
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName $newName
        Write-Host "  Renamed $oldName -> $newName"
    } else {
        Write-Host "  File not found: $oldName"
    }
}

# Step 2: Rename project workflows
Write-Host ""
Write-Host "Step 2: Renaming project workflows..." -ForegroundColor Yellow
foreach ($oldName in $projectRenames.Keys) {
    $newName = $projectRenames[$oldName]
    $oldPath = Join-Path $workflowDir $oldName
    $newPath = Join-Path $workflowDir $newName
    
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName $newName
        Write-Host "  Renamed $oldName -> $newName"
    } else {
        Write-Host "  File not found: $oldName"
    }
}

# Step 3: Update references in all workflow files
Write-Host ""
Write-Host "Step 3: Updating references in workflow files..." -ForegroundColor Yellow

# Build replacement map for content updates
$replacements = @{
    # Mode workflows
    "/architect" = "/mode-architect"
    "/ask" = "/mode-ask"
    "/code" = "/mode-code"
    "/debug" = "/mode-debug"
    "/orchestrator" = "/mode-orchestrator"
    "/review" = "/mode-review"
    
    # Project workflows
    "/init_vibecode_genesis_v3" = "/vibe-genesis"
    "/init_vibecode_design" = "/vibe-design"
    "/build_vibecode_project_v3" = "/vibe-build"
    "/continue_build" = "/vibe-continueBuild"
    "/finalize_build" = "/vibe-finalize"
    "/spawn_task" = "/vibe-spawnTask"
    "/prime_agent" = "/vibe-primeAgent"
    "/sync_docs" = "/vibe-syncDocs"
}

# Get all markdown files in workflows directory
$workflowFiles = Get-ChildItem -Path $workflowDir -Filter "*.md"

foreach ($file in $workflowFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    $updated = $false
    
    foreach ($oldRef in $replacements.Keys) {
        $newRef = $replacements[$oldRef]
        if ($content -match [regex]::Escape($oldRef)) {
            $content = $content -replace [regex]::Escape($oldRef), $newRef
            $updated = $true
        }
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content
        Write-Host "  Updated references in $($file.Name)"
    }
}

# Step 4: Update references in skills
Write-Host ""
Write-Host "Step 4: Checking skills for workflow references..." -ForegroundColor Yellow
$skillsDir = "assets/.agent/skills"
if (Test-Path $skillsDir) {
    $skillFiles = Get-ChildItem -Path $skillsDir -Recurse -Filter "*.md"
    foreach ($file in $skillFiles) {
        $content = Get-Content -Path $file.FullName -Raw
        $originalContent = $content
        $updated = $false
        
        foreach ($oldRef in $replacements.Keys) {
            $newRef = $replacements[$oldRef]
            if ($content -match [regex]::Escape($oldRef)) {
                $content = $content -replace [regex]::Escape($oldRef), $newRef
                $updated = $true
            }
        }
        
        if ($updated) {
            Set-Content -Path $file.FullName -Value $content
            Write-Host "  Updated references in $($file.FullName)"
        }
    }
}

Write-Host ""
Write-Host "=== Rename Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary of changes:"
Write-Host "  - Mode workflows now use 'mode-' prefix"
Write-Host "  - Project workflows now use 'vibe-' prefix with camelCase"
Write-Host "  - All internal references have been updated"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review the changes in git"
Write-Host "  2. Test the new workflow names"
Write-Host "  3. Update any external documentation"
