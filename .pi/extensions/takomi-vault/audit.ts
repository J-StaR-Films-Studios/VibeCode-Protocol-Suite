import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { AUDIT_PATH } from "./config.ts";
import type { AuditEvent } from "./types.ts";

export function logAudit(event: AuditEvent) {
  mkdirSync(dirname(AUDIT_PATH), { recursive: true, mode: 0o700 });
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ ...event, at: event.at ?? Date.now() })}\n`, { encoding: "utf8", mode: 0o600 });
}

export function readAudit(limit = 50): AuditEvent[] {
  if (!existsSync(AUDIT_PATH)) return [];
  const lines = readFileSync(AUDIT_PATH, "utf8").split("\n").filter(Boolean);
  const events = lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line) as AuditEvent;
    } catch {
      return undefined;
    }
  }).filter((entry): entry is AuditEvent => Boolean(entry));
  return events.reverse();
}
