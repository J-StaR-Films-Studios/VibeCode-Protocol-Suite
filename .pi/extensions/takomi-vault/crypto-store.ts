import { existsSync, readFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EncryptedBlob, KeyBackend } from "./types.ts";
import { KEY_PATH } from "./config.ts";
import { resolveDataKey } from "./key-provider.ts";

let cachedKey: Buffer | undefined;
let cachedBackend: KeyBackend | undefined;

export function getBackend(): KeyBackend {
  if (cachedBackend) return cachedBackend;
  const resolved = resolveDataKey();
  cachedKey = resolved.key;
  cachedBackend = resolved.backend;
  return cachedBackend;
}

export function peekBackend(): KeyBackend | "not-initialized" {
  if (cachedBackend) return cachedBackend;
  if (!existsSync(KEY_PATH)) return "not-initialized";
  try {
    const parsed = JSON.parse(readFileSync(KEY_PATH, "utf8")) as { backend?: unknown };
    return typeof parsed.backend === "string" ? (parsed.backend as KeyBackend) : "not-initialized";
  } catch {
    return "not-initialized";
  }
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const resolved = resolveDataKey();
  cachedKey = resolved.key;
  cachedBackend = resolved.backend;
  return cachedKey;
}

export function encryptField(plain: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptField(blob: EncryptedBlob): string {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
  return plain.toString("utf8");
}

export function clearKeyCache() {
  cachedKey = undefined;
  cachedBackend = undefined;
}
