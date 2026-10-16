import { randomUUID } from "node:crypto";
import { GRANTS_PATH, readJsonFile, withJsonFileLock, writeJsonFile } from "./config.ts";
import { logAudit } from "./audit.ts";
import { VaultOperationError, type CredentialGrant, type GrantScope, type GrantStoreFile } from "./types.ts";

const VALID_SCOPES: GrantScope[] = ["once", "turn", "session", "target"];

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

const SCOPE_TTL_MS: Record<GrantScope, number> = {
  once: 5 * 60 * 1000,
  turn: 15 * 60 * 1000,
  session: 12 * 60 * 60 * 1000,
  target: 30 * 24 * 60 * 60 * 1000,
};

function load(): GrantStoreFile {
  const file = readJsonFile<unknown>(GRANTS_PATH, { version: 1, grants: [] });
  if (typeof file !== "object" || file === null || !("version" in file) || (file.version !== 1 && file.version !== 2)
    || !("grants" in file) || !Array.isArray(file.grants) || !file.grants.every(isGrant)
    || (file.version === 1 && file.grants.some((grant) => grant.policyVersion !== undefined))) {
    throw new Error("Grant file has invalid structure; refusing to use it.");
  }
  return { version: file.version, grants: file.grants };
}

export function validOwnerSessionId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256 && !/\p{Cc}/u.test(value);
}

/** Applicability only. Spend still checks destination, fields, tool and agent under lock. */
export function grantStatus(grant: CredentialGrant, ownerSessionId?: string): string {
  if (grant.expiresAt <= Date.now()) return "expired";
  if (grant.revoked) return "revoked";
  if (grant.scope === "once" && grant.useCount >= 1) return "spent";
  if (grant.scope === "session" || grant.scope === "turn") {
    if (grant.policyVersion !== 2) return "legacy-reapproval";
    if (!validOwnerSessionId(ownerSessionId)) return "owner-unavailable";
    if (grant.ownerSessionId !== ownerSessionId) return "other-chat";
  }
  return "usable-here";
}

function isGrant(value: unknown): value is CredentialGrant {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  if (g.policyVersion === undefined) {
    if (g.ownerSessionId !== undefined) return false;
  } else if (g.policyVersion === 2) {
    if ((g.tool !== "terminal" && g.tool !== "file") || !Array.isArray(g.fields) || !g.fields.length
      || g.fields.some((field) => typeof field !== "string" || !field.trim())) return false;
    if (g.scope === "session" || g.scope === "turn") {
      if (!validOwnerSessionId(g.ownerSessionId)) return false;
    } else if (g.ownerSessionId !== undefined) return false;
  } else return false;
  return typeof g.grantId === "string" && typeof g.credentialId === "string"
    && typeof g.agent === "string" && typeof g.tool === "string"
    && typeof g.target === "string" && typeof g.operation === "string"
    && (g.scope === "once" || g.scope === "turn" || g.scope === "session" || g.scope === "target")
    && typeof g.expiresAt === "number" && Number.isFinite(g.expiresAt)
    && typeof g.createdAt === "number" && Number.isFinite(g.createdAt)
    && typeof g.revoked === "boolean" && typeof g.useCount === "number" && Number.isSafeInteger(g.useCount) && g.useCount >= 0
    && (g.fields === undefined || (Array.isArray(g.fields) && g.fields.every((field: unknown) => typeof field === "string")));
}

function save(file: GrantStoreFile) {
  writeJsonFile(GRANTS_PATH, file);
}

export function issueGrant(input: {
  credentialId: string;
  agent?: string;
  tool: "terminal" | "file";
  target: string;
  operation?: string;
  scope: GrantScope;
  fields: string[];
  ownerSessionId?: string;
}): CredentialGrant {
  const target = input.target.trim().toLowerCase();
  if (!target) throw new Error("Grant target cannot be empty");
  if (!VALID_SCOPES.includes(input.scope)) throw new Error("Unknown grant scope.");
  if (!input.fields?.length || input.fields.some((field) => !field.trim())) throw new Error("Grant fields cannot be empty");
  if (input.tool !== "terminal" && input.tool !== "file") throw new Error("Grant tool must be terminal or file.");
  const ownerSessionId = input.ownerSessionId ?? "";
  const chatScope = input.scope === "session" || input.scope === "turn";
  if (chatScope && !validOwnerSessionId(input.ownerSessionId)) throw new VaultOperationError("owner_unavailable");
  if (!chatScope && input.ownerSessionId !== undefined) throw new Error("Only chat scopes may have an owner.");
  return withJsonFileLock(GRANTS_PATH, () => {
    const file = load();
    const grants = file.grants;
    const createdAt = Date.now();
    const grant: CredentialGrant = {
      grantId: newId("grant"),
      credentialId: input.credentialId,
      agent: input.agent ?? "pi",
      tool: input.tool,
      policyVersion: 2,
      target,
      operation: input.operation ?? "use",
      fields: input.fields,
      ...(input.scope === "session" || input.scope === "turn"
        ? { scope: input.scope, ownerSessionId }
        : { scope: input.scope }),
      expiresAt: createdAt + SCOPE_TTL_MS[input.scope],
      revoked: false,
      createdAt,
      useCount: 0,
    };
    grants.push(grant);
    file.version = 2;
    save(file);
    try {
      logAudit({ at: Date.now(), credentialId: grant.credentialId, event: "requested", grantId: grant.grantId, tool: grant.tool === "file" ? "file" : "terminal", operation: grant.operation, target: grant.target });
      logAudit({ at: Date.now(), credentialId: grant.credentialId, event: "approved", grantId: grant.grantId, scope: grant.scope, tool: grant.tool === "file" ? "file" : "terminal", operation: grant.operation, target: grant.target });
    } catch (error) {
      // Still holding the grant lock: remove the capability before the caller can discard its credential.
      save({ ...file, grants: grants.filter((entry) => entry.grantId !== grant.grantId) });
      throw error;
    }
    return grant;
  });
}

