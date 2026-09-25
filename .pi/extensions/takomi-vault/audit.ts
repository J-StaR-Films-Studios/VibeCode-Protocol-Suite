import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { AUDIT_PATH } from "./config.ts";
import type { AuditEvent } from "./types.ts";

type SafeAuditEvent = Pick<AuditEvent, "at" | "event" | "credentialId" | "grantId" | "scope" | "tool" | "operation" | "target">;
const events = new Set<AuditEvent["event"]>(["requested", "approved", "denied", "used", "expired", "revoked", "created", "deleted", "renamed", "revealed"]);

function sanitize(value: unknown): SafeAuditEvent | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.at !== "number" || !Number.isFinite(record.at) || !events.has(record.event as AuditEvent["event"])) return undefined;
  if (record.credentialId !== undefined && (typeof record.credentialId !== "string" || !/^cred_[A-F0-9]{32}$/.test(record.credentialId))) return undefined;
  // Copy only recognized structured fields. Legacy free-form result/agent text never leaves this boundary.
  const grantId = typeof record.grantId === "string" && /^grant_[A-F0-9]{32}$/.test(record.grantId) ? record.grantId : undefined;
  const scope = record.scope === "once" || record.scope === "turn" || record.scope === "session" || record.scope === "target" ? record.scope : undefined;
  const tool = record.tool === "terminal" || record.tool === "file" ? record.tool : undefined;
  const operation = typeof record.operation === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(record.operation) ? record.operation : undefined;
  const target = typeof record.target === "string" && record.target.length <= 253
    && /^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/.test(record.target) ? record.target : undefined;
  return { at: record.at, event: record.event as AuditEvent["event"],
    ...(record.credentialId ? { credentialId: record.credentialId } : {}),
    ...(grantId ? { grantId } : {}), ...(scope ? { scope } : {}), ...(tool ? { tool } : {}),
    ...(operation ? { operation } : {}), ...(target && (grantId || record.event === "requested") ? { target } : {}) };
}

export function logAudit(event: AuditEvent) {
  const safe = sanitize(event);
  if (!safe) return;
  mkdirSync(dirname(AUDIT_PATH), { recursive: true, mode: 0o700 });
  appendFileSync(AUDIT_PATH, `${JSON.stringify(safe)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function readAudit(limit = 50, credentialId?: string): SafeAuditEvent[] {
  if (!existsSync(AUDIT_PATH)) return [];
  const lines = readFileSync(AUDIT_PATH, "utf8").split("\n");
  const matches: SafeAuditEvent[] = [];
  for (let i = lines.length - 1; i >= 0 && matches.length < limit; i--) {
    try {
      const event = sanitize(JSON.parse(lines[i]));
      if (event && (!credentialId || event.credentialId === credentialId)) matches.push(event);
    } catch {
      // Ignore malformed legacy lines.
    }
  }
  return matches;
}
