import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import https from 'https';
import { spawnSync } from 'child_process';
import pc from 'picocolors';

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const CACHE_PATH = path.join(os.homedir(), '.takomi', 'update-check.json');
const REGISTRY_URL = 'https://registry.npmjs.org/takomi/latest';

function parseVersion(version = '') {
  const [core] = String(version).replace(/^v/, '').split('-');
  return core.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] || 0;
    const right = b[i] || 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

function fetchLatestPackageInfo(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = https.get(REGISTRY_URL, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'takomi-update-check',
      },
      timeout: timeoutMs,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) return resolve(null);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

async function readCache() {
  try {
    return await fs.readJson(CACHE_PATH);
  } catch {
    return null;
  }
}

async function writeCache(cache) {
  try {
    await fs.ensureDir(path.dirname(CACHE_PATH));
    await fs.writeJson(CACHE_PATH, cache, { spaces: 2 });
  } catch {
    // Update checks must never block normal Takomi startup.
  }
}

export async function getLatestTakomiVersion({ currentVersion, force = false } = {}) {
  const now = Date.now();
  const cache = await readCache();
  if (!force && cache?.checkedAt && now - cache.checkedAt < CHECK_INTERVAL_MS) {
    return cache;
  }

  const info = await fetchLatestPackageInfo();
  const latestVersion = typeof info?.version === 'string' ? info.version : null;
  const next = {
    checkedAt: now,
    currentVersion,
    latestVersion,
    updateAvailable: Boolean(latestVersion && currentVersion && isNewerVersion(latestVersion, currentVersion)),
  };
  await writeCache(next);
  return next;
}

export function notifyIfTakomiUpdateAvailable(currentVersion) {
  if (process.env.TAKOMI_NO_UPDATE_CHECK === '1') return;

  // Fire-and-forget by design: launching the Takomi harness must never wait on
  // network, DNS, npm registry latency, or cache file IO.
  setTimeout(() => {
    getLatestTakomiVersion({ currentVersion })
      .then((result) => {
        if (!result?.updateAvailable) return;
        console.log(pc.yellow(`\n⬆ Takomi ${result.latestVersion} is available (installed: ${currentVersion}).`));
        console.log(pc.dim('  Run: takomi upgrade'));
        console.log(pc.dim('  Disable this check with TAKOMI_NO_UPDATE_CHECK=1.\n'));
      })
      .catch(() => {
        // Silent: update checks must never affect harness startup or usage.
      });
  }, 0).unref?.();
}

export async function printTakomiUpdateStatus(currentVersion) {
  const result = await getLatestTakomiVersion({ currentVersion, force: true });
  if (!result?.latestVersion) {
    console.log(pc.yellow('Could not check the npm registry for Takomi updates.'));
    return;
  }
  if (result.updateAvailable) {
    console.log(pc.yellow(`Takomi ${result.latestVersion} is available (installed: ${currentVersion}).`));
    console.log(pc.dim('Run: takomi upgrade'));
    return;
  }
  console.log(pc.green(`Takomi is up to date (${currentVersion}).`));
}

export function upgradeTakomiPackage() {
  console.log(pc.cyan('Updating Takomi from npm...\n'));
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['install', '-g', 'takomi@latest'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status === 0) {
    console.log(pc.green('\nTakomi updated. Run `takomi --version` to confirm.'));
    return 0;
  }
  console.log(pc.red('\nTakomi update failed. Try manually: npm install -g takomi@latest'));
  return result.status || 1;
}
