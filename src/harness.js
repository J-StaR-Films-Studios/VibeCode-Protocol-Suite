import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import pc from 'picocolors';

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
      skills: path.join(HOME, '.codex', 'skills'),
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
      skills: path.join(HOME, '.gemini', 'skills'),
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
export async function syncDirectory(sourcePath, targetPath, label = '') {
  if (!targetPath) return 0;

  try {
    await fs.ensureDir(targetPath);

    const items = await fs.readdir(sourcePath);
    let count = 0;

    for (const item of items) {
      const src = path.join(sourcePath, item);
      const dest = path.join(targetPath, item);

      await fs.copy(src, dest, { overwrite: true });
      count++;
    }

    if (label) {
      console.log(pc.green(`  ✔ ${label} (${count} items)`));
    }

    return count;
  } catch (error) {
    if (label) {
      console.log(pc.red(`  ✗ ${label}: ${error.message}`));
    }
    return 0;
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
export async function syncToHarness(harness, storePath) {
  const results = { skills: 0, workflows: 0, yamls: 0 };

  console.log(pc.cyan(`\n  📡 Syncing to ${harness.name}...`));

  // Skills
  const skillsStore = path.join(storePath, 'skills');
  if (harness.targets.skills && await fs.pathExists(skillsStore)) {
    results.skills = await syncDirectory(
      skillsStore,
      harness.targets.skills,
      `Skills → ${harness.name}`
    );
  }

  // Workflows
  const workflowsStore = path.join(storePath, 'workflows');
  if (harness.targets.workflows && await fs.pathExists(workflowsStore)) {
    results.workflows = await syncDirectory(
      workflowsStore,
      harness.targets.workflows,
      `Workflows → ${harness.name}`
    );
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
export async function syncToAllHarnesses(harnesses, storePath) {
  const summary = {};

  for (const harness of harnesses) {
    summary[harness.id] = await syncToHarness(harness, storePath);
  }

  return summary;
}
