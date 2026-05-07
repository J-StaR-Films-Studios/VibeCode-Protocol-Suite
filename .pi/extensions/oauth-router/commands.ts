import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { createAccountFromUpstream } from "./oauth-flow.ts";
import type { RouterStatusRow, RoutingPolicyName } from "./types.ts";
import { RouterRuntime } from "./provider.ts";

function formatWhen(timestamp?: number): string {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleString();
}

function formatRelative(target?: number): string {
  if (!target) return "-";
  const delta = target - Date.now();
  if (delta <= 0) return "expired";
  const seconds = Math.ceil(delta / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
}

function formatAgo(timestamp?: number): string {
  if (!timestamp) return "never";
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return `${Math.max(1, Math.ceil(delta / 1000))}s ago`;
  if (delta < 3_600_000) return `${Math.ceil(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.ceil(delta / 3_600_000)}h ago`;
  return `${Math.ceil(delta / 86_400_000)}d ago`;
}

function formatLastUsedSummary(timestamp?: number): string {
  if (!timestamp) return "never";
  return `${formatWhen(timestamp)} (${formatAgo(timestamp)})`;
}

function isHealthy(row: RouterStatusRow): boolean {
  if (!row.enabled) return false;
  if (row.authHealth !== "ok") return false;
  if (row.cooldownUntil && row.cooldownUntil > Date.now()) return false;
  if (row.penaltyUntil && row.penaltyUntil > Date.now()) return false;
  return true;
}

export function formatStatusReport(runtime: RouterRuntime): string {
  const config = runtime.getConfig();
  const rows = runtime.getStatusRows();
  const accountsById = new Map(runtime.listAccounts().map((account) => [account.id, account]));
  const healthyRows = rows.filter((row) => isHealthy(row));
  const healthy = healthyRows.length;
  const enabled = rows.filter((row) => row.enabled).length;
  const usableModels = config.models
    .filter((model) => {
      const routeFilter = new Set(model.route?.upstreamIds ?? []);
      return healthyRows.some((row) => {
        const upstream = config.upstreams.find((entry) => entry.id === row.upstream);
        if (!upstream?.modelIds.includes(model.id)) return false;
        if (routeFilter.size > 0 && !routeFilter.has(row.upstream)) return false;
        return true;
      });
    })
    .map((model) => model.id);
  const lastUsedRow = [...rows]
    .filter((row) => row.lastUsedAt)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))[0];
  const lastUsedLine = lastUsedRow
    ? `${lastUsedRow.id} | ${lastUsedRow.label} | ${lastUsedRow.upstream} | ${formatLastUsedSummary(lastUsedRow.lastUsedAt)}`
    : "none yet";
  const upstreams = config.upstreams.map((upstream) => {
    const auth = upstream.authMode === "oauth" ? `oauth:${upstream.oauthProviderId}` : "api-key";
    const activeCount = rows.filter((row) => row.upstream === upstream.id && row.enabled).length;
    return `- ${upstream.id} | ${upstream.label} | ${auth} | ${upstream.api} | active=${activeCount} | models=${upstream.modelIds.join(", ")}`;
  });

  const accounts = rows.length
    ? [...rows]
        .sort((a, b) => {
          const aTime = a.lastUsedAt ?? 0;
          const bTime = b.lastUsedAt ?? 0;
          if (aTime !== bTime) return bTime - aTime;
          return a.label.localeCompare(b.label);
        })
        .map((row) => {
          const account = accountsById.get(row.id);
          const plan = typeof account?.meta?.planType === "string" ? account.meta.planType : "unknown";
          const health = isHealthy(row)
            ? "healthy"
            : row.authHealth !== "ok"
              ? `auth=${row.authHealth}`
              : row.cooldownUntil && row.cooldownUntil > Date.now()
                ? `cooldown ${formatRelative(row.cooldownUntil)}`
                : row.penaltyUntil && row.penaltyUntil > Date.now()
                  ? `penalty ${formatRelative(row.penaltyUntil)}`
                  : "inactive";

          return [
            `- ${row.id} | ${row.label} | plan=${plan}`,
            `  upstream=${row.upstream} enabled=${row.enabled} weight=${row.weight} state=${health}`,
            `  lastUsed=${formatLastUsedSummary(row.lastUsedAt)} | lastStatus=${row.lastStatus ?? "-"} | expires=${formatWhen(row.expires)}`,
            `  successes=${row.successCount} failures=${row.failures} 429s=${row.rateLimitCount} authFailures=${row.authFailureCount}`,
          ].join("\n");
        })
    : ["- No accounts configured yet. Use /router-login add."];

  return [
    "# oauth-router status",
    "",
    `Policy: ${runtime.getPolicy()}`,
    `Accounts: ${rows.length} total | ${enabled} enabled | ${healthy} healthy`,
    `Usable models now: ${usableModels.length > 0 ? usableModels.join(", ") : "none"}`,
    `Last used account: ${lastUsedLine}`,
    "",
    "## Upstreams",
    ...upstreams,
    "",
    "## Accounts",
    ...accounts,
  ].join("\n");
}

