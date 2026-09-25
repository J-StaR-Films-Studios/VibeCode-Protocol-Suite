import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execWithEnv, execWithStdin, writeTempEnvFile } from "./adapters.ts";
import { logAudit } from "./audit.ts";
import { peekBackend } from "./crypto-store.ts";
import { maskedSecret } from "./secret-input.ts";
import { issueGrant, listGrants, revokeExpiredSessionGrants, revokeGrants } from "./grant-store.ts";
import { createCredential, deleteCredential, deleteIfEphemeral, findByService, findServiceCandidates, getCredential, getFieldValue, isEphemeral, listCredentials, summarize } from "./vault-store.ts";
import type { GrantScope } from "./types.ts";

const ScopeSchema = Type.Union([Type.Literal("once"), Type.Literal("turn"), Type.Literal("session"), Type.Literal("target")]);

function textResult(text: string, details?: unknown) {
  return { content: [{ type: "text" as const, text }], details };
}

function errorResult(text: string, details?: unknown) {
  return { content: [{ type: "text" as const, text }], details, isError: true };
}

function auditDeniedUse(params: { grantId: string; credentialId: string }, tool: "terminal" | "file") {
  let grant;
  try {
    grant = listGrants(params.credentialId).find((entry) => entry.grantId === params.grantId && entry.credentialId === params.credentialId);
  } catch {
    // Audit a failed grant lookup without copying untrusted request metadata.
  }
  logAudit({ at: Date.now(), credentialId: params.credentialId, grantId: params.grantId, agent: "pi", event: "denied", tool,
    ...(grant ? { target: grant.target, operation: grant.operation } : {}) });
}

async function promptScope(ctx: ExtensionContext, target: string, operation: string, tool: string, fields: string[], requested?: GrantScope): Promise<GrantScope> {
  const choice = await ctx.ui.select(`Approve pi ${operation} on ${target} via ${tool}, fields ${fields.join(", ")}${requested ? ` (agent requested ${requested})` : ""}. Allow for`,  ["once — one operation", "turn — this agent turn", "session — until Pi exits", "target — always for this host until revoked"]);
  if (!choice) throw new Error("Cancelled by user");
  if (choice.startsWith("turn")) return "turn";
  if (choice.startsWith("session")) return "session";
  if (choice.startsWith("target")) return "target";
  return "once";
}

async function chooseApproval(ctx: ExtensionContext, fieldNames: string[], target: string, operation: string, tool: "terminal" | "file", requested?: GrantScope) {
  const selected = await ctx.ui.select(`Fields for pi ${operation} on ${target}`, ["All fields", ...fieldNames]);
  if (!selected) throw new Error("Cancelled by user");
  const fields = selected === "All fields" ? fieldNames : [selected];
  const scope = await promptScope(ctx, target, operation, tool, fields, requested);
  return { fields, scope };
}

async function approveGrant(ctx: ExtensionContext, credentialId: string, fieldNames: string[], target: string, operation: string, tool: "terminal" | "file", requested?: GrantScope) {
  const approval = await chooseApproval(ctx, fieldNames, target, operation, tool, requested);
  return issueGrant({ credentialId, target, operation, tool, ...approval });
}

