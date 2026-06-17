import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import pc from 'picocolors';
import { hashPath, normalizeOwnedMap, copyOwnedTree } from './owned-tree.js';

// ─── Cross-Platform Home Directory ───────────────────────────────────────────
const HOME = os.homedir();
const IS_WINDOWS = process.platform === 'win32';

/**
 * Resolve %APPDATA% on Windows, fallback for Mac/Linux
 */
function getAppData() {
  if (IS_WINDOWS) {
    return process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
  }
  // Mac: ~/Library/Application Support, Linux: ~/.config
  return process.env.XDG_CONFIG_HOME || path.join(HOME, '.config');
}

// ─── Harness Registry ────────────────────────────────────────────────────────

/**
 * Each harness adapter defines:
 * - name:     Human-readable name
 * - detect:   Function returning true if the harness is installed
 * - rootPath: Root config directory of the harness
 * - targets:  Where to copy skills, workflows, and yamls
 *   - skills:    Path to global skills directory (or null if unsupported)
 *   - workflows: Path to global workflows directory (or null if unsupported)
 *   - yamls:     Array of paths for custom_modes.yaml (or null)
 */
export const HARNESS_MAP = {
  antigravity: {
    name: 'Antigravity',
    rootPath: path.join(HOME, '.gemini', 'antigravity'),
    detect() {
      return fs.existsSync(this.rootPath);
    },
    targets: {
      skills: path.join(HOME, '.gemini', 'antigravity', 'skills'),
      workflows: path.join(HOME, '.gemini', 'antigravity', 'global_workflows'),
      yamls: null,
    },
  },

  kilocode: {
    name: 'KiloCode',
    rootPath: path.join(HOME, '.kilocode'),
    detect() {
      return fs.existsSync(this.rootPath);
    },
    targets: {
      skills: path.join(HOME, '.kilocode', 'skills'),
      workflows: path.join(HOME, '.kilocode', 'workflows'),
      yamls: [
        path.join(HOME, '.kilocode', 'cli', 'global', 'settings', 'custom_modes.yaml'),
        path.join(getAppData(), 'Antigravity', 'User', 'globalStorage', 'kilocode.kilo-code', 'settings', 'custom_modes.yaml'),
      ],
    },
  },

  windsurf: {
    name: 'Windsurf',
    rootPath: path.join(HOME, '.codeium', 'windsurf'),
    detect() {
      return fs.existsSync(this.rootPath);
    },
    targets: {
      skills: path.join(HOME, '.codeium', 'windsurf', 'skills'),
      workflows: path.join(HOME, '.codeium', 'windsurf', 'global_workflows'),
      yamls: null,
    },
  },

  codex: {
    name: 'Codex',
    rootPath: path.join(HOME, '.codex'),
    detect() {
      return fs.existsSync(this.rootPath);
    },
    targets: {
      skills: path.join(HOME, '.agents', 'skills'),
      workflows: null,
      yamls: null,
    },
  },

  cursor: {
    name: 'Cursor',
    rootPath: path.join(HOME, '.cursor'),
    detect() {
      return fs.existsSync(this.rootPath);
    },
    targets: {
      skills: path.join(HOME, '.cursor', 'skills'),
      workflows: null, // Cursor uses rules, not workflows
      yamls: null,
    },
  },

  gemini_cli: {
    name: 'Gemini CLI',
    rootPath: path.join(HOME, '.gemini'),
    detect() {
      // Only match bare Gemini CLI — not Antigravity (which also lives under .gemini)
      return fs.existsSync(this.rootPath) && !fs.existsSync(path.join(HOME, '.gemini', 'antigravity'));
    },
    targets: {
      skills: path.join(HOME, '.agents', 'skills'),
      workflows: null,
      yamls: null,
    },
  },
};

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Scans the filesystem and returns an array of detected harness objects.
 * Each object includes { id, name, rootPath, targets }.
 * @returns {Array<{id: string, name: string, rootPath: string, targets: object}>}
 */
export function detectHarnesses() {
  const detected = [];

  for (const [id, harness] of Object.entries(HARNESS_MAP)) {
    if (harness.detect()) {
      detected.push({
        id,
        name: harness.name,
        rootPath: harness.rootPath,
        targets: harness.targets,
      });
    }
  }

  return detected;
}