function emitReport(pi: ExtensionAPI, text: string) {
  pi.sendMessage({
    customType: "oauth-router",
    content: text,
    display: true,
    details: { source: "oauth-router" },
  });
}

async function pickUpstream(runtime: RouterRuntime, ctx: ExtensionCommandContext, requestedId?: string) {
  const upstreams = runtime.listUpstreams().filter((upstream) => upstream.enabled);
  if (upstreams.length === 0) throw new Error("No enabled upstreams are configured");

  if (requestedId) {
    const matched = upstreams.find((upstream) => upstream.id === requestedId);
    if (!matched) throw new Error(`Unknown upstream: ${requestedId}`);
    return matched;
  }

  if (!ctx.hasUI) return upstreams[0]!;

  const choice = await ctx.ui.select(
    "Choose an upstream",
    upstreams.map((upstream) => `${upstream.id} — ${upstream.label}`),
  );
  if (!choice) throw new Error("Cancelled by user");
  const id = choice.split(" — ")[0]?.trim();
  const selected = upstreams.find((upstream) => upstream.id === id);
  if (!selected) throw new Error(`Unknown upstream: ${id}`);
  return selected;
}

async function getLabel(ctx: ExtensionCommandContext, fallback: string, provided?: string) {
  if (provided && provided.trim()) return provided.trim();
  if (!ctx.hasUI) return fallback;
  const response = await ctx.ui.input("Account label:", fallback);
  return response?.trim() || fallback;
}

function normalizePolicy(input?: string): RoutingPolicyName | undefined {
  if (!input) return undefined;
  const value = input.trim().toLowerCase();
  if (value === "round-robin" || value === "rr") return "round-robin";
  if (value === "weighted-round-robin" || value === "wrr" || value === "weighted") return "weighted-round-robin";
  return undefined;
}

