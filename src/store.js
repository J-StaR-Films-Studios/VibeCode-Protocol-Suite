import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import pc from 'picocolors';
import { PATHS } from './utils.js';
import { CORE_SKILLS } from './skills-catalog.js';

// ─── Global Store Path ───────────────────────────────────────────────────────
const HOME = os.homedir();
export const STORE_PATH = process.env.TAKOMI_STORE_PATH || process.env.TAKOMI_HOME_DIR || path.join(HOME, '.takomi');
export const MANIFEST_PATH = path.join(STORE_PATH, 'manifest.json');

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

async function hashDirectory(dir) {
    if (!await fs.pathExists(dir)) return null;
    const rootStat = await fs.stat(dir);
    if (rootStat.isFile()) return sha256(await fs.readFile(dir));
    const entries = [];
    async function walk(current, prefix = '') {
        const names = (await fs.readdir(current)).sort();
        for (const name of names) {
            const full = path.join(current, name);
            const rel = path.join(prefix, name).replace(/\\/g, '/');
            const stat = await fs.stat(full);
            if (stat.isDirectory()) {
                entries.push(`dir:${rel}`);
                await walk(full, rel);
            } else {
                entries.push(`file:${rel}:${sha256(await fs.readFile(full))}`);
            }
        }
    }
    await walk(dir);
    return sha256(entries.join('\n'));
}

function normalizeOwnedMap(value) {
    if (!value || typeof value !== 'object') return {};
    const normalized = {};
    for (const [name, entry] of Object.entries(value)) {
        if (typeof entry === 'string') normalized[name] = { hash: entry };
        else if (entry?.hash) normalized[name] = entry;
    }
    return normalized;
}

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
        bundledOwned: {
            skills: {},
            workflows: {},
        },
        harnessOwned: {},
    };
}

function normalizeManifest(manifest) {
    const normalized = { ...createDefaultManifest(), ...(manifest || {}) };
    normalized.installed = { ...createDefaultManifest().installed, ...(manifest?.installed || {}) };
    normalized.bundledOwned = {
        skills: normalizeOwnedMap(manifest?.bundledOwned?.skills),
        workflows: normalizeOwnedMap(manifest?.bundledOwned?.workflows),
    };
    normalized.harnessOwned = manifest?.harnessOwned || {};
    return normalized;
}

// ─── Store Structure ─────────────────────────────────────────────────────────

/**
 * Creates the global store directory structure at ~/.takomi/
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
 * Reads the manifest from disk.
 * @returns {Promise<object>}
 */
