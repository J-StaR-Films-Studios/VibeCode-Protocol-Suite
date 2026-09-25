import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { logAudit, readAudit } from "./audit.ts";
import { getBackend } from "./crypto-store.ts";
import { listGrants, revokeGrants } from "./grant-store.ts";
import { exportVault, importVault } from "./transfer.ts";
import { maskedSecret } from "./secret-input.ts";
import { createCredential, deleteCredential, deleteIfEphemeral, findServiceCandidates, getCredential, isEphemeral, listCredentials, renameCredential, summarize } from "./vault-store.ts";

function parseArgs(args: string): string[] {
  return args.trim().split(/\s+/).map((value) => value.trim()).filter(Boolean);
}

function notify(ctx: ExtensionCommandContext, text: string, level: "info" | "error" | "warning" = "info") {
  if (ctx.hasUI) ctx.ui.notify(text, level);
}

async function pickCredential(ctx: ExtensionCommandContext, requestedId?: string, title = "Choose a credential"): Promise<string> {
  const items = listCredentials();
  if (items.length === 0) throw new Error("Vault is empty. Use /vault-add first.");
  if (requestedId) {
    const matched = items.find((entry) => entry.id === requestedId);
    if (!matched) throw new Error(`Unknown credential: ${requestedId}`);
    return matched.id;
  }
  if (!ctx.hasUI) throw new Error("Credential id required without UI.");
  const choices = items.map((entry, index) => `${index + 1}. ${entry.id} — ${entry.label} — ${entry.host}`);
  const choice = await ctx.ui.select(title, choices);
  if (!choice) throw new Error("Cancelled by user");
  const selected = items[Number(choice.split(".")[0]) - 1];
  if (!selected) throw new Error("Unknown selection. Please try again.");
  return selected.id;
}

function formatAudit(entry: ReturnType<typeof readAudit>[number]): string {
  return `- ${new Date(entry.at).toLocaleString()} ${entry.event} ${[entry.credentialId, entry.grantId, entry.scope, entry.tool, entry.operation, entry.target].filter(Boolean).join(" | ")}`.trim();
}

