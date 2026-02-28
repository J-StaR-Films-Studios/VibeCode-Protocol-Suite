import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import pc from 'picocolors';
import { PATHS } from './utils.js';

// ─── Global Store Path ───────────────────────────────────────────────────────
const HOME = os.homedir();
export const STORE_PATH = path.join(HOME, '.vibesuite');
export const MANIFEST_PATH = path.join(STORE_PATH, 'manifest.json');

// ─── Store Structure ─────────────────────────────────────────────────────────

/**
 * Creates the global store directory structure at ~/.vibesuite/
 * Idempotent — safe to call multiple times.
 * @returns {Promise<void>}
 */
export async function initGlobalStore() {
    await fs.ensureDir(path.join(STORE_PATH, 'skills'));
    await fs.ensureDir(path.join(STORE_PATH, 'workflows'));
    await fs.ensureDir(path.join(STORE_PATH, 'agents'));

    // Create manifest if it doesn't exist
    if (!await fs.pathExists(MANIFEST_PATH)) {
        const manifest = createDefaultManifest();
        await writeManifest(manifest);
    }
}

// ─── Manifest ────────────────────────────────────────────────────────────────

/**
 * Default manifest structure
 */
function createDefaultManifest() {
    return {
        version: '2.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        linkedHarnesses: [],
        installed: {
            skills: [],
            workflows: [],
            agents: [],
        },
    };
}

/**
 * Reads the manifest from disk.
 * @returns {Promise<object>}
 */
export async function getManifest() {
    try {
        if (await fs.pathExists(MANIFEST_PATH)) {
            return await fs.readJson(MANIFEST_PATH);
        }
    } catch {
        // Corrupted manifest — recreate
    }
    return createDefaultManifest();
}

/**
 * Writes the manifest to disk.
 * @param {object} manifest
 * @returns {Promise<void>}
 */
export async function writeManifest(manifest) {
    manifest.updatedAt = new Date().toISOString();
    await fs.writeJson(MANIFEST_PATH, manifest, { spaces: 2 });
}

// ─── Populate Store from Package Assets ──────────────────────────────────────

/**
 * Copies skills from the bundled package assets into the global store.
 * @param {'core'|'all'|string[]} mode - Which skills to install
 * @returns {Promise<string[]>} - List of skill names copied
 */
export async function populateSkills(mode) {
    const storeSkills = path.join(STORE_PATH, 'skills');
    await fs.ensureDir(storeSkills);

    const coreSkills = [
        'ai-sdk', 'code-review', 'component-analysis', 'context7',
        'nextjs-standards', 'security-audit', 'spawn-task', 'stitch',
    ];

    let skillsToCopy = [];

    if (mode === 'core') {
        skillsToCopy = coreSkills;
    } else if (mode === 'all') {
        // Read all skill directories from package assets
        const entries = await fs.readdir(PATHS.skills);
        for (const entry of entries) {
            const stat = await fs.stat(path.join(PATHS.skills, entry));
            if (stat.isDirectory()) {
                skillsToCopy.push(entry);
            }
        }
    } else if (Array.isArray(mode)) {
        skillsToCopy = mode;
    }

    const copied = [];
    for (const skill of skillsToCopy) {
        const src = path.join(PATHS.skills, skill);
        const dest = path.join(storeSkills, skill);
        try {
            if (await fs.pathExists(src)) {
                await fs.copy(src, dest, { overwrite: true });
                copied.push(skill);
            }
        } catch (error) {
            console.log(pc.yellow(`  ⚠ Could not copy skill "${skill}": ${error.message}`));
        }
    }

    return copied;
}

/**
 * Copies workflows from the bundled package assets into the global store.
 * @param {'core'|'all'|'no-legacy'|string[]} mode - Which workflows to install
 * @returns {Promise<string[]>} - List of workflow filenames copied
 */
export async function populateWorkflows(mode) {
    const storeWorkflows = path.join(STORE_PATH, 'workflows');
    await fs.ensureDir(storeWorkflows);

    const coreWorkflows = [
        'vibe-genesis.md', 'vibe-design.md', 'vibe-build.md',
        'vibe-continueBuild.md', 'vibe-finalize.md', 'vibe-spawnTask.md',
        'vibe-primeAgent.md', 'vibe-syncDocs.md', 'stitch.md',
        'mode-orchestrator.md', 'mode-architect.md', 'mode-code.md',
        'mode-debug.md', 'mode-ask.md', 'mode-review.md',
    ];

    let workflowsToCopy = [];

    if (mode === 'core') {
        workflowsToCopy = coreWorkflows;
    } else if (mode === 'all' || mode === 'no-legacy') {
        const entries = await fs.readdir(PATHS.workflows);
        workflowsToCopy = entries.filter(f => {
            if (!f.endsWith('.md')) return false;
            if (mode === 'no-legacy' && f.startsWith('LEGACY')) return false;
            return true;
        });
    } else if (Array.isArray(mode)) {
        workflowsToCopy = mode;
    }

    const copied = [];
    for (const workflow of workflowsToCopy) {
        const src = path.join(PATHS.workflows, workflow);
        const dest = path.join(storeWorkflows, workflow);
        try {
            if (await fs.pathExists(src)) {
                await fs.copy(src, dest, { overwrite: true });
                copied.push(workflow);
            }
        } catch (error) {
            console.log(pc.yellow(`  ⚠ Could not copy workflow "${workflow}": ${error.message}`));
        }
    }

    return copied;
}

/**
 * Copies agent YAMLs (custom_modes.yaml, etc.) into the global store.
 * @returns {Promise<string[]>} - List of YAML filenames copied
 */
export async function populateAgentYamls() {
    const storeAgents = path.join(STORE_PATH, 'agents');
    await fs.ensureDir(storeAgents);

    const copied = [];
    try {
        const entries = await fs.readdir(PATHS.agentsYaml);
        for (const entry of entries) {
            const src = path.join(PATHS.agentsYaml, entry);
            const dest = path.join(storeAgents, entry);
            await fs.copy(src, dest, { overwrite: true });
            copied.push(entry);
        }
    } catch (error) {
        console.log(pc.yellow(`  ⚠ Could not copy agent YAMLs: ${error.message}`));
    }

    return copied;
}

// ─── Store Queries ───────────────────────────────────────────────────────────

/**
 * Lists all skills currently in the global store.
 * @returns {Promise<string[]>}
 */
export async function getStoreSkills() {
    const skillsDir = path.join(STORE_PATH, 'skills');
    try {
        const entries = await fs.readdir(skillsDir);
        const skills = [];
        for (const entry of entries) {
            const stat = await fs.stat(path.join(skillsDir, entry));
            if (stat.isDirectory()) skills.push(entry);
        }
        return skills;
    } catch {
        return [];
    }
}

/**
 * Lists all workflows currently in the global store.
 * @returns {Promise<string[]>}
 */
export async function getStoreWorkflows() {
    const workflowsDir = path.join(STORE_PATH, 'workflows');
    try {
        const entries = await fs.readdir(workflowsDir);
        return entries.filter(f => f.endsWith('.md'));
    } catch {
        return [];
    }
}

/**
 * Checks if the global store has been initialized.
 * @returns {Promise<boolean>}
 */
export async function isStoreInitialized() {
    return fs.pathExists(MANIFEST_PATH);
}
