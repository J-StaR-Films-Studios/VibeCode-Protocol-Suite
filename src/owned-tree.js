import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { createReadStream } from 'fs';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Hash a file tree without following symlinks.
 *
 * Symlinks are represented by their link target string instead of the linked
 * file contents. This prevents store/harness reconciliation from recursively
 * reading outside the intended tree or looping through symlink cycles.
 */
export async function hashPath(targetPath) {
  if (!await fs.pathExists(targetPath)) return null;

  const rootStat = await fs.lstat(targetPath);
  if (rootStat.isSymbolicLink()) return sha256(`symlink:${await fs.readlink(targetPath).catch(() => '')}`);
  if (rootStat.isFile()) return hashFile(targetPath);
  if (!rootStat.isDirectory()) return sha256(`other:${rootStat.mode}:${rootStat.size}`);

  const entries = [];
  async function walk(current, prefix = '') {
    const names = (await fs.readdir(current)).sort();
    for (const name of names) {
      const full = path.join(current, name);
      const rel = path.join(prefix, name).replace(/\\/g, '/');
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) {
        const linkTarget = await fs.readlink(full).catch(() => '');
        entries.push(`symlink:${rel}:${linkTarget}`);
      } else if (stat.isDirectory()) {
        entries.push(`dir:${rel}`);
        await walk(full, rel);
      } else if (stat.isFile()) {
        entries.push(`file:${rel}:${await hashFile(full)}`);
      } else {
        entries.push(`other:${rel}:${stat.mode}:${stat.size}`);
      }
    }
  }
  await walk(targetPath);
  return sha256(entries.join('\n'));
}

export function normalizeOwnedMap(value) {
  if (!value || typeof value !== 'object') return {};
  const normalized = {};
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry === 'string') normalized[name] = { hash: entry };
    else if (entry?.hash) normalized[name] = entry;
  }
  return normalized;
}

export async function copyOwnedTree(src, dest, options = {}) {
  const { allowSymlinks = false, filter, ...copyOptions } = options;
  await fs.copy(src, dest, {
    overwrite: true,
    errorOnExist: false,
    dereference: false,
    ...copyOptions,
    filter: async (candidate) => {
      if (filter && !await filter(candidate)) return false;
      if (allowSymlinks) return true;
      const stat = await fs.lstat(candidate).catch(() => null);
      if (stat?.isSymbolicLink()) {
        throw new Error(`Refusing to copy symlink in managed tree: ${candidate}`);
      }
      return true;
    },
  });
}

export async function linkOwnedTree(src, dest) {
  const resolvedSrc = path.resolve(src);
  const stat = await fs.lstat(resolvedSrc);
  const type = stat.isDirectory()
    ? (process.platform === 'win32' ? 'junction' : 'dir')
    : 'file';
  await fs.ensureDir(path.dirname(dest));
  await fs.symlink(resolvedSrc, dest, type);
}

export async function materializeOwnedTree(src, dest, options = {}) {
  const linkMode = options.linkMode || 'copy';
  if (linkMode === 'symlink' || linkMode === 'auto') {
    try {
      await linkOwnedTree(src, dest);
      return { method: 'symlink' };
    } catch (error) {
      if (linkMode === 'symlink') throw error;
      await fs.remove(dest).catch(() => {});
      await copyOwnedTree(src, dest, options.copyOptions || {});
      return { method: 'copy', fallbackError: error.message };
    }
  }

  await copyOwnedTree(src, dest, options.copyOptions || {});
  return { method: 'copy' };
}