function parseArgs(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function setFooterStatus(ctx: ExtensionCommandContext, runtime: RouterRuntime) {
  const rows = runtime.getStatusRows();
  const healthy = rows.filter((row) => isHealthy(row)).length;
  ctx.ui.setStatus("oauth-router", `oauth-router ${healthy}/${rows.length || 0} healthy | ${runtime.getPolicy()}`);
}

function getAccountUsageLines(runtime: RouterRuntime): string[] {
  const rows = runtime.getStatusRows();
  if (rows.length === 0) {
    return ["No accounts configured yet. Use /router-login add."];
  }

  return rows.map((row) => `- ${row.id} | ${row.label} | enabled=${row.enabled} | weight=${row.weight}`);
}

function showCommandHint(pi: ExtensionAPI, ctx: ExtensionCommandContext, title: string, lines: string[]) {
  emitReport(pi, [`# ${title}`, "", ...lines].join("\n"));
  ctx.ui.notify(title, "info");
}

async function handleRouterLogin(pi: ExtensionAPI, runtime: RouterRuntime, args: string, ctx: ExtensionCommandContext) {
  const [command = "help", first, ...rest] = parseArgs(args);

  switch (command) {
    case "add": {
      const upstream = await pickUpstream(runtime, ctx, first);
      const label = await getLabel(ctx, `${upstream.label} ${runtime.listAccounts().length + 1}`, rest.join(" "));
      const account = await createAccountFromUpstream(upstream, label, ctx);
      runtime.addAccount(account);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Added account ${account.id} (${account.label}) for upstream ${upstream.id}.`);
      ctx.ui.notify(`Added ${account.id}`, "info");
      return;
    }
    case "list": {
      const report = formatStatusReport(runtime);
      emitReport(pi, report);
      setFooterStatus(ctx, runtime);
      return;
    }
    case "remove": {
      if (!first) throw new Error("Usage: /router-login remove <id>");
      if (ctx.hasUI) {
        const ok = await ctx.ui.confirm("Remove account?", `Delete router account ${first}?`);
        if (!ok) throw new Error("Cancelled by user");
      }
      runtime.removeAccount(first);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Removed account ${first}.`);
      return;
    }
    case "refresh": {
      if (!first) throw new Error("Usage: /router-login refresh <id>");
      const refreshed = await runtime.refreshAccount(first);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Refreshed account ${refreshed.id} (${refreshed.label}).`);
      return;
    }
    case "help":
    default: {
      emitReport(
        pi,
        [
          "# oauth-router commands",
          "",
          "- /router-login add [upstreamId] [label]",
          "- /router-login list",
          "- /router-login remove <id>",
          "- /router-login refresh <id>",
          "- /router-status",
          "- /router-accounts",
          "- /router-enable <id>",
          "- /router-disable <id>",
          "- /router-policy <round-robin|weighted-round-robin>",
          "- /router-weight <id> <n>",
        ].join("\n"),
      );
      return;
    }
  }
}

export function registerRouterCommands(pi: ExtensionAPI, runtime: RouterRuntime) {
  pi.registerCommand("router-login", {
    description: "Manage oauth-router accounts",
    handler: async (args, ctx) => handleRouterLogin(pi, runtime, args || "", ctx),
  });

  pi.registerCommand("router-status", {
    description: "Show oauth-router health and routing state",
    handler: async (_args, ctx) => {
      emitReport(pi, formatStatusReport(runtime));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-accounts", {
    description: "Show oauth-router accounts",
    handler: async (_args, ctx) => {
      emitReport(pi, formatStatusReport(runtime));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-enable", {
    description: "Enable an oauth-router account",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      if (!id) {
        showCommandHint(pi, ctx, "router-enable", ["Usage: /router-enable <id>", "", ...getAccountUsageLines(runtime)]);
        return;
      }
      if (!runtime.getAccount(id)) {
        showCommandHint(pi, ctx, "router-enable", [`Unknown account: ${id}`, "", ...getAccountUsageLines(runtime)]);
        return;
      }
      runtime.setEnabled(id, true);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Enabled account ${id}.`);
    },
  });

  pi.registerCommand("router-disable", {
    description: "Disable an oauth-router account",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      if (!id) {
        showCommandHint(pi, ctx, "router-disable", ["Usage: /router-disable <id>", "", ...getAccountUsageLines(runtime)]);
        return;
      }
      if (!runtime.getAccount(id)) {
        showCommandHint(pi, ctx, "router-disable", [`Unknown account: ${id}`, "", ...getAccountUsageLines(runtime)]);
        return;
      }
      runtime.setEnabled(id, false);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Disabled account ${id}.`);
    },
  });

  pi.registerCommand("router-policy", {
    description: "Set oauth-router routing policy",
    handler: async (args, ctx) => {
      const raw = (args || "").trim();
      const policy = normalizePolicy(raw);
      if (!raw) {
        showCommandHint(pi, ctx, "router-policy", [
          `Current policy: ${runtime.getPolicy()}`,
          "",
          "Usage: /router-policy <round-robin|weighted-round-robin>",
          "Aliases: rr, wrr, weighted",
        ]);
        return;
      }
      if (!policy) {
        showCommandHint(pi, ctx, "router-policy", [
          `Unrecognized policy: ${raw}`,
          "",
          `Current policy: ${runtime.getPolicy()}`,
          "Valid values: round-robin, weighted-round-robin",
        ]);
        return;
      }
      runtime.setPolicy(policy);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Routing policy set to ${policy}.`);
    },
  });

  pi.registerCommand("router-weight", {
    description: "Set oauth-router account weight for weighted round robin",
    handler: async (args, ctx) => {
      const [id, rawWeight] = parseArgs(args || "");
      const hasAccounts = runtime.getStatusRows().length > 0;
      if (!id && !rawWeight) {
        showCommandHint(pi, ctx, "router-weight", [
          "Usage: /router-weight <id> <n>",
          "",
          "Example: /router-weight acct_ab12cd34 3",
          "",
          ...getAccountUsageLines(runtime),
        ]);
        return;
      }

      const weight = Number(rawWeight);
      if (!id || !Number.isFinite(weight)) {
        showCommandHint(pi, ctx, "router-weight", [
          "Usage: /router-weight <id> <n>",
          hasAccounts ? "Provide both an account id and a numeric weight." : "Add an account first with /router-login add.",
          "",
          ...getAccountUsageLines(runtime),
        ]);
        return;
      }
      if (!runtime.getAccount(id)) {
        showCommandHint(pi, ctx, "router-weight", [`Unknown account: ${id}`, "", ...getAccountUsageLines(runtime)]);
        return;
      }
      runtime.setWeight(id, weight);
      setFooterStatus(ctx, runtime);
      emitReport(pi, `Updated weight for ${id} to ${Math.max(1, Math.floor(weight))}.`);
    },
  });
}
