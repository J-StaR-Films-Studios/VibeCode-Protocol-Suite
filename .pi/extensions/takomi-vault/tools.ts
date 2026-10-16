import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execWithEnv, execWithStdin, writeTempEnvFile } from "./adapters.ts";
import { logAudit } from "./audit.ts";
import { peekBackend } from "./crypto-store.ts";
import { maskedSecret, supportsSecretEntry, vaultSecretInvocation } from "./secret-input.ts";
import { issueGrant, listGrants, revokeExpiredSessionGrants, revokeGrants } from "./grant-store.ts";
import { createCredential, deleteCredential, deleteIfEphemeral, findByService, findServiceCandidates, getCredential, getFieldValue, isEphemeral, listCredentials, summarize } from "./vault-store.ts";
import { VaultOperationError, type CredentialGrant, type GrantScope, type StoredCredential } from "./types.ts";

const ScopeSchema = Type.Union([Type.Literal("once"), Type.Literal("turn"), Type.Literal("session"), Type.Literal("target")]);
const FieldSpec = Type.Object({
  name: Type.String({ description: "Stored field name, such as GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. No value here." }),
  visibility: Type.Optional(Type.Union([Type.Literal("inject-only"), Type.Literal("agent-readable")], { description: "Defaults to inject-only. Use agent-readable only if the agent must see the value." })),
});
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

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
  try {
    logAudit({ at: Date.now(), credentialId: params.credentialId, grantId: params.grantId, agent: "pi", event: "denied", tool,
      ...(grant ? { target: grant.target, operation: grant.operation } : {}) });
  } catch {
    // An audit failure must not replace a classified or redacted operation error.
  }
}

function operationFailure(error: unknown) {
  return error instanceof VaultOperationError
    ? errorResult(error.publicMessage, { reason: error.reason })
    : errorResult("Vault operation failed. No private error details are shown.");
}

function grantedResult(grant: CredentialGrant, credential: StoredCredential) {
  const ephemeral = isEphemeral(credential);
  const details = {
    credentialId: grant.credentialId, grantId: grant.grantId,
    target: grant.target, tool: grant.tool, operation: grant.operation,
    fields: grant.fields ?? credential.fields.map((field) => field.name),
    scope: grant.scope, expiresAt: grant.expiresAt, useCount: grant.useCount,
    policyVersion: grant.policyVersion ?? 1, operationMeaning: grant.policyVersion === 2 ? "purpose only" : "exact operation required",
    saved: !ephemeral, ephemeral,
  };
  const usage = grant.tool === "file"
    ? "Use vault_write_env_file. Temporary writes are preferred; persistent writes require session or target scope."
    : "Use vault_use_env or vault_use_stdin.";
  return textResult(`Granted ${details.credentialId}. Grant ${details.grantId} target=${details.target} tool=${details.tool} operation=${JSON.stringify(details.operation)} fields=${details.fields.join(", ")} scope=${details.scope} expires=${new Date(details.expiresAt).toISOString()} uses=${details.useCount}. ${usage} Pass this target host. ${grant.policyVersion === 2 ? "Operation is purpose only, not an exact-text restriction. Reuse this grant through the use tools until expiry or revoke. Credential access does not approve other actions." : "Legacy grant: pass the exact issued operation."} ${details.ephemeral ? "Unsaved, deleted after first use or revoke." : "Saved in the vault."} Values were not revealed.`, details);
}

function nativeOwner(ctx: ExtensionContext): string | undefined {
  try {
    const id = ctx.sessionManager.getSessionId();
    return typeof id === "string" && id.trim().length > 0 && id.length <= 256 && !/\p{Cc}/u.test(id) ? id : undefined;
  } catch { return undefined; }
}

function applicability(grant: CredentialGrant, owner?: string): string {
  if (grant.expiresAt <= Date.now()) return "expired";
  if (grant.revoked) return "revoked";
  if (grant.scope === "once" && grant.useCount >= 1) return "spent";
  if (grant.scope === "turn" || grant.scope === "session") {
    if (grant.policyVersion !== 2) return "legacy-reapproval";
    if (!owner) return "owner-unavailable";
    if (owner !== grant.ownerSessionId) return "other-chat";
  }
  return "usable-here";
}