export async function getManifest() {
    try {
        if (await fs.pathExists(MANIFEST_PATH)) {
            return normalizeManifest(await fs.readJson(MANIFEST_PATH));
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
    const nextManifest = normalizeManifest(manifest);
    nextManifest.updatedAt = new Date().toISOString();
    await fs.ensureDir(STORE_PATH);
    await fs.writeJson(MANIFEST_PATH, nextManifest, { spaces: 2 });
}

// ─── Populate Store from Package Assets ──────────────────────────────────────

async function listAllBundledSkillNames() {
    const entries = await fs.readdir(PATHS.skills);
    const skills = [];
    for (const entry of entries) {
        const stat = await fs.stat(path.join(PATHS.skills, entry));
        if (stat.isDirectory()) skills.push(entry);
    }
    return skills.sort();
}

const CORE_WORKFLOWS = [
    'vibe-genesis.md', 'vibe-design.md', 'vibe-build.md',
    'vibe-continueBuild.md', 'vibe-finalize.md', 'vibe-spawnTask.md',
    'vibe-primeAgent.md', 'vibe-syncDocs.md', 'stitch.md',
    'mode-orchestrator.md', 'mode-architect.md', 'mode-code.md',
    'mode-debug.md', 'mode-ask.md', 'mode-review.md', 'mode-visionary.md',
];

function resolveSkillSelection(mode) {
    if (mode === 'core') return [...CORE_SKILLS];
    if (Array.isArray(mode)) return [...mode];
    return null;
}

async function resolveWorkflowSelection(mode) {
    if (mode === 'core') return [...CORE_WORKFLOWS];
    if (mode === 'all' || mode === 'no-legacy') {
        const entries = await fs.readdir(PATHS.workflows);
        return entries.filter(f => {
            if (!f.endsWith('.md')) return false;
            if (mode === 'no-legacy' && f.startsWith('LEGACY')) return false;
            return true;
        });
    }
    if (Array.isArray(mode)) return [...mode];
    return [];
}

export async function resolveStoreSkillSelection(mode) {
    if (mode === 'all') return await listAllBundledSkillNames();
    return resolveSkillSelection(mode) || [];
}

export async function buildStoreSkillsReconcilePlan(mode) {
    const manifest = await getManifest();
    const selected = new Set(await resolveStoreSkillSelection(mode));
    const owned = normalizeOwnedMap(manifest.bundledOwned?.skills);
    return {
        owned: Object.keys(owned).sort(),
        selected: [...selected].sort(),
        toRemove: Object.keys(owned).filter((skill) => !selected.has(skill)).sort(),
    };
}

export async function buildStoreWorkflowsReconcilePlan(mode) {
    const manifest = await getManifest();
    const selected = new Set(await resolveWorkflowSelection(mode));
    const owned = normalizeOwnedMap(manifest.bundledOwned?.workflows);
    return {
        owned: Object.keys(owned).sort(),
        selected: [...selected].sort(),
        toRemove: Object.keys(owned).filter((workflow) => !selected.has(workflow)).sort(),
    };
}

/**
 * Copies skills from the bundled package assets into the global store.
 * Prunes only skills previously recorded as Takomi-bundled owned.
 * @param {'core'|'all'|string[]} mode - Which skills to install
 * @returns {Promise<string[]>} - List of skill names copied
 */
export async function populateSkills(mode) {
    const storeSkills = path.join(STORE_PATH, 'skills');
    await fs.ensureDir(storeSkills);

    let skillsToCopy = await resolveStoreSkillSelection(mode);
    skillsToCopy = [...new Set(skillsToCopy)].sort();
    const selected = new Set(skillsToCopy);

    const manifest = await getManifest();
    const previousOwned = normalizeOwnedMap(manifest.bundledOwned?.skills);
    const nextOwned = {};
    const copied = [];
    const pruned = [];
    const preservedManual = [];
    const preservedModified = [];

    for (const [skill, ownedEntry] of Object.entries(previousOwned)) {
        if (selected.has(skill)) continue;
        const dest = path.join(storeSkills, skill);
        if (!await fs.pathExists(dest)) continue;
        const currentHash = await hashDirectory(dest);
        if (currentHash && currentHash === ownedEntry.hash) {
            await fs.remove(dest);
            pruned.push(skill);
        } else {
            preservedModified.push(skill);
            nextOwned[skill] = ownedEntry;
        }
    }

    for (const skill of skillsToCopy) {
        const src = path.join(PATHS.skills, skill);
        const dest = path.join(storeSkills, skill);
        try {
            if (!await fs.pathExists(src)) continue;

            if (await fs.pathExists(dest)) {
                const currentHash = await hashDirectory(dest);
                const previous = previousOwned[skill];
                if (!previous) {
                    preservedManual.push(skill);
                    continue;
                }
                if (previous.hash && currentHash && currentHash !== previous.hash) {
                    preservedModified.push(skill);
                    nextOwned[skill] = previous;
                    continue;
                }
                await fs.remove(dest);
            }

            await fs.copy(src, dest, { overwrite: true });
            nextOwned[skill] = {
                hash: await hashDirectory(dest),
                targetPath: dest,
                installedAt: new Date().toISOString(),
            };
            copied.push(skill);
        } catch (error) {
            console.log(pc.yellow(`  ⚠ Could not copy skill "${skill}": ${error.message}`));
        }
    }

    manifest.bundledOwned.skills = Object.fromEntries(Object.entries(nextOwned).sort(([a], [b]) => a.localeCompare(b)));
    manifest.lastSkillPopulate = { mode: Array.isArray(mode) ? 'custom' : mode, copied, pruned, preservedManual, preservedModified };
    await writeManifest(manifest);

    if (pruned.length) console.log(pc.dim(`  Removed ${pruned.length} deselected Takomi-owned store skill${pruned.length === 1 ? '' : 's'}`));
    if (preservedManual.length) console.log(pc.yellow(`  Preserved manual store skill name collisions: ${preservedManual.join(', ')}`));
    if (preservedModified.length) console.log(pc.yellow(`  Preserved modified Takomi-owned store skills: ${preservedModified.join(', ')}`));

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

    const workflowsToCopy = [...new Set(await resolveWorkflowSelection(mode))].sort();
    const selected = new Set(workflowsToCopy);
    const manifest = await getManifest();
    const previousOwned = normalizeOwnedMap(manifest.bundledOwned?.workflows);
    const nextOwned = {};
    const copied = [];
    const pruned = [];
    const preservedManual = [];
    const preservedModified = [];

    for (const [workflow, ownedEntry] of Object.entries(previousOwned)) {
        if (selected.has(workflow)) continue;
        const dest = path.join(storeWorkflows, workflow);
        if (!await fs.pathExists(dest)) continue;
        const currentHash = await hashDirectory(dest);
        if (currentHash && currentHash === ownedEntry.hash) {
            await fs.remove(dest);
            pruned.push(workflow);
        } else {
            preservedModified.push(workflow);
            nextOwned[workflow] = ownedEntry;
        }
    }

    for (const workflow of workflowsToCopy) {
        const src = path.join(PATHS.workflows, workflow);
        const dest = path.join(storeWorkflows, workflow);
        try {
            if (!await fs.pathExists(src)) continue;

            if (await fs.pathExists(dest)) {
                const currentHash = await hashDirectory(dest);
                const previous = previousOwned[workflow];
                if (!previous) {
                    preservedManual.push(workflow);
                    continue;
                }
                if (previous.hash && currentHash && currentHash !== previous.hash) {
                    preservedModified.push(workflow);
                    nextOwned[workflow] = previous;
                    continue;
                }
                await fs.remove(dest);
            }

            await fs.copy(src, dest, { overwrite: true });
            nextOwned[workflow] = {
                hash: await hashDirectory(dest),
                targetPath: dest,
                installedAt: new Date().toISOString(),
            };
            copied.push(workflow);
        } catch (error) {
            console.log(pc.yellow(`  ⚠ Could not copy workflow "${workflow}": ${error.message}`));
        }
    }

    manifest.bundledOwned.workflows = Object.fromEntries(Object.entries(nextOwned).sort(([a], [b]) => a.localeCompare(b)));
    manifest.lastWorkflowPopulate = { mode: Array.isArray(mode) ? 'custom' : mode, copied, pruned, preservedManual, preservedModified };
    await writeManifest(manifest);

    if (pruned.length) console.log(pc.dim(`  Removed ${pruned.length} deselected Takomi-owned store workflow${pruned.length === 1 ? '' : 's'}`));
    if (preservedManual.length) console.log(pc.yellow(`  Preserved manual store workflow name collisions: ${preservedManual.join(', ')}`));
    if (preservedModified.length) console.log(pc.yellow(`  Preserved modified Takomi-owned store workflows: ${preservedModified.join(', ')}`));

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