export function registerVaultTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "vault_list",
    label: "Vault List",
    description: "List credential handles with redacted metadata only. Never returns secret values. Use this to discover what exists.",
    parameters: Type.Object({}),
    async execute() {
      revokeExpiredSessionGrants();
      const entries = listCredentials();
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      const items = entries.map(summarize);
      const text = items.length
        ? items.map((item) => {
          const entry = byId.get(item.id);
          const tag = entry && isEphemeral(entry) ? " | one-time, deleted after use" : "";
          return `- ${item.id} | ${item.label} | ${item.service} | ${item.host} | ${item.type} | fields=${item.fieldNames.join(",")}${tag}`;
        }).join("\n")
        : "Vault is empty. Use /vault-add to add a credential.";
      return textResult(text, { count: items.length, backend: peekBackend() });
    },
  });

  pi.registerTool({
    name: "vault_describe",
    label: "Vault Describe",
    description: "Describe one credential handle with metadata only. Never returns secret values.",
    parameters: Type.Object({ id: Type.String({ description: "Credential handle like cred_AB12CD34" }) }),
    async execute(_id, params) {
      const credential = getCredential(params.id);
      if (!credential) return errorResult("Unknown credential handle.");
      const summary = summarize(credential);
      return textResult(
        [`${summary.id} | ${summary.label}`, `service=${summary.service} host=${summary.host} type=${summary.type}`, `fields=${summary.fieldNames.join(", ")}`, `lastUsed=${summary.lastUsedAt ? new Date(summary.lastUsedAt).toLocaleString() : "never"}`].join("\n"),
        summary,
      );
    },
  });

  pi.registerTool({
    name: "vault_find",
    label: "Vault Find",
    description: "Discover exact and approximate service-name matches with optional exact host. Returns handles only; vault_request still requires exact service and host.",
    parameters: Type.Object({
      service: Type.String({ description: "Service name like convex or github" }),
      host: Type.Optional(Type.String({ description: "Host like github.com" })),
    }),
    async execute(_id, params) {
      const found = findServiceCandidates(params.service, params.host);
      const matches = found.map(summarize);
      const activeById = new Map(found.map((entry) => [entry.id, listGrants(entry.id).filter((grant) => !grant.revoked && grant.expiresAt > Date.now()).length]));
      const text = matches.length
        ? matches.map((item) => `- ${item.id} | ${item.label} | ${item.service} | ${item.host} | ${item.service.toLowerCase() === params.service.trim().toLowerCase() ? "exact" : "approximate"} | fields=${item.fieldNames.join(",")} | activeGrants=${activeById.get(item.id) ?? 0}`).join("\n")
        : `No credential found for service ${params.service}${params.host ? ` on ${params.host}` : ""}. Call vault_request to ask the user.`;
      return textResult(text, { matches });
    },
  });

  pi.registerTool({
    name: "vault_request",
    label: "Vault Request",
    description: "Human-facing credential request. Shows secure UI outside the transcript and returns a grant ID, never the secret. Call this when no handle or grant exists.",
    parameters: Type.Object({
      service: Type.String(),
      host: Type.String({ description: "Target host the credential is for, like github.com" }),
      operation: Type.Optional(Type.String({ description: "Operation like login or deploy" })),
      purpose: Type.Optional(Type.String({ description: "Why the agent needs it" })),
      suggestedLabel: Type.Optional(Type.String()),
      scope: Type.Optional(ScopeSchema),
      kind: Type.Optional(Type.Union([Type.Literal("token"), Type.Literal("login")])),
      tool: Type.Optional(Type.Union([Type.Literal("terminal"), Type.Literal("file")])),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const toolCtx = ctx as ExtensionContext;
      if (toolCtx.mode !== "tui") return errorResult("Vault request requires an interactive Pi TUI for masked secret entry and approval.");
      revokeExpiredSessionGrants();
      const existing = findByService(params.service, params.host);

      if (existing.length > 0 && toolCtx.hasUI) {
        const choices = [...existing.map((entry, index) => `${index + 1}. ${entry.id} — ${entry.label}`), "Enter a new value instead"];
        const picked = await toolCtx.ui.select(`Use an existing credential for ${params.host}?`, choices);
        if (!picked) throw new Error("Cancelled by user");
        if (!picked.startsWith("Enter")) {
          const pickedIndex = Number(picked.split(".")[0]) - 1;
          const selected = existing[pickedIndex];
          if (!selected) throw new Error("Unknown selection. Please try again.");
          const id = selected.id;
          const grant = await approveGrant(toolCtx, id, selected.fields.map((field) => field.name), params.host, params.operation ?? "use", params.tool ?? "terminal", params.scope);
          const scope = grant.scope;
          return textResult(`Granted ${id} for ${params.host}. Grant ${grant.grantId} scope=${scope} expires ${new Date(grant.expiresAt).toLocaleString()}. Pass the grant to vault_use_env. The secret was not revealed.`, { credentialId: id, grantId: grant.grantId, scope });
        }
      }

      if (!toolCtx.hasUI) return errorResult("Grant approval requires interactive UI. Ask the user to run vault_request in Pi.");
      const kind = params.kind ?? "token";
      const fields: Array<{ name: string; value: string; visibility: "agent-readable" | "inject-only" }> =
        kind === "login"
          ? await (async () => {
            const username = await toolCtx.ui.input(`Username for ${params.service} on ${params.host}:`);
            if (!username) throw new Error("Cancelled by user");
            const password = await maskedSecret(toolCtx, `Password for ${params.service} on ${params.host}${params.purpose ? ` (${params.purpose})` : ""}:`);
            if (!username || !password) throw new Error("Cancelled by user");
            return [
              { name: "username", value: username, visibility: "agent-readable" as const },
              { name: "password", value: password, visibility: "inject-only" as const },
            ];
          })()
          : await (async () => {
            const secret = await maskedSecret(toolCtx, `Secret for ${params.service} on ${params.host}${params.purpose ? ` (${params.purpose})` : ""}:`);
            if (!secret) throw new Error("Cancelled by user");
            return [{ name: "token", value: secret, visibility: "inject-only" as const }];
          })();
      const saveChoice = await toolCtx.ui.select("Save this credential?", ["Do not save — use once", "Save to vault"]);
      if (!saveChoice) throw new Error("Cancelled by user");

      if (saveChoice.startsWith("Do not")) {
        const temp = createCredential({
          label: params.suggestedLabel?.trim() || `${params.service} one-time`,
          service: params.service,
          host: params.host,
          type: kind,
          fields,
          createdBy: "agent-once",
        });
        try {
          const grant = await approveGrant(toolCtx, temp.id, fields.map((field) => field.name), params.host, params.operation ?? "use", params.tool ?? "terminal", "once");
          if (grant.scope !== "once") {
            revokeGrants({ grantId: grant.grantId });
            throw new Error("Unsaved credentials require once scope. Save the credential for a wider scope.");
          }
          return textResult(`One-time credential ${temp.id} ready. Grant ${grant.grantId} expires ${new Date(grant.expiresAt).toLocaleString()}. It is ephemeral and will be deleted automatically after first use or revoke. Fields: ${fields.map((field) => field.name).join(", ")}.`, { credentialId: temp.id, grantId: grant.grantId, scope: "once", saved: false, fields: fields.map((field) => field.name) });
        } catch (error) {
          deleteIfEphemeral(temp.id);
          throw error;
        }
      }

      const labelInput = await toolCtx.ui.input("Label for this credential:", params.suggestedLabel ?? `${params.service} ${params.host}`);
      if (labelInput === undefined) throw new Error("Cancelled by user");
      const approval = await chooseApproval(toolCtx, fields.map((field) => field.name), params.host, params.operation ?? "use", params.tool ?? "terminal", params.scope);
      const created = createCredential({
        label: labelInput.trim(),
        service: params.service,
        host: params.host,
        type: kind,
        fields,
        createdBy: "agent-request",
      });
      let grantId: string | undefined;
      try {
        const grant = issueGrant({ credentialId: created.id, target: params.host, operation: params.operation ?? "use", tool: params.tool ?? "terminal", ...approval });
        grantId = grant.grantId;
        const scope = grant.scope;
        logAudit({ at: Date.now(), credentialId: created.id, event: "created" });
        return textResult(`Saved ${created.id} (${created.label}). Grant ${grant.grantId} scope=${scope} expires ${new Date(grant.expiresAt).toLocaleString()}. The secret was not revealed.`, { credentialId: created.id, grantId: grant.grantId, scope, saved: true });
      } catch (error) {
        try {
          if (grantId) revokeGrants({ grantId });
        } finally {
          deleteCredential(created.id);
        }
        throw error;
      }
    },
  });

  pi.registerTool({
    name: "vault_use_env",
    label: "Vault Use Env",
    description: "Machine-facing use of an existing grant. Runs a command with secrets injected as env vars. Returns output only, never secret values.",
    parameters: Type.Object({
      grantId: Type.String(),
      credentialId: Type.String(),
      target: Type.String(),
      command: Type.String(),
      args: Type.Optional(Type.Array(Type.String())),
      envMap: Type.Record(Type.String(), Type.String(), { description: "Map of ENV_VAR to credential field name" }),
      operation: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const result = execWithEnv({ grantId: params.grantId, credentialId: params.credentialId, target: params.target, command: params.command, args: params.args ?? [], envMap: params.envMap, operation: params.operation, cwd: (ctx as ExtensionContext).cwd });
        return textResult(`exit=${result.exitCode}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`, { exitCode: result.exitCode });
      } catch {
        auditDeniedUse(params, "terminal");
        return errorResult("Vault operation denied or failed. Check the grant and destination.");
      }
    },
  });

  pi.registerTool({
    name: "vault_use_stdin",
    label: "Vault Use Stdin",
    description: "Run a command with one secret field piped to stdin for interactive password prompts. Returns output only.",
    parameters: Type.Object({
      grantId: Type.String(),
      credentialId: Type.String(),
      target: Type.String(),
      command: Type.String(),
      args: Type.Optional(Type.Array(Type.String())),
      field: Type.String({ description: "Credential field name to pipe" }),
      operation: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const result = execWithStdin({ grantId: params.grantId, credentialId: params.credentialId, target: params.target, command: params.command, args: params.args ?? [], field: params.field, operation: params.operation, cwd: (ctx as ExtensionContext).cwd });
        return textResult(`exit=${result.exitCode}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`, { exitCode: result.exitCode });
      } catch {
        auditDeniedUse(params, "terminal");
        return errorResult("Vault operation denied or failed. Check the grant and destination.");
      }
    },
  });

  pi.registerTool({
    name: "vault_write_env_file",
    label: "Vault Write Env File",
    description: "Write secrets to a file. Temporary writes are preferred. Permanent writes need a session or target grant.",
    parameters: Type.Object({
      grantId: Type.String(),
      credentialId: Type.String(),
      target: Type.String(),
      path: Type.String(),
      entries: Type.Record(Type.String(), Type.String()),
      persistent: Type.Optional(Type.Boolean()),
      operation: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const toolCtx = ctx as ExtensionContext;
      if (!toolCtx?.hasUI) {
        auditDeniedUse(params, "file");
        return errorResult("File write denied: interactive confirmation is required.");
      }
      try {
        const requested = resolve(toolCtx.cwd, params.path);
        // Show the actual parent directory, including existing symlinked parents.
        const confirmedParent = realpathSync(dirname(requested));
        const destination = join(confirmedParent, basename(requested));
        const keys = Object.keys(params.entries);
        if (!keys.length || keys.some((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
          auditDeniedUse(params, "file");
          return errorResult("File write denied: invalid or empty key list.");
        }
        const approved = await toolCtx.ui.confirm("Write vault secrets to a new file?", `Repo/cwd: ${toolCtx.cwd}\nResolved path: ${destination}\nKeys: ${keys.join(", ")}\n${params.persistent ? "Persistent plaintext file. It will remain on disk until you remove it." : "Plaintext file. Tracked for deletion at session shutdown; it may persist if Pi exits unexpectedly."}\nExisting paths and symlinks will not be overwritten.`);
        if (!approved) {
          auditDeniedUse(params, "file");
          return errorResult("File write declined by user.");
        }
        const result = writeTempEnvFile({ grantId: params.grantId, credentialId: params.credentialId, target: params.target, path: requested, expectedParent: confirmedParent, entries: params.entries, persistent: params.persistent ?? false, operation: params.operation });
        return textResult(`Wrote ${keys.length} entries to a new ${result.persistent ? "persistent" : "temporary"} plaintext file. Values and path are not shown.`);
      } catch {
        auditDeniedUse(params, "file");
        return errorResult("File write denied or failed. Check the grant and destination; existing files cannot be overwritten.");
      }
    },
  });

  pi.registerTool({
    name: "vault_request_reveal",
    label: "Vault Request Reveal",
    description: "Rare plaintext reveal of one named field. Always prompts the user. Denied by default unless confirmed. Prefer vault_use_env instead.",
    parameters: Type.Object({
      id: Type.String(),
      field: Type.String({ description: "Single field name to reveal" }),
      reason: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const toolCtx = ctx as ExtensionContext;
      const credential = getCredential(params.id);
      if (!credential) return errorResult("Unknown credential handle.");
      if (!toolCtx.hasUI) {
        logAudit({ at: Date.now(), credentialId: params.id, agent: "pi", event: "denied", result: "reveal without UI" });
        return errorResult("Reveal refused: no UI available to confirm.");
      }
      const ok = await toolCtx.ui.confirm("Reveal secret in plain text?", `${credential.label} (${credential.host}), field ${params.field}. ${params.reason ?? "The agent asked to see the raw value."} Prefer injection instead. This value will stay in the transcript.`);
      if (!ok) {
        logAudit({ at: Date.now(), credentialId: params.id, agent: "pi", event: "denied", result: "reveal declined" });
        return errorResult("Reveal declined by user.");
      }
      try {
        const value = getFieldValue(credential, params.field);
        logAudit({ at: Date.now(), credentialId: params.id, agent: "pi", event: "revealed", target: credential.host, result: `field ${params.field}: ${params.reason ?? "manual reveal"}` });
        return textResult("Revealed. Rotate this secret if it was shown unnecessarily.", { id: credential.id, field: params.field, value });
      } catch {
        return errorResult("Reveal failed. Check the credential and field.");
      }
    },
  });

  pi.registerTool({
    name: "vault_grants",
    label: "Vault Grants",
    description: "List active grants, optionally filtered by credential. Shows scope and expiry, never values.",
    parameters: Type.Object({ credentialId: Type.Optional(Type.String()) }),
    async execute(_id, params) {
      revokeExpiredSessionGrants();
      const grants = listGrants(params.credentialId).filter((grant) => !grant.revoked && grant.expiresAt > Date.now());
      const text = grants.length
        ? grants.map((grant) => `- ${grant.grantId} | ${grant.credentialId} | ${grant.target} | ${grant.tool} | ${grant.scope} | uses=${grant.useCount} | expires=${new Date(grant.expiresAt).toLocaleString()}`).join("\n")
        : "No active grants.";
      return textResult(text, { count: grants.length });
    },
  });

  pi.registerTool({
    name: "vault_revoke",
    label: "Vault Revoke",
    description: "Revoke grants by grant ID, credential ID, or all. Revoking Takomi permission does not invalidate the real credential at the provider.",
    parameters: Type.Object({
      grantId: Type.Optional(Type.String()),
      credentialId: Type.Optional(Type.String()),
      all: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, params) {
      const grantCredentialId = params.grantId && !params.credentialId && !params.all
        ? listGrants().find((grant) => grant.grantId === params.grantId)?.credentialId
        : undefined;
      const revoked = revokeGrants({ grantId: params.grantId, credentialId: params.credentialId, all: params.all });
      let removed: string[] = [];
      if (params.credentialId) {
        if (deleteIfEphemeral(params.credentialId)) removed = [params.credentialId];
      } else if (params.all) {
        removed = listCredentials().filter(isEphemeral).map((entry) => entry.id);
        for (const id of removed) {
          deleteCredential(id);
          try { logAudit({ at: Date.now(), credentialId: id, event: "deleted", result: "one-time credential auto-removed on revoke-all" }); }
          catch { /* Keep removing ephemeral credentials even when audit is unavailable. */ }
        }
      } else if (grantCredentialId && deleteIfEphemeral(grantCredentialId)) {
        removed = [grantCredentialId];
        try { logAudit({ at: Date.now(), credentialId: grantCredentialId, event: "deleted" }); }
        catch { /* Grant revoked and ephemeral credential deleted; audit is best-effort. */ }
      }
      const removedNote = removed.length ? ` Ephemeral credential(s) ${removed.join(", ")} were deleted.` : "";
      return textResult(`Revoked ${revoked.length} grant(s).${removedNote} This removes Takomi permission only. It does not invalidate the real API key or password at the provider.`, { revoked: revoked.length, removed });
    },
  });
}
