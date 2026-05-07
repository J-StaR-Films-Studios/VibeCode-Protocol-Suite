import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { OAuthCredentials } from "@mariozechner/pi-ai";
import { getOAuthProvider } from "@mariozechner/pi-ai/oauth";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { RouterUpstreamConfig, StoredRouterAccount } from "./types.ts";

function now() {
  return Date.now();
}

function normalizeCredentials(credentials: OAuthCredentials) {
  const { access, refresh, expires, ...meta } = credentials;
  return {
    access,
    refresh,
    expires,
    meta,
  };
}

export function openUrlInBrowser(url: string) {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return;
    }

    if (platform === "darwin") {
      const child = spawn("open", [url], { detached: true, stdio: "ignore" });
      child.unref();
      return;
    }

    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Best effort only.
  }
}

async function promptRequired(ctx: ExtensionContext, message: string, placeholder?: string): Promise<string> {
  const response = await ctx.ui.input(message, placeholder);
  if (response === undefined) throw new Error("Cancelled by user");
  return response;
}

export async function createAccountFromUpstream(
  upstream: RouterUpstreamConfig,
  label: string,
  ctx: ExtensionContext,
): Promise<StoredRouterAccount> {
  const createdAt = now();

  if (upstream.authMode === "api-key") {
    const token = await promptRequired(ctx, `Enter API key or bearer token for ${upstream.label}:`);
    return {
      id: `acct_${randomUUID().slice(0, 8)}`,
      label,
      provider: "api-key",
      upstreamId: upstream.id,
      access: token.trim(),
      refresh: "",
      expires: Number.MAX_SAFE_INTEGER,
      enabled: true,
      weight: 1,
      createdAt,
      updatedAt: createdAt,
      meta: {},
    };
  }

  if (!upstream.oauthProviderId) {
    throw new Error(`Upstream ${upstream.id} is missing oauthProviderId`);
  }

  const provider = getOAuthProvider(upstream.oauthProviderId);
  if (!provider) {
    throw new Error(`OAuth provider not available: ${upstream.oauthProviderId}`);
  }

  const credentials = await provider.login({
    onAuth(info) {
      openUrlInBrowser(info.url);
      ctx.ui.notify(`${provider.name}: ${info.instructions ?? "Finish login in your browser."}`, "info");
      ctx.ui.notify(info.url, "info");
    },
    onPrompt(prompt) {
      return promptRequired(ctx, prompt.message, prompt.placeholder);
    },
    onProgress(message) {
      ctx.ui.notify(message, "info");
    },
  });

  const normalized = normalizeCredentials(credentials);

  return {
    id: `acct_${randomUUID().slice(0, 8)}`,
    label,
    provider: upstream.oauthProviderId,
    upstreamId: upstream.id,
    access: normalized.access,
    refresh: normalized.refresh,
    expires: normalized.expires,
    enabled: true,
    weight: 1,
    createdAt,
    updatedAt: createdAt,
    meta: normalized.meta,
  };
}

function toCredentials(account: StoredRouterAccount): OAuthCredentials {
  return {
    access: account.access,
    refresh: account.refresh,
    expires: account.expires,
    ...(account.meta ?? {}),
  };
}

export async function refreshAccountCredentials(account: StoredRouterAccount): Promise<StoredRouterAccount> {
  if (account.provider === "api-key") return account;

  const provider = getOAuthProvider(account.provider);
  if (!provider) throw new Error(`OAuth provider not available: ${account.provider}`);

  const refreshed = await provider.refreshToken(toCredentials(account));
  const normalized = normalizeCredentials(refreshed);

  return {
    ...account,
    access: normalized.access,
    refresh: normalized.refresh,
    expires: normalized.expires,
    meta: normalized.meta,
    updatedAt: now(),
  };
}

export async function getApiKeyForAccount(account: StoredRouterAccount): Promise<string> {
  if (account.provider === "api-key") return account.access;

  const provider = getOAuthProvider(account.provider);
  if (!provider) throw new Error(`OAuth provider not available: ${account.provider}`);
  return provider.getApiKey(toCredentials(account));
}