/**
 * Pretty-prints harness detection results.
 * @param {Array} detected - Array from detectHarnesses()
 */
export function printHarnessStatus(detected) {
  const detectedIds = new Set(detected.map(h => h.id));

  console.log(pc.cyan('\n📡 Detecting AI harnesses...\n'));

  for (const [id, harness] of Object.entries(HARNESS_MAP)) {
    if (detectedIds.has(id)) {
      console.log(pc.green(`  ✔ ${harness.name.padEnd(16)} ${pc.dim(harness.rootPath)}`));
    } else {
      console.log(pc.dim(`  ✗ ${harness.name.padEnd(16)} (not found)`));
    }
  }

  console.log('');
}

// ─── Sync Operations ─────────────────────────────────────────────────────────

/**
 * Syncs a source directory to a harness target path.
 * Uses hard copy (fs.copy) — no symlinks.
 *
 * @param {string} sourcePath  - Source directory (e.g., ~/.takomi/skills/)
 * @param {string} targetPath  - Destination directory (e.g., ~/.gemini/antigravity/skills/)
 * @param {string} label       - Human-readable label for logging
 * @returns {Promise<number>}  - Number of items copied
 */
/**
 * Syncs a directory to a target path. When ownership is supplied, it also
 * prunes previous Takomi-owned items that are no longer in the source while
 * preserving manual or modified files.
 */
export async function syncDirectory(sourcePath, targetPath, label = '', options = {}) {
  if (!targetPath) return options.returnDetails ? { copied: 0, pruned: 0, preservedManual: [], preservedModified: [], owned: {} } : 0;

  try {
    await fs.ensureDir(targetPath);

    const items = (await fs.readdir(sourcePath)).sort();
    const itemSet = new Set(items);
    const previousOwned = normalizeOwnedMap(options.owned);
    const nextOwned = {};
    const preservedManual = [];
    const preservedModified = [];
    let copied = 0;
    let pruned = 0;

    if (options.prune && Object.keys(previousOwned).length > 0) {
      for (const [item, ownedEntry] of Object.entries(previousOwned)) {
        if (itemSet.has(item)) continue;
        const dest = path.join(targetPath, item);
        if (!await fs.pathExists(dest)) continue;
        const currentHash = await hashPath(dest);
        if (currentHash && currentHash === ownedEntry.hash) {
          await fs.remove(dest);
          pruned++;
        } else {
          preservedModified.push(item);
          nextOwned[item] = ownedEntry;
        }
      }
    }

    for (const item of items) {
      const src = path.join(sourcePath, item);
      const dest = path.join(targetPath, item);
      const previous = previousOwned[item];

      if (await fs.pathExists(dest)) {
        const currentHash = await hashPath(dest);
        if (options.preserveManual && !previous) {
          preservedManual.push(item);
          continue;
        }
        if (previous?.hash && currentHash && currentHash !== previous.hash) {
          preservedModified.push(item);
          nextOwned[item] = previous;
          continue;
        }
        await fs.remove(dest);
      }

      await copyOwnedTree(src, dest);
      nextOwned[item] = {
        hash: await hashPath(dest),
        targetPath: dest,
        syncedAt: new Date().toISOString(),
      };
      copied++;
    }

    if (label) {
      const suffix = pruned ? `, removed ${pruned}` : '';
      console.log(pc.green(`  ✔ ${label} (${copied} items${suffix})`));
      if (preservedManual.length) console.log(pc.yellow(`    Preserved manual items: ${preservedManual.join(', ')}`));
      if (preservedModified.length) console.log(pc.yellow(`    Preserved modified Takomi-owned items: ${preservedModified.join(', ')}`));
    }

    const details = { copied, pruned, preservedManual, preservedModified, owned: Object.fromEntries(Object.entries(nextOwned).sort(([a], [b]) => a.localeCompare(b))) };
    return options.returnDetails ? details : copied;
  } catch (error) {
    if (label) {
      console.log(pc.red(`  ✗ ${label}: ${error.message}`));
    }
    return options.returnDetails ? { copied: 0, pruned: 0, preservedManual: [], preservedModified: [], owned: normalizeOwnedMap(options.owned), ok: false, error: error.message } : 0;
  }
}

