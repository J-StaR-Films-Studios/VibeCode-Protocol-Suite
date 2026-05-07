import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Reduced timeout to fail fast on bad connections
const FETCH_TIMEOUT = 10000;
const CURL_TIMEOUT = 10;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root of the package - utils.js is in src/, so package root is one level up from src/
const PACKAGE_ROOT = path.resolve(__dirname, '..');

// GitHub repository configuration
const GITHUB_REPO = 'JStaRFilms/VibeCode-Protocol-Suite';
const GITHUB_BRANCH = 'main';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;

export const PATHS = {
  root: PACKAGE_ROOT,
  assets: path.join(PACKAGE_ROOT, 'assets'),
  pi: path.join(PACKAGE_ROOT, '.pi'),
  agent: path.join(PACKAGE_ROOT, 'assets', '.agent'),
  workflows: path.join(PACKAGE_ROOT, 'assets', '.agent', 'workflows'),
  skills: path.join(PACKAGE_ROOT, 'assets', '.agent', 'skills'),
  agentsYaml: path.join(PACKAGE_ROOT, 'assets', 'Takomi-Agents'),
  manual: path.join(PACKAGE_ROOT, 'assets', 'Legacy'),
  packageJson: path.join(PACKAGE_ROOT, 'package.json'),
};

function shouldCopyBundledPiAsset(relativePath = '') {
  const normalized = relativePath.replace(/\\/g, '/');

  if (!normalized) return true;
  if (normalized === 'settings.json') return false;
  if (normalized === 'takomi-profile.json') return false;
  if (normalized === 'takomi/model-routing.md') return false;
  if (normalized.startsWith('takomi/subagents')) return false;

  return true;
}

export async function copyBundledPiAssets(targetDir) {
  if (!await fs.pathExists(PATHS.pi)) return false;

  await fs.copy(PATHS.pi, path.join(targetDir, '.pi'), {
    overwrite: true,
    errorOnExist: false,
    filter: (src) => {
      const relative = path.relative(PATHS.pi, src);
      return shouldCopyBundledPiAsset(relative);
    },
  });

  return true;
}

/**
 * Copies bundled resources from the npm package to the target directory.
 * No network required!
 */