function checkGrant(grants: CredentialGrant[], grantId: string, target: string, tool: string, operation: string, agent: string, fields: string[], ownerSessionId?: string): CredentialGrant {
  const grant = grants.find((entry) => entry.grantId === grantId);
  if (!grant) throw new VaultOperationError("grant_missing");
  if (grant.revoked) throw new VaultOperationError("grant_revoked");
  if (grant.expiresAt <= Date.now()) throw new VaultOperationError("grant_expired");
  if (grant.target !== target.trim().toLowerCase()) {
    throw new VaultOperationError("target_mismatch");
  }
  if (grant.tool !== tool && grant.tool !== "any") {
    throw new VaultOperationError("tool_mismatch");
  }
  if (grant.agent !== agent) throw new VaultOperationError("agent_mismatch");
  if (grant.scope === "session" || grant.scope === "turn") {
    if (grant.policyVersion !== 2) throw new VaultOperationError("legacy_reapproval");
    if (!validOwnerSessionId(ownerSessionId)) throw new VaultOperationError("owner_unavailable");
    if (grant.ownerSessionId !== ownerSessionId) throw new VaultOperationError("owner_mismatch");
  }
  if (grant.policyVersion !== 2 && grant.operation !== operation) throw new VaultOperationError("operation_mismatch");
  if (grant.fields && fields.some((field) => !grant.fields?.includes(field))) throw new VaultOperationError("fields_denied");
  if (grant.scope === "once" && grant.useCount >= 1) throw new VaultOperationError("grant_spent");
  return grant;
}

/** Validate and spend under the same cross-process file lock. */
export function spendGrant(input: { grantId: string; credentialId: string; target: string; tool: string; operation: string; agent: string; fields: string[]; persistent?: boolean; ownerSessionId?: string }): CredentialGrant {
  return withJsonFileLock(GRANTS_PATH, () => {
    const file = load();
    const grant = checkGrant(file.grants, input.grantId, input.target, input.tool, input.operation, input.agent, input.fields, input.ownerSessionId);
    if (grant.credentialId !== input.credentialId) throw new VaultOperationError("credential_mismatch");
    if (input.persistent && grant.scope !== "target" && grant.scope !== "session") throw new VaultOperationError("persistent_scope");
    grant.useCount += 1;
    save(file);
    return grant;
  });
}

export function revokeGrants(filter: { grantId?: string; credentialId?: string; scope?: GrantScope; all?: boolean }): CredentialGrant[] {
  return withJsonFileLock(GRANTS_PATH, () => {
    const file = load();
    const grants = file.grants;
    const revoked: CredentialGrant[] = [];
    for (const grant of grants) {
      if (filter.all
        || (filter.grantId && grant.grantId === filter.grantId)
        || (filter.credentialId && grant.credentialId === filter.credentialId)
        || (filter.scope && grant.scope === filter.scope)) {
        if (!grant.revoked) {
          grant.revoked = true;
          revoked.push(grant);
        }
      }
    }
    save(file);
    for (const grant of revoked) {
      try {
        logAudit({ at: Date.now(), credentialId: grant.credentialId, event: "revoked", grantId: grant.grantId, scope: grant.scope, tool: grant.tool === "file" ? "file" : "terminal", operation: grant.operation, target: grant.target });
      } catch {
        // Revocation is already durable; audit failure must not block credential cleanup.
      }
    }
    return revoked;
  });
}

export function listGrants(credentialId?: string): CredentialGrant[] {
  const grants = load().grants.filter((grant) => !credentialId || grant.credentialId === credentialId);
  return [...grants].sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeExpiredSessionGrants() {
  withJsonFileLock(GRANTS_PATH, () => {
    const file = load();
    const grants = file.grants;
    let changed = false;
    for (const grant of grants) {
      if (!grant.revoked && grant.expiresAt <= Date.now()) {
        grant.revoked = true;
        changed = true;
        logAudit({ at: Date.now(), credentialId: grant.credentialId, event: "expired", grantId: grant.grantId, scope: grant.scope, operation: grant.operation, target: grant.target });
      }
    }
    if (changed) save(file);
  });
}