async function promptScope(ctx: ExtensionContext, target: string, tool: string, fields: string[], requested?: GrantScope, unsaved = false): Promise<GrantScope> {
  if (unsaved) {
    const choice = await ctx.ui.select(`Unsaved credential: allow one ${tool} attempt on ${target} within 5 minutes, using ${fields.join(", ")}?`, ["Allow once, 5 minutes", "Cancel"]);
    if (choice !== "Allow once, 5 minutes") throw new Error("Cancelled by user");
    return "once";
  }
  let persisted = false;
  try { persisted = Boolean(ctx.sessionManager.getSessionFile()); } catch { /* Do not promise resume without persistence. */ }
  const scopes: GrantScope[] = ["session", "once", "turn", "target"];
  const durations = [
    `session: This chat, up to 12 hours${persisted ? ", including ordinary restarts" : ". Unsaved chat, cannot resume after exit"}`,
    "once: One attempt within 5 minutes",
    "turn: 15 minutes in this chat",
    "target: Remember for 30 days across chats using this Vault",
  ];
  const options = durations.map((option, index) => requested === scopes[index] ? `${option} (requested by agent)` : option);
  const choice = await ctx.ui.select(`Allow Pi ${tool} access to ${fields.join(", ")} on ${target}? Revoke any time. This does not approve deployments, deletion or other actions.`, options);
  const index = choice === undefined ? -1 : options.indexOf(choice);
  if (index < 0) throw new Error("Cancelled by user");
  return scopes[index];
}

async function chooseApproval(ctx: ExtensionContext, fieldNames: string[], target: string, operation: string, tool: "terminal" | "file", requested?: GrantScope, unsaved = false, checkCurrent: () => void = () => {}) {
  const action = operation === "use" ? "use credentials" : operation;
  const selected = await ctx.ui.select(`Purpose: ${action}. Credential access on ${target} via ${tool}. Choose fields:`, ["All fields", ...fieldNames]);
  checkCurrent();
  if (!selected || !["All fields", ...fieldNames].includes(selected)) throw new Error("Cancelled by user");
  const fields = selected === "All fields" ? fieldNames : [selected];
  const scope = await promptScope(ctx, target, tool, fields, requested, unsaved);
  checkCurrent();
  const ownerSessionId = nativeOwner(ctx);
  if ((scope === "session" || scope === "turn") && !ownerSessionId) throw new VaultOperationError("owner_unavailable");
  return { fields, scope, ...((scope === "session" || scope === "turn") ? { ownerSessionId } : {}) };
}

