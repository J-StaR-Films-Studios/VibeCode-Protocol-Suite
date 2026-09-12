import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mirror note: the five cache helpers below are intentionally duplicated in
// .pi/extensions/takomi-runtime/takomi-stats.js because global Pi installs do
// not sync src/ (see scripts/sync-pi-global.ps1), so the extension must stay
// self-contained. Keep both copies identical; scripts/test-stats-cache-parity.js
// fails the suite when they drift.
const CACHE_VERSION = 2;

export function getStatsCachePath(home = os.homedir()) {
  return path.join(home, '.pi', 'takomi', 'cache', 'stats-cache.json');
}

export function serializeRow(row) {
  if (!row) return null;
  return {
    ...row,
    roles: Object.fromEntries(row.roles || []),
    stages: Object.fromEntries(row.stages || []),
    workflows: Object.fromEntries(row.workflows || []),
    models: Object.fromEntries(row.models || []),
  };
}

export function deserializeRow(cached) {
  if (!cached) return null;
  return {
    ...cached,
    roles: new Map(Object.entries(cached.roles || {})),
    stages: new Map(Object.entries(cached.stages || {})),
    workflows: new Map(Object.entries(cached.workflows || {})),
    models: new Map(Object.entries(cached.models || {})),
  };
}

export async function loadStatsCache(cacheFile = getStatsCachePath()) {
  try {
    const raw = await fs.readFile(cacheFile, 'utf8');
    const data = JSON.parse(raw);
    if (data && data.version === CACHE_VERSION && data.entries && typeof data.entries === 'object') {
      return data.entries;
    }
  } catch {
    // Cache file missing or invalid
  }
  return {};
}

export async function saveStatsCache(entries, cacheFile = getStatsCachePath()) {
  try {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    const payload = JSON.stringify({
      version: CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      entries,
    });
    await fs.writeFile(cacheFile, payload, 'utf8');
  } catch {
    // Fail silently if cache cannot be written
  }
}
