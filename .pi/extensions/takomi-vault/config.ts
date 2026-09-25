import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DATA_ROOT = join(homedir(), ".pi", "agent", "takomi-vault");
export const VAULT_PATH = join(DATA_ROOT, "vault.json");
export const GRANTS_PATH = join(DATA_ROOT, "grants.json");
export const AUDIT_PATH = join(DATA_ROOT, "audit.log");
export const KEY_PATH = join(DATA_ROOT, "key.json");

function applySecurePermissions(filePath: string, mode: number) {
  try {
    chmodSync(filePath, mode);
  } catch {
    // Best effort. Windows commonly ignores POSIX chmod semantics.
  }
}

export function ensureDirectory(dirPath: string) {
  mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  applySecurePermissions(dirPath, 0o700);
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const HELD_LOCKS = new Set<string>();

export function withJsonFileLock<T>(filePath: string, fn: () => T): T {
  ensureDirectory(dirname(filePath));
  const lockPath = `${filePath}.lock`;
  if (HELD_LOCKS.has(lockPath)) return fn();
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      break;
    } catch {
      try {
        const ageMs = Date.now() - statSync(lockPath).mtimeMs;
        if (ageMs > 5_000) rmSync(lockPath, { recursive: true, force: true });
      } catch {
        // Lock disappeared between attempts.
      }
      if (Date.now() - started > 2_000) throw new Error(`Timed out waiting for vault lock: ${lockPath}`);
      sleepSync(50);
    }
  }
  HELD_LOCKS.add(lockPath);
  try {
    return fn();
  } finally {
    HELD_LOCKS.delete(lockPath);
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function writeJsonFile(filePath: string, value: unknown, secure = true) {
  ensureDirectory(dirname(filePath));
  withJsonFileLock(filePath, () => {
    const mode = secure ? 0o600 : 0o644;
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
      applySecurePermissions(tempPath, mode);
      renameSync(tempPath, filePath);
      applySecurePermissions(filePath, mode);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    }
  });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    // Fail closed: a corrupt vault, grant, or key file must never be silently
    // replaced with empty state by the next save.
    throw new Error(`Vault file is corrupt and will not be touched: ${filePath}. Restore it from backup.`);
  }
}