async function approveGrant(ctx: ExtensionContext, credentialId: string, fieldNames: string[], target: string, operation: string, tool: "terminal" | "file", requested?: GrantScope, unsaved = false, checkCurrent: () => void = () => {}) {
  const approval = await chooseApproval(ctx, fieldNames, target, operation, tool, requested, unsaved, checkCurrent);
  checkCurrent();
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
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const found = findServiceCandidates(params.service, params.host);
      const matches = found.map(summarize);
      const activeById = new Map(found.map((entry) => [entry.id, listGrants(entry.id).filter((grant) => !grant.revoked && grant.expiresAt > Date.now())]));
      const text = matches.length
        ? matches.map((item) => `- ${item.id} | ${item.label} | ${item.service} | ${item.host} | ${item.service.toLowerCase() === params.service.trim().toLowerCase() ? "exact" : "approximate"} | fields=${item.fieldNames.join(",")} | unexpiredGrants=${activeById.get(item.id)?.length ?? 0} | usableHere=${activeById.get(item.id)?.filter((grant) => applicability(grant, nativeOwner(ctx)) === "usable-here").length ?? 0}`).join("\n")
        : `No credential found for service ${params.service}${params.host ? ` on ${params.host}` : ""}. Call vault_request to ask the user.`;
      return textResult(text, { matches });
    },
  });

  pi.registerTool({
    name: "vault_request",
    label: "Vault Request",
    description: "Ask the user to enter credential values privately. Explain what to enter and why before opening the form when possible. For OAuth or other non-login credentials, set fields to their real names (for example GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET). Use kind for ordinary token or login requests rather than inventing field prefixes. Never include values in this call or chat. Fields default to inject-only. Returns a grant ID.",
    parameters: Type.Object({
      service: Type.String(),
      host: Type.String({ description: "Target host the credential is for, like github.com" }),
      operation: Type.Optional(Type.String({ description: "Purpose of credential access, like login. New grants do not require an exact operation string and do not approve other actions." })),
      purpose: Type.Optional(Type.String({ description: "Explain which credential or value is needed and why in one or two short, plain-language sentences, not technical mechanics. Never include secret values." })),
      suggestedLabel: Type.Optional(Type.String()),
      scope: Type.Optional(ScopeSchema),
      kind: Type.Optional(Type.Union([Type.Literal("token"), Type.Literal("login")], { description: "Legacy shortcut: token asks for one token; login asks for actual username and password. Use fields for other credentials." })),
      fields: Type.Optional(Type.Array(FieldSpec, { minItems: 1, maxItems: 8, description: "Field names to request privately from the human. Never pass field values." })),
      tool: Type.Optional(Type.Union([Type.Literal("terminal"), Type.Literal("file")])),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const toolCtx = ctx;
      if (!supportsSecretEntry(toolCtx) ||
        (toolCtx.mode === "rpc" && process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY !== "1")) {
        return errorResult("Vault request requires an interactive Pi TUI or a supported RPC ownership transport for private entry and approval.");
      }
      revokeExpiredSessionGrants();
      const requestedNames = params.fields?.map((field) => field.name);
      if (requestedNames && (requestedNames.length < 1 || requestedNames.length > 8 ||
        requestedNames.some((name) => !FIELD_NAME.test(name)) ||
        new Set(requestedNames.map((name) => name.toLowerCase())).size !== requestedNames.length)) {
        return errorResult("Use 1–8 distinct field names made of letters, digits, and underscores. Names must start with a letter or underscore.");
      }
      const owner = nativeOwner(toolCtx);
      const invocation = vaultSecretInvocation(pi, toolCtx, toolCallId, signal);
      const checkCurrent = () => {
        if (signal?.aborted || invocation.signal.aborted || nativeOwner(toolCtx) !== owner) throw new VaultOperationError("approval_cancelled");
      };
      try {
        checkCurrent();
        if (params.purpose) toolCtx.ui.notify(`Credential access purpose: ${params.purpose}`, "info");
        const existing = findByService(params.service, params.host).filter((entry) =>
          !params.fields || (entry.fields.length === params.fields.length &&
            params.fields.every(({ name, visibility }) => entry.fields.some((field) =>
              field.name === name && (visibility === undefined || field.visibility === visibility)))));

        if (existing.length > 0 && toolCtx.hasUI) {
          const choices = [...existing.map((entry, index) => `${index + 1}. ${entry.id} — ${entry.label}`), "Enter a new value instead"];
          const picked = await toolCtx.ui.select(`Use an existing credential for ${params.host}?`, choices);
          checkCurrent();
          if (!picked || !choices.includes(picked)) throw new Error("Cancelled by user");
          if (picked !== "Enter a new value instead") {
            const pickedIndex = Number(picked.split(".")[0]) - 1;
            const selected = existing[pickedIndex];
            if (!selected) throw new Error("Unknown selection. Please try again.");
            const id = selected.id;
            const grant = await approveGrant(toolCtx, id, selected.fields.map((field) => field.name), params.host, params.operation ?? "use", params.tool ?? "terminal", params.scope, isEphemeral(selected), checkCurrent);
            return grantedResult(grant, selected);
          }
        }

        if (!toolCtx.hasUI) return errorResult("Grant approval requires interactive UI. Ask the user to run vault_request in Pi.");
        const kind = params.kind ?? "token";
        const requestedFields = params.fields ?? (kind === "login"
          ? [{ name: "username", visibility: "agent-readable" as const }, { name: "password", visibility: "inject-only" as const }]
          : [{ name: "token", visibility: "inject-only" as const }]);
        const fields: Array<{ name: string; value: string; visibility: "agent-readable" | "inject-only" }> = [];
        for (const field of requestedFields) {
          // Only public request metadata, never stored or entered values, labels or native titles.
          const value = await maskedSecret(toolCtx, `${field.name} for ${params.service} on ${params.host}:`, invocation, {
            fieldName: field.name,
            service: params.service.trim(),
            host: params.host.trim(),
            ...(params.purpose === undefined ? {} : { purpose: params.purpose.trim() }),
          });
          checkCurrent();
          if (!value) throw new Error("Cancelled by user");
          fields.push({ name: field.name, value, visibility: field.visibility ?? "inject-only" });
        }
        const saveChoice = await toolCtx.ui.select("Save this credential?", ["Do not save — use once", "Save to vault"]);
        checkCurrent();
        if (saveChoice !== "Do not save — use once" && saveChoice !== "Save to vault") throw new Error("Cancelled by user");

        if (saveChoice === "Do not save — use once") {
          const temp = createCredential({
            label: params.suggestedLabel?.trim() || `${params.service} one-time`,
            service: params.service,
            host: params.host,
            type: kind,
            fields,
            createdBy: "agent-once",
          });
          try {
            const grant = await approveGrant(toolCtx, temp.id, fields.map((field) => field.name), params.host, params.operation ?? "use", params.tool ?? "terminal", "once", true, checkCurrent);
            return grantedResult(grant, temp);
          } catch (error) {
            deleteIfEphemeral(temp.id);
            throw error;
          }
        }

        const labelInput = await toolCtx.ui.input("Label for this credential:", params.suggestedLabel ?? `${params.service} ${params.host}`);
        checkCurrent();
        if (labelInput === undefined) throw new Error("Cancelled by user");
        const approval = await chooseApproval(toolCtx, fields.map((field) => field.name), params.host, params.operation ?? "use", params.tool ?? "terminal", params.scope, false, checkCurrent);
        checkCurrent();
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
          logAudit({ at: Date.now(), credentialId: created.id, event: "created" });
          return grantedResult(grant, created);
        } catch (error) {
          try {
            if (grantId) revokeGrants({ grantId });
          } finally {
            deleteCredential(created.id);
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof VaultOperationError) return operationFailure(error);
        throw error;
      } finally {
        invocation.dispose();
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
      target: Type.String({ description: "Approved target host returned by vault_request, such as github.com. Not the tool name terminal or file." }),
      command: Type.String(),
      args: Type.Optional(Type.Array(Type.String())),
      envMap: Type.Record(Type.String(), Type.String(), { description: "Map environment variable names to approved stored field names, not secret values." }),
      operation: Type.Optional(Type.String({ description: "Purpose only for new grants. Legacy grants require the exact issued operation; omitted means use." })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const result = execWithEnv({ grantId: params.grantId, credentialId: params.credentialId, target: params.target, command: params.command, args: params.args ?? [], envMap: params.envMap, operation: params.operation, ownerSessionId: nativeOwner(ctx), cwd: ctx.cwd });
        return textResult(`exit=${result.exitCode}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`, { exitCode: result.exitCode });
      } catch (error) {
        auditDeniedUse(params, "terminal");
        return operationFailure(error);
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
      target: Type.String({ description: "Approved target host returned by vault_request, such as github.com. Not the tool name terminal or file." }),
      command: Type.String(),
      args: Type.Optional(Type.Array(Type.String())),
      field: Type.String({ description: "Approved stored credential field name to pipe, not its value." }),
      operation: Type.Optional(Type.String({ description: "Purpose only for new grants. Legacy grants require the exact issued operation; omitted means use." })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const result = execWithStdin({ grantId: params.grantId, credentialId: params.credentialId, target: params.target, command: params.command, args: params.args ?? [], field: params.field, operation: params.operation, ownerSessionId: nativeOwner(ctx), cwd: ctx.cwd });
        return textResult(`exit=${result.exitCode}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`, { exitCode: result.exitCode });
      } catch (error) {
        auditDeniedUse(params, "terminal");
        return operationFailure(error);
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
      target: Type.String({ description: "Approved target host returned by vault_request, such as github.com. Not the tool name terminal or file." }),
      path: Type.String(),
      entries: Type.Record(Type.String(), Type.String(), { description: "Map environment variable names to approved stored field names, not secret values." }),
      persistent: Type.Optional(Type.Boolean()),
      operation: Type.Optional(Type.String({ description: "Purpose only for new grants. Legacy grants require the exact issued operation; omitted means use." })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const toolCtx = ctx;
      if (!toolCtx?.hasUI) {
        auditDeniedUse(params, "file");
        return errorResult("File write denied: interactive confirmation is required.");
      }
      const owner = nativeOwner(toolCtx);
      const invocation = vaultSecretInvocation(pi, toolCtx, toolCallId, signal);
      try {
        if (invocation.signal.aborted) throw new VaultOperationError("approval_cancelled");
        const requested = resolve(toolCtx.cwd, params.path);
        // Show the actual parent directory, including existing symlinked parents.
        let confirmedParent: string;
        try {
          confirmedParent = realpathSync(dirname(requested));
        } catch (error) {
          if (error !== null && typeof error === "object" && "code" in error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") throw new VaultOperationError("parent_missing");
            if (error.code === "EACCES" || error.code === "EPERM") throw new VaultOperationError("parent_access");
          }
          throw error;
        }
        const destination = join(confirmedParent, basename(requested));
        const keys = Object.keys(params.entries);
        if (!keys.length || keys.some((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
          auditDeniedUse(params, "file");
          return errorResult("File write denied: invalid or empty key list.");
        }
        const approved = await toolCtx.ui.confirm("Write vault secrets to a new file?", `Repo/cwd: ${toolCtx.cwd}\nResolved path: ${destination}\nKeys: ${keys.join(", ")}\n${params.persistent ? "Persistent plaintext file. It will remain on disk until you remove it." : "Plaintext file. Tracked for deletion at session shutdown; it may persist if Pi exits unexpectedly."}\nExisting paths and symlinks will not be overwritten.`);
        if (signal?.aborted || invocation.signal.aborted || nativeOwner(toolCtx) !== owner) throw new VaultOperationError("approval_cancelled");
        if (!approved) {
          auditDeniedUse(params, "file");
          return errorResult("File write declined by user.");
        }
        const result = writeTempEnvFile({ grantId: params.grantId, credentialId: params.credentialId, target: params.target, path: requested, expectedParent: confirmedParent, entries: params.entries, persistent: params.persistent ?? false, operation: params.operation, ownerSessionId: nativeOwner(toolCtx) });
        return textResult(`Wrote ${keys.length} entries to a new ${result.persistent ? "persistent" : "temporary"} plaintext file. Values and path are not shown.`);
      } catch (error) {
        auditDeniedUse(params, "file");
        return operationFailure(error);
      } finally {
        invocation.dispose();
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
    description: "List grants with expiry, spent, revoked and current-chat applicability. New operation text is purpose only; legacy operation text must match exactly. Never returns values or owner IDs.",
    parameters: Type.Object({ credentialId: Type.Optional(Type.String()) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const grants = listGrants(params.credentialId);
      const owner = nativeOwner(ctx);
      const items = grants.map((grant) => {
        const credential = getCredential(grant.credentialId);
        const fields = grant.fields ?? credential?.fields.map((field) => field.name);
        return {
          credentialId: grant.credentialId, grantId: grant.grantId,
          target: grant.target, tool: grant.tool, operation: grant.operation,
          fields, allFields: grant.fields === undefined,
          scope: grant.scope, expiresAt: grant.expiresAt, useCount: grant.useCount,
          policyVersion: grant.policyVersion ?? 1,
          operationMeaning: grant.policyVersion === 2 ? "purpose only" : "exact operation required",
          status: applicability(grant, owner),
          usableHere: applicability(grant, owner) === "usable-here",
          ...(credential ? { saved: !isEphemeral(credential), ephemeral: isEphemeral(credential) } : {}),
        };
      });
      const text = items.length
        ? items.map((grant) => `- ${grant.grantId} | ${grant.credentialId} | target=${grant.target} | tool=${grant.tool} | operation=${JSON.stringify(grant.operation)} (${grant.operationMeaning}) | fields=${grant.fields?.join(",") ?? "all credential fields"} | ${grant.scope} | ${grant.status} | uses=${grant.useCount} | expires=${new Date(grant.expiresAt).toISOString()}`).join("\n")
        : "No grants.";
      return textResult(text, { count: items.length, grants: items });
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