/**
 * Syncs a single file to one or more target paths.
 * Used for custom_modes.yaml → KiloCode dual-path sync.
 *
 * @param {string}          sourceFile   - Source file path
 * @param {string|string[]} targetPaths  - One or more destination file paths
 * @param {string}          label        - Human-readable label for logging
 * @returns {Promise<number>}            - Number of successful copies
 */
export async function syncFile(sourceFile, targetPaths, label = '') {
  if (!targetPaths) return 0;

  const paths = Array.isArray(targetPaths) ? targetPaths : [targetPaths];
  let count = 0;

  for (const targetPath of paths) {
    try {
      await fs.ensureDir(path.dirname(targetPath));
      await fs.copy(sourceFile, targetPath, { overwrite: true });
      count++;
    } catch (error) {
      console.log(pc.yellow(`  ⚠ Could not sync to ${path.basename(path.dirname(targetPath))}: ${error.message}`));
    }
  }

  if (label && count > 0) {
    console.log(pc.green(`  ✔ ${label} (${count} path${count > 1 ? 's' : ''})`));
  }

  return count;
}

/**
 * Syncs skills, workflows, and yamls from the global store to a single harness.
 *
 * @param {{id: string, name: string, targets: object}} harness  - Harness config
 * @param {string} storePath - Path to the global store (~/.takomi/)
 * @returns {Promise<{skills: number, workflows: number, yamls: number}>}
 */
export async function syncToHarness(harness, storePath, options = {}) {
  const harnessOwned = options.owned?.[harness.id] || {};
  const results = { skills: 0, workflows: 0, yamls: 0, owned: { skills: normalizeOwnedMap(harnessOwned.skills), workflows: normalizeOwnedMap(harnessOwned.workflows) }, ok: true, errors: [] };
  const useOwnership = Boolean(options.useOwnership);

  console.log(pc.cyan(`\n  📡 Syncing to ${harness.name}...`));

  // Skills
  const skillsStore = path.join(storePath, 'skills');
  if (harness.targets.skills && await fs.pathExists(skillsStore)) {
    const skillResult = await syncDirectory(
      skillsStore,
      harness.targets.skills,
      `Skills → ${harness.name}`,
      {
        owned: harnessOwned.skills,
        preserveManual: useOwnership,
        prune: useOwnership,
        returnDetails: useOwnership,
      },
    );
    if (useOwnership) {
      results.skills = skillResult.copied;
      results.owned.skills = skillResult.owned;
      if (skillResult.ok === false) {
        results.ok = false;
        results.errors.push(skillResult.error);
      }
    } else {
      results.skills = skillResult;
    }
  }

  // Workflows
  const workflowsStore = path.join(storePath, 'workflows');
  if (harness.targets.workflows && await fs.pathExists(workflowsStore)) {
    const workflowResult = await syncDirectory(
      workflowsStore,
      harness.targets.workflows,
      `Workflows → ${harness.name}`,
      {
        owned: harnessOwned.workflows,
        preserveManual: useOwnership,
        prune: useOwnership,
        returnDetails: useOwnership,
      },
    );
    if (useOwnership) {
      results.workflows = workflowResult.copied;
      results.owned.workflows = workflowResult.owned;
      if (workflowResult.ok === false) {
        results.ok = false;
        results.errors.push(workflowResult.error);
      }
    } else {
      results.workflows = workflowResult;
    }
  }

  // YAMLs (KiloCode custom_modes.yaml dual-path)
  const yamlSource = path.join(storePath, 'agents', 'custom_modes.yaml');
  if (harness.targets.yamls && await fs.pathExists(yamlSource)) {
    results.yamls = await syncFile(
      yamlSource,
      harness.targets.yamls,
      `custom_modes.yaml → ${harness.name}`
    );
  }

  return results;
}

/**
 * Syncs from the global store to ALL specified harnesses.
 *
 * @param {Array} harnesses - Array of harness configs from detectHarnesses()
 * @param {string} storePath - Path to the global store (~/.takomi/)
 * @returns {Promise<object>} - Summary of sync results
 */
export async function syncToAllHarnesses(harnesses, storePath, options = {}) {
  const summary = {};

  for (const harness of harnesses) {
    summary[harness.id] = await syncToHarness(harness, storePath, options);
  }

  return summary;
}