export function registerVaultCommands(pi: ExtensionAPI) {
  pi.registerCommand("vault-export", {
    description: "Export an encrypted vault archive for offline transfer (human UI only)",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui" || !ctx.hasUI) throw new Error("Vault transfer requires an interactive Pi TUI.");
      if (!args?.trim()) throw new Error("Usage: /vault-export <path>");
      const destination = resolve(ctx.cwd, args.trim());
      let parent: string;
      try { parent = realpathSync(dirname(destination)); } catch { throw new Error("Vault export failed. Check the destination directory."); }
      const approved = await ctx.ui.confirm("Export vault?", `Destination: ${destination}\nThis creates a new encrypted file. The 256-bit transfer key will appear once in this UI. Keep the file and key separately; copies of both can be reused offline. Continue?`);
      if (!approved) return;
      let key: string;
      try { key = exportVault(destination, parent); }
      catch { throw new Error("Vault export failed. Check the destination and existing file; nothing was overwritten."); }
      ctx.ui.notify(`Encrypted vault saved to ${destination}. Copy this transfer key now; it will not be shown again:\n${key}`, "info");
    },
  });

  pi.registerCommand("vault-import", {
    description: "Import an encrypted vault archive into a new empty vault (human UI only)",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") throw new Error("Vault import requires an interactive Pi TUI for masked transfer key entry.");
      if (!args?.trim()) throw new Error("Usage: /vault-import <path>");
      const source = resolve(ctx.cwd, args.trim());
      const approved = await ctx.ui.confirm("Import vault?", `Source: ${source}\nOnly a new vault with no vault.json, key.json, or grants.json can accept an import. Credential fields will be encrypted with a new local key. Continue?`);
      if (!approved) return;
      const key = await maskedSecret(ctx, "Transfer key (64 hex characters):");
      if (!key) return;
      try {
        const count = importVault(source, key.trim());
        notify(ctx, `Imported ${count} credential(s). Grants were not imported.`);
      } catch { throw new Error("Vault import failed. Check the archive, transfer key, and empty destination vault."); }
    },
  });

  pi.registerCommand("vault-add", {
    description: "Add a credential to the Takomi vault through secure prompts",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") throw new Error("Vault add requires an interactive Pi TUI for masked secret entry.");
      const [serviceArg, hostArg] = parseArgs(args || "");
      const service = serviceArg ?? (ctx.hasUI ? await ctx.ui.input("Service:", "github") : undefined);
      const host = hostArg ?? (ctx.hasUI ? await ctx.ui.input("Host:", "github.com") : undefined);
      if (!service || !host) throw new Error("Service and host are required.");
      if (!ctx.hasUI) throw new Error("Interactive add needs UI. Use the vault_request tool instead.");
      const kind = await ctx.ui.select("Credential type", ["token — single API key or token", "login — username plus password"]);
      if (!kind) throw new Error("Cancelled by user");
      const label = (await ctx.ui.input("Label:", `${service} ${host}`))?.trim() || `${service} ${host}`;
      if (kind.startsWith("login")) {
        const username = await ctx.ui.input("Username:");
        const password = await maskedSecret(ctx, "Password:");
        if (!username || !password) throw new Error("Cancelled by user");
        const created = createCredential({
          label, service, host, type: "login",
          fields: [
            { name: "username", value: username, visibility: "agent-readable" },
            { name: "password", value: password, visibility: "inject-only" },
          ],
        });
        logAudit({ at: Date.now(), credentialId: created.id, event: "created", result: "manual add" });
        notify(ctx, `Saved ${created.id} (${created.label}). Values are encrypted with backend ${getBackend()}.`);
        return;
      }
      const token = await maskedSecret(ctx, "Token:");
      if (!token) throw new Error("Cancelled by user");
      const created = createCredential({
        label, service, host, type: "token",
        fields: [{ name: "token", value: token, visibility: "inject-only" }],
      });
      logAudit({ at: Date.now(), credentialId: created.id, event: "created", result: "manual add" });
      notify(ctx, `Saved ${created.id} (${created.label}). Values are encrypted with backend ${getBackend()}.`);
    },
  });

  pi.registerCommand("vault-list", {
    description: "List vault credentials with redacted metadata",
    handler: async (_args, ctx) => {
      const items = listCredentials().map(summarize);
      if (!items.length) {
        notify(ctx, "Vault is empty. Use /vault-add.");
        return;
      }
      const entries = listCredentials();
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      notify(ctx, [`Backend: ${getBackend()}`, "", ...items.map((item) => {
        const entry = byId.get(item.id);
        const tag = entry && isEphemeral(entry) ? " | one-time, deleted after use" : "";
        return `- ${item.id} | ${item.label} | ${item.service} | ${item.host} | ${item.type} | fields=${item.fieldNames.join(",")}${tag}`;
      })].join("\n"));
    },
  });

  pi.registerCommand("vault-describe", {
    description: "Describe one credential with metadata only",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      const credentialId = await pickCredential(ctx, id);
      const credential = getCredential(credentialId);
      if (!credential) throw new Error(`Unknown credential: ${credentialId}`);
      const summary = summarize(credential);
      const grants = listGrants(credentialId).filter((grant) => !grant.revoked && grant.expiresAt > Date.now());
      notify(ctx, [
        `${summary.id} | ${summary.label}`,
        `service=${summary.service} host=${summary.host} type=${summary.type}`,
        `fields=${summary.fieldNames.join(", ")}`,
        `lastUsed=${summary.lastUsedAt ? new Date(summary.lastUsedAt).toLocaleString() : "never"}`,
        `activeGrants=${grants.length}`,
        ...grants.map((grant) => `  - ${grant.grantId} ${grant.scope} expires ${new Date(grant.expiresAt).toLocaleString()}`),
      ].join("\n"));
    },
  });

  pi.registerCommand("vault-rename", {
    description: "Rename a vault credential",
    handler: async (args, ctx) => {
      const [id, ...labelParts] = parseArgs(args || "");
      const credentialId = await pickCredential(ctx, id, "Choose credential to rename");
      const current = getCredential(credentialId);
      let label = labelParts.join(" ").trim();
      if (!label && ctx.hasUI) label = (await ctx.ui.input("New label:", current?.label ?? ""))?.trim() ?? "";
      if (!label) throw new Error("Label cannot be empty.");
      renameCredential(credentialId, label);
      logAudit({ at: Date.now(), credentialId, event: "renamed", result: label });
      notify(ctx, `Renamed ${credentialId} to ${label}.`);
    },
  });

  pi.registerCommand("vault-delete", {
    description: "Delete a vault credential and revoke its grants",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      const credentialId = await pickCredential(ctx, id, "Choose credential to delete");
      const credential = getCredential(credentialId);
      if (ctx.hasUI) {
        const ok = await ctx.ui.confirm("Delete credential?", `Delete ${credentialId} (${credential?.label})? This removes it from Takomi and revokes its grants. It does not invalidate the real key at the provider.`);
        if (!ok) throw new Error("Cancelled by user");
      }
      revokeGrants({ credentialId });
      deleteCredential(credentialId);
      logAudit({ at: Date.now(), credentialId, event: "deleted", result: "manual delete" });
      notify(ctx, `Deleted ${credentialId}. Remember: the real key at the provider is still valid until you rotate it there.`);
    },
  });

  pi.registerCommand("vault-status", {
    description: "Show vault backend, counts, active grants, and recent audit",
    handler: async (_args, ctx) => {
      const items = listCredentials();
      const grants = listGrants().filter((grant) => !grant.revoked && grant.expiresAt > Date.now());
      const audit = readAudit(8);
      notify(ctx, [
        `Backend: ${getBackend()}`,
        `Credentials: ${items.length} | active grants: ${grants.length}`,
        "",
        "Recent activity (no values):",
        ...audit.map(formatAudit),
      ].join("\n"));
    },
  });

  pi.registerCommand("vault-revoke", {
    description: "Revoke grants by grant id, credential id, or all",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      if (id === "all") {
        const revoked = revokeGrants({ all: true });
        const removed = listCredentials().filter(isEphemeral).map((entry) => entry.id);
        for (const ephemeralId of removed) {
          deleteCredential(ephemeralId);
          try { logAudit({ at: Date.now(), credentialId: ephemeralId, event: "deleted", result: "one-time credential auto-removed on revoke-all" }); }
          catch { /* Keep removing ephemeral credentials even when audit is unavailable. */ }
        }
        notify(ctx, `Revoked ${revoked.length} grant(s).${removed.length ? ` Deleted ephemeral credential(s) ${removed.join(", ")}.` : ""}`);
        return;
      }
      const grants = listGrants();
      const matchGrant = id ? grants.find((grant) => grant.grantId === id) : undefined;
      if (matchGrant) {
        revokeGrants({ grantId: id });
        const removed = deleteIfEphemeral(matchGrant.credentialId);
        notify(ctx, `Revoked grant ${id}.${removed ? ` Deleted ephemeral credential ${matchGrant.credentialId}.` : ""}`);
        return;
      }
      if (!id) {
        notify(ctx, "Usage: /vault-revoke <grant-id | credential-id | all>. Bare revoke-all is refused; pass all explicitly.", "warning");
        return;
      }
      const credentialId = await pickCredential(ctx, id, "Choose credential to revoke");
      const revoked = revokeGrants({ credentialId });
      const removed = deleteIfEphemeral(credentialId);
      notify(ctx, `Revoked ${revoked.length} grant(s) for ${credentialId}.${removed ? " Deleted ephemeral one-time credential." : ""}`);
    },
  });

  pi.registerCommand("vault-audit", {
    description: "Show redacted activity for one credential",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      if (id && !/^cred_[A-F0-9]{32}$/.test(id)) throw new Error("Invalid credential handle.");
      const credentialId = id ?? await pickCredential(ctx, undefined, "Choose credential for audit");
      const events = readAudit(50, credentialId);
      notify(ctx, events.length
        ? events.map(formatAudit).join("\n")
        : `No recorded activity for ${credentialId}.`);
    },
  });

  pi.registerCommand("vault-find", {
    description: "Find credential handles by service and host",
    handler: async (args, ctx) => {
      const [service, host] = parseArgs(args || "");
      if (!service) {
        notify(ctx, "Usage: /vault-find <service> [host]", "warning");
        return;
      }
      const matches = findServiceCandidates(service, host);
      if (!matches.length) {
        notify(ctx, `No credential found for ${service}${host ? ` on ${host}` : ""}.`);
        return;
      }
      notify(ctx, matches.map((entry) => `- ${entry.id} | ${entry.label} | ${entry.service} | ${entry.host}${entry.service.toLowerCase() === service.toLowerCase() ? "" : " | approximate"}`).join("\n"));
    },
  });
}
