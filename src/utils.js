import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  agent: path.join(PACKAGE_ROOT, '.agent'),
  workflows: path.join(PACKAGE_ROOT, '.agent', 'workflows'),
  skills: path.join(PACKAGE_ROOT, '.agent', 'skills'),
  agentsYaml: path.join(PACKAGE_ROOT, 'VibeCode-Agents (e.g Kilo-code)'),
  manual: path.join(PACKAGE_ROOT, 'Legacy (Manual Method)'),
};

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
        timeout: 15000,
        headers: {
          'User-Agent': 'vibesuite-cli'
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
            const { stdout } = await execAsync(`curl -sL --max-time 15 "${rawUrl}"`);
            if (stdout) resolve(stdout);
            else reject(err);
          } catch (curlErr) {
            reject(err); // Return original error if curl also fails
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
        'User-Agent': 'vibesuite-cli',
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
export async function downloadDirectoryFromGitHub(relativePath, destPath, filter = null, delayMs = 100) {
  let count = 0;

  try {
    const items = await fetchDirectoryListing(relativePath);

    for (const item of items) {
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
  if (useGitHub) {
    try {
      const items = await fetchDirectoryListing('.agent/workflows');
      return items
        .filter(item => item.type === 'file' && item.name.endsWith('.md'))
        .map(item => item.name);
    } catch (error) {
      logGitHubError(`GitHub fetch failed: ${error.message}`);
      disableGitHub();
    }
  }

  // Fallback to local
  try {
    const files = await fs.readdir(PATHS.workflows);
    return files.filter(f => f.endsWith('.md'));
  } catch (error) {
    return [];
  }
}

export async function getSkills() {
  if (useGitHub) {
    try {
      const items = await fetchDirectoryListing('.agent/skills');
      return items
        .filter(item => item.type === 'dir')
        .map(item => item.name);
    } catch (error) {
      logGitHubError(`GitHub fetch failed: ${error.message}`);
      disableGitHub();
    }
  }

  // Fallback to local
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
    if (useGitHub) {
      try {
        const success = await downloadFromGitHub(
          `.agent/workflows/${workflow}`,
          path.join(destFolder, workflow)
        );
        if (success) continue;
      } catch (error) {
        logGitHubError(`GitHub fetch failed: ${error.message}`);
        disableGitHub();
      }
    }

    // Fallback to local
    const src = path.join(PATHS.workflows, workflow);
    const dest = path.join(destFolder, workflow);
    await fs.copy(src, dest, { overwrite: true });
  }
}

export async function copySpecificSkills(selectedSkills, destFolder) {
  // Ensure dest folder exists
  await fs.ensureDir(destFolder);

  for (const skill of selectedSkills) {
    if (useGitHub) {
      try {
        const count = await downloadDirectoryFromGitHub(
          `.agent/skills/${skill}`,
          path.join(destFolder, skill)
        );
        if (count > 0) continue;
      } catch (error) {
        logGitHubError(`GitHub fetch failed: ${error.message}`);
        disableGitHub();
      }
    }

    // Fallback to local
    const src = path.join(PATHS.skills, skill);
    const dest = path.join(destFolder, skill);
    await fs.copy(src, dest, { overwrite: true });
  }
}

/**
 * Copy all workflows from GitHub or local fallback
 * @param {string} destFolder - Destination folder
 * @param {boolean} skipLegacy - Whether to skip LEGACY folder
 */
export async function copyAllWorkflows(destFolder, skipLegacy = false) {
  await fs.ensureDir(destFolder);

  if (useGitHub) {
    try {
      const filter = skipLegacy ? (item) => item.name !== 'LEGACY' : null;
      const count = await downloadDirectoryFromGitHub('.agent/workflows', destFolder, filter);
      if (count > 0) return;
    } catch (error) {
      logGitHubError(`GitHub fetch failed: ${error.message}`);
      disableGitHub();
    }
  }

  // Fallback to local
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

  if (useGitHub) {
    try {
      const count = await downloadDirectoryFromGitHub('.agent/skills', destFolder);
      if (count > 0) return;
    } catch (error) {
      logGitHubError(`GitHub fetch failed: ${error.message}`);
      disableGitHub();
    }
  }

  // Fallback to local
  await fs.copy(PATHS.skills, destFolder);
}

/**
 * Copy agent README from GitHub or local fallback
 * @param {string} destPath - Destination path for README.md
 */
export async function copyAgentReadme(destPath) {
  if (useGitHub) {
    try {
      const success = await downloadFromGitHub('.agent/README.md', destPath);
      if (success) return;
    } catch (error) {
      // README is optional, silently fall back
    }
  }

  // Fallback to local
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

  if (useGitHub) {
    try {
      const count = await downloadDirectoryFromGitHub(
        'VibeCode-Agents (e.g Kilo-code)',
        destFolder
      );
      if (count > 0) return;
    } catch (error) {
      logGitHubError(`GitHub fetch failed: ${error.message}`);
      disableGitHub();
    }
  }

  // Fallback to local
  await fs.copy(PATHS.agentsYaml, destFolder);
}

/**
 * Copy Legacy Manual from GitHub or local fallback
 * @param {string} destFolder - Destination folder
 */
export async function copyLegacyManual(destFolder) {
  await fs.ensureDir(destFolder);

  if (useGitHub) {
    try {
      const count = await downloadDirectoryFromGitHub(
        'Legacy (Manual Method)',
        destFolder
      );
      if (count > 0) return;
    } catch (error) {
      logGitHubError(`GitHub fetch failed: ${error.message}`);
      disableGitHub();
    }
  }

  // Fallback to local
  await fs.copy(PATHS.manual, destFolder);
}