export async function installResources(targetDir) {
  // Path to the 'assets' folder inside your takomi package
  const sourceDir = PATHS.assets;

  try {
    // Check if source exists (sanity check for your dev environment)
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Critical Error: Source assets not found at ${sourceDir}`);
    }

    // Copying everything (Workflows, Skills, YAMLs)
    // We copy specific subfolders to match the expected structure in the user's project

    // 1. Pi-native Takomi runtime bundle
    await copyBundledPiAssets(targetDir);

    // 2. .agent folder
    await fs.copy(PATHS.agent, path.join(targetDir, '.agent'), {
      overwrite: true,
      errorOnExist: false,
    });

    // 3. VibeCode-Agents
    await fs.copy(PATHS.agentsYaml, path.join(targetDir, 'VibeCode-Agents'), {
      overwrite: true,
      errorOnExist: false,
    });

    // 4. Legacy Protocols
    await fs.copy(PATHS.manual, path.join(targetDir, 'Legacy-Protocols'), {
      overwrite: true,
      errorOnExist: false,
    });

    console.log("✨ Takomi resources deployed successfully from local bundle!");
    return true;
  } catch (err) {
    console.error("❌ Installation failed:", err.message);
    return false;
  }
}

/**
 * Delay utility for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch file content from raw.githubusercontent.com
 * This avoids GitHub API rate limits (60 requests/hour for unauthenticated)
 * Raw URLs have much higher limits and work better for file downloads
 * @param {string} relativePath - Path relative to repo root
 * @param {number} retries - Number of retries (default: 3)
 * @returns {Promise<string>} File content
 */
export async function fetchFromGitHub(relativePath, retries = 3) {
  // Use raw GitHub content URL to avoid API rate limits
  const rawUrl = `${GITHUB_RAW_URL}/${relativePath}`;

  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries) => {
      const req = https.get(rawUrl, {
        timeout: FETCH_TIMEOUT,
        headers: {
          'User-Agent': 'takomi-cli'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else if (res.statusCode === 404) {
            reject(new Error('File not found (404)'));
          } else if (res.statusCode === 403) {
            reject(new Error('Access forbidden (403)'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', async (err) => {
        if (remainingRetries > 0) {
          setTimeout(() => attempt(remainingRetries - 1), 2000);
        } else {
          // Fallback to curl if Node https fails (e.g. proxy/network issues)
          try {
            // Ensure we use a timeout with curl too
            const { stdout } = await execAsync(`curl -sL --max-time ${CURL_TIMEOUT} "${rawUrl}"`);
            if (stdout) resolve(stdout);
            else reject(err);
          } catch (curlErr) {
            // Reject with both errors so we know what happened
            reject(new Error(`HTTPS: ${err.message} | Curl: ${curlErr.message}`));
          }
        }
      });

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });
    };

    attempt(retries);
  });
}

/**
 * Fetch directory listing from GitHub API
 * @param {string} relativePath - Path relative to repo root
 * @returns {Promise<Array>} Array of file objects
 */
export async function fetchDirectoryListing(relativePath) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}?ref=${GITHUB_BRANCH}`;

  return new Promise((resolve, reject) => {
    https.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'takomi-cli',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const items = JSON.parse(data);
            resolve(Array.isArray(items) ? items : []);
          } else if (res.statusCode === 404) {
            resolve([]);
          } else if (res.statusCode === 403) {
            reject(new Error('GitHub API rate limit exceeded. Please try again later.'));
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download a file from GitHub and save it locally
 * @param {string} relativePath - Path relative to repo root
 * @param {string} destPath - Local destination path
 * @returns {Promise<boolean>} Success status
 */
export async function downloadFromGitHub(relativePath, destPath) {
  try {
    const content = await fetchFromGitHub(relativePath);
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Failed to download ${relativePath}: ${error.message}`);

    // Fail fast on network errors
    const isNetworkError = error.message.includes('ECONNRESET') ||
      error.message.includes('timed out') ||
      error.message.includes('Curl') ||
      error.message.includes('ETIMEDOUT');

    if (isNetworkError && useGitHub) {
      logGitHubError(`Network instability detected (${error.message}). Disabling GitHub fetch.`);
      disableGitHub();
    }

    return false;
  }
}

/**
 * Recursively download a directory from GitHub
 * Uses API only for directory listings, raw URLs for file downloads
 * Includes rate limiting delays to avoid hitting API limits
 * @param {string} relativePath - Path relative to repo root
 * @param {string} destPath - Local destination path
 * @param {Function} filter - Optional filter function for items
 * @param {number} delayMs - Delay between file downloads in ms (default: 100)
 * @returns {Promise<number>} Number of files downloaded
 */
export async function downloadDirectoryFromGitHub(relativePath, destPath, filter = null, delayMs = 250) {
  let count = 0;

  try {
    const items = await fetchDirectoryListing(relativePath);

    for (const item of items) {
      if (!useGitHub) break; // Allow aborting if we disabled GitHub midway
      if (filter && !filter(item)) continue;

      if (item.type === 'file') {
        const fileDest = path.join(destPath, item.name);
        const success = await downloadFromGitHub(item.path, fileDest);
        if (success) {
          count++;
          // Add small delay between file downloads to be nice to GitHub
          if (delayMs > 0) {
            await delay(delayMs);
          }
        }
      } else if (item.type === 'dir') {
        const subDirDest = path.join(destPath, item.name);
        const subCount = await downloadDirectoryFromGitHub(item.path, subDirDest, filter, delayMs);
        count += subCount;
      }
    }
  } catch (error) {
    console.error(`Error downloading directory ${relativePath}: ${error.message}`);
  }

  return count;
}

// Flag to track if GitHub fetch is available
let useGitHub = true;
let githubErrorLogged = false;

/**
 * Check if GitHub fetching is available
 * @returns {boolean}
 */
export function isGitHubAvailable() {
  return useGitHub;
}

/**
 * Disable GitHub fetching and use local files instead
 */
export function disableGitHub() {
  useGitHub = false;
}

/**
 * Log GitHub error once
 * @param {string} message 
 */
export function logGitHubError(message) {
  if (!githubErrorLogged) {
    console.warn(`⚠️  ${message} Falling back to local files.`);
    githubErrorLogged = true;
  }
}

export async function getWorkflows() {
  // Always read from local package assets
  try {
    const files = await fs.readdir(PATHS.workflows);
    return files.filter(f => f.endsWith('.md'));
  } catch (error) {
    console.warn("Could not read local workflows:", error.message);
    return [];
  }
}

export async function getSkills() {
  // Always read from local package assets
  try {
    const files = await fs.readdir(PATHS.skills);
    const skills = [];
    for (const file of files) {
      const stats = await fs.stat(path.join(PATHS.skills, file));
      if (stats.isDirectory()) {
        skills.push(file);
      }
    }
    return skills;
  } catch (error) {
    console.warn("Could not read local skills:", error.message);
    return [];
  }
}

export async function copyToDestination(source, dest) {
  try {
    await fs.copy(source, dest, { overwrite: true });
    return true;
  } catch (error) {
    console.error(`Error copying ${source} to ${dest}:`, error);
    return false;
  }
}

export async function copySpecificWorkflows(selectedWorkflows, destFolder) {
  // Ensure dest folder exists
  await fs.ensureDir(destFolder);

  for (const workflow of selectedWorkflows) {
    const src = path.join(PATHS.workflows, workflow);
    const dest = path.join(destFolder, workflow);
    // Silent fail/warn if missing handled by fs.copy throwing? 
    // better to try/catch
    try {
      await fs.copy(src, dest, { overwrite: true });
    } catch (e) {
      console.warn(`Failed to copy workflow ${workflow}: ${e.message}`);
    }
  }
}

export async function copySpecificSkills(selectedSkills, destFolder) {
  // Ensure dest folder exists
  await fs.ensureDir(destFolder);

  for (const skill of selectedSkills) {
    const src = path.join(PATHS.skills, skill);
    const dest = path.join(destFolder, skill);

    try {
      await fs.copy(src, dest, { overwrite: true });
    } catch (e) {
      console.warn(`Failed to copy skill ${skill}: ${e.message}`);
    }
  }
}

/**
 * Copy all workflows from GitHub or local fallback
 * @param {string} destFolder - Destination folder
 * @param {boolean} skipLegacy - Whether to skip LEGACY folder
 */
export async function copyAllWorkflows(destFolder, skipLegacy = false) {
  await fs.ensureDir(destFolder);

  // Local Copy
  await fs.copy(PATHS.workflows, destFolder);
  if (skipLegacy) {
    const legacyPath = path.join(destFolder, 'LEGACY');
    if (await fs.pathExists(legacyPath)) {
      await fs.remove(legacyPath);
    }
  }
}

/**
 * Copy all skills from GitHub or local fallback
 * @param {string} destFolder - Destination folder
 */
export async function copyAllSkills(destFolder) {
  await fs.ensureDir(destFolder);
  // Local Copy Only
  await fs.copy(PATHS.skills, destFolder);
}

/**
 * Copy agent README from GitHub or local fallback
 * @param {string} destPath - Destination path for README.md
 */
export async function copyAgentReadme(destPath) {
  const readmeSrc = path.join(PATHS.agent, 'README.md');
  if (await fs.pathExists(readmeSrc)) {
    await fs.copy(readmeSrc, destPath);
  }
}

/**
 * Copy Agent YAMLs from GitHub or local fallback
 * @param {string} destFolder - Destination folder
 */
export async function copyAgentYamls(destFolder) {
  await fs.ensureDir(destFolder);
  await fs.copy(PATHS.agentsYaml, destFolder);
}

export async function copyLegacyManual(destFolder) {
  await fs.ensureDir(destFolder);
  await fs.copy(PATHS.manual, destFolder);
}

/**
 * Update Workflows from GitHub
 */
export async function updateWorkflows(destFolder) {
  console.log('📡 Fetching latest workflows from GitHub...');
  await fs.ensureDir(destFolder);
  await downloadDirectoryFromGitHub('.agent/workflows', destFolder);
}

/**
 * Update Skills from GitHub
 */
export async function updateSkills(destFolder) {
  console.log('📡 Fetching latest skills from GitHub...');
  await fs.ensureDir(destFolder);
  await downloadDirectoryFromGitHub('.agent/skills', destFolder);
}

/**
 * Update Agent YAMLs from GitHub
 */
export async function updateAgentYamls(destFolder) {
  console.log('📡 Fetching latest Agent YAMLs from GitHub...');
  await fs.ensureDir(destFolder);
  await downloadDirectoryFromGitHub('Takomi-Agents', destFolder);
}

/**
 * Update Legacy Protocols from GitHub
 */
export async function updateLegacyManual(destFolder) {
  console.log('📡 Fetching latest Legacy Protocols from GitHub...');
  await fs.ensureDir(destFolder);
  await downloadDirectoryFromGitHub('Legacy (Manual Method)', destFolder);
}
