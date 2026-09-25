import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { KEY_PATH, VAULT_PATH, readJsonFile, writeJsonFile } from "./config.ts";
import type { KeyBackend } from "./types.ts";

const SERVICE = "takomi-vault";
const ACCOUNT = "data-key";

interface KeyFile {
  version: 1;
  backend: KeyBackend;
  wrapped?: { salt: string; iv: string; tag: string; data: string };
  key?: string;
}

function runQuiet(command: string, args: string[], input?: string): string | undefined {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      input,
      timeout: 10_000,
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

function dpapiProtect(plainB64: string): string | undefined {
  if (process.platform !== "win32") return undefined;
  const script = [
    "Add-Type -AssemblyName System.Security;",
    "$bytes = [Convert]::FromBase64String($env:TAKOMI_VAULT_PLAIN);",
    "$enc = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser');",
    "[Convert]::ToBase64String($enc)",
  ].join(" ");
  try {
    const output = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      env: { ...process.env, TAKOMI_VAULT_PLAIN: plainB64 },
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

function dpapiUnprotect(encB64: string): string | undefined {
  if (process.platform !== "win32") return undefined;
  const script = [
    "Add-Type -AssemblyName System.Security;",
    "$bytes = [Convert]::FromBase64String($env:TAKOMI_VAULT_ENC);",
    "$dec = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser');",
    "[Convert]::ToBase64String($dec)",
  ].join(" ");
  try {
    const output = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      env: { ...process.env, TAKOMI_VAULT_ENC: encB64 },
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

function tryExec(command: string, args: string[], input?: string): boolean {
  try {
    execFileSync(command, args, { input, timeout: 10_000, stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function macStore(plainB64: string): boolean {
  if (process.platform !== "darwin") return false;
  // With -w and no argument, security reads the password from stdin.
  // Never retry with the data key in process arguments.
  return tryExec("security", ["add-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-U", "-w"], `${plainB64}\n`);
}

function macLoad(): string | undefined {
  if (process.platform !== "darwin") return undefined;
  return runQuiet("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]);
}

function linuxStore(plainB64: string): boolean {
  if (process.platform !== "linux") return false;
  return tryExec("secret-tool", ["store", "--label=takomi-vault", "service", SERVICE, "key", ACCOUNT], plainB64);
}

function linuxLoad(): string | undefined {
  if (process.platform !== "linux") return undefined;
  return runQuiet("secret-tool", ["lookup", "service", SERVICE, "key", ACCOUNT]);
}

const SCRYPT_OPTS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function wrapWithPassphrase(keyB64: string, passphrase: string): KeyFile["wrapped"] {
  const salt = randomBytes(16);
  const derived = scryptSync(passphrase, salt, 32, SCRYPT_OPTS);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derived, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(keyB64, "base64")), cipher.final()]);
  return { salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function unwrapWithPassphrase(wrapped: NonNullable<KeyFile["wrapped"]>, passphrase: string): string {
  const derived = scryptSync(passphrase, Buffer.from(wrapped.salt, "base64"), 32, SCRYPT_OPTS);
  const decipher = createDecipheriv("aes-256-gcm", derived, Buffer.from(wrapped.iv, "base64"));
  decipher.setAuthTag(Buffer.from(wrapped.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(wrapped.data, "base64")), decipher.final()]);
  return plain.toString("base64");
}

function isKeyFile(value: unknown): value is KeyFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1 && typeof candidate.backend === "string";
}

function loadOsKey(): { key: string; backend: KeyBackend } | undefined {
  if (process.platform === "darwin") {
    const loaded = macLoad();
    if (loaded) return { key: loaded, backend: "macos-keychain" };
    return undefined;
  }
  if (process.platform === "linux") {
    const loaded = linuxLoad();
    if (loaded) return { key: loaded, backend: "linux-secret-tool" };
    return undefined;
  }
  return undefined;
}

export function hasStoredOsKey(): boolean {
  return loadOsKey() !== undefined;
}

function storeOsKey(keyB64: string): KeyBackend | undefined {
  if (process.platform === "darwin" && macStore(keyB64)) return "macos-keychain";
  if (process.platform === "linux" && linuxStore(keyB64)) return "linux-secret-tool";
  return undefined;
}

export function resolveDataKey(): { key: Buffer; backend: KeyBackend } {
  const raw = existsSync(KEY_PATH) ? readJsonFile<unknown>(KEY_PATH, undefined) : undefined;
  if (raw !== undefined && !isKeyFile(raw)) {
    throw new Error("Vault key file is corrupt. Restore key.json from backup; refusing to overwrite it.");
  }
  const existing = raw as KeyFile | undefined;

  if (existing) {
    // Fail closed: a key file we cannot unwrap (different user, wrong
    // passphrase) must never trigger a rekey that destroys the vault.
    if (process.platform === "win32" && typeof existing.key === "string" && existing.backend === "windows-dpapi") {
      const plain = dpapiUnprotect(existing.key);
      if (plain) return { key: Buffer.from(plain, "base64"), backend: "windows-dpapi" };
      throw new Error("Cannot unwrap vault key with DPAPI. You may be a different Windows user.");
    }
    const osKey = loadOsKey();
    if (osKey) return { key: Buffer.from(osKey.key, "base64"), backend: osKey.backend };
    const passphrase = process.env.TAKOMI_VAULT_PASSPHRASE;
    if (passphrase && existing.wrapped) {
      try {
        const plain = unwrapWithPassphrase(existing.wrapped, passphrase);
        return { key: Buffer.from(plain, "base64"), backend: "passphrase" };
      } catch {
        throw new Error("Incorrect vault passphrase (TAKOMI_VAULT_PASSPHRASE).");
      }
    }
    if (typeof existing.key === "string" && existing.backend === "file-permissions") {
      return { key: Buffer.from(existing.key, "base64"), backend: "file-permissions" };
    }
    throw new Error("Vault key exists but no usable backend (OS store, DPAPI, or passphrase) could unwrap it.");
  }

  if (existsSync(VAULT_PATH)) {
    throw new Error("Vault key is missing while vault data exists. Restore key.json; refusing to create a new key.");
  }

  const fresh = randomBytes(32);
  const freshB64 = fresh.toString("base64");

  if (process.platform === "win32") {
    const wrapped = dpapiProtect(freshB64);
    if (wrapped) {
      writeJsonFile(KEY_PATH, { version: 1, backend: "windows-dpapi", key: wrapped } satisfies KeyFile);
      return { key: fresh, backend: "windows-dpapi" };
    }
  }

  const osStored = storeOsKey(freshB64);
  if (osStored) {
    writeJsonFile(KEY_PATH, { version: 1, backend: osStored } satisfies KeyFile);
    return { key: fresh, backend: osStored };
  }

  const passphrase = process.env.TAKOMI_VAULT_PASSPHRASE;
  if (passphrase) {
    writeJsonFile(KEY_PATH, { version: 1, backend: "passphrase", wrapped: wrapWithPassphrase(freshB64, passphrase) } satisfies KeyFile);
    return { key: fresh, backend: "passphrase" };
  }

  writeJsonFile(KEY_PATH, { version: 1, backend: "file-permissions", key: freshB64 } satisfies KeyFile);
  return { key: fresh, backend: "file-permissions" };
}
