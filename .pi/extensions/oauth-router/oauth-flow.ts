import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type { OAuthCredentials } from "@mariozechner/pi-ai";
import { getOAuthProvider } from "@mariozechner/pi-ai/oauth";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { RouterProviderQuotaWindow, RouterProviderUsageSnapshot, RouterUpstreamConfig, StoredRouterAccount } from "./types.ts";

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

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const [, payload] = token.split(".");
  if (!payload) return undefined;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function getStringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === "string" && value ? value : undefined;
}

function getAudience(claims: Record<string, unknown>): string | string[] | undefined {
  const audience = claims.aud;
  if (typeof audience === "string") return audience;
  if (Array.isArray(audience) && audience.every((item) => typeof item === "string")) return audience as string[];
  return undefined;
}

function getOpenAIAuthClaim(claims: Record<string, unknown>): Record<string, unknown> | undefined {
  const value = claims["https://api.openai.com/auth"];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function inspectAccountToken(account: StoredRouterAccount): RouterProviderUsageSnapshot {
  const claims = decodeJwtPayload(account.access);
  if (!claims) {
    return {
      fetchedAt: now(),
      source: "unavailable",
      accountId: typeof account.meta?.accountId === "string" ? account.meta.accountId : undefined,
      expires: account.expires,
      message: "Access token is not a readable JWT or exposes no local claims. Provider-side usage needs an authenticated usage endpoint.",
    };
  }

  const openaiAuth = getOpenAIAuthClaim(claims);
  const exp = typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp * 1000 : account.expires;
  const accountId =
    (typeof account.meta?.accountId === "string" ? account.meta.accountId : undefined) ??
    (openaiAuth && getStringClaim(openaiAuth, "chatgpt_account_id")) ??
    getStringClaim(claims, "account_id");
  const planType =
    (typeof account.meta?.planType === "string" ? account.meta.planType : undefined) ??
    (openaiAuth && (getStringClaim(openaiAuth, "plan_type") ?? getStringClaim(openaiAuth, "planType"))) ??
    getStringClaim(claims, "plan_type") ??
    getStringClaim(claims, "planType");

  return {
    fetchedAt: now(),
    source: "token-claims",
    accountId,
    planType,
    email: getStringClaim(claims, "email"),
    subject: getStringClaim(claims, "sub"),
    issuer: getStringClaim(claims, "iss"),
    audience: getAudience(claims),
    expires: exp,
    claimKeys: Object.keys(claims).sort(),
    message: "Token claims expose identity/expiry metadata only. 5h and weekly quota windows are not present in this token snapshot; local router-observed usage is shown separately.",
  };
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walkRecords(value: unknown, visit: (record: Record<string, unknown>) => void, depth = 0) {
  if (depth > 8) return;
  if (Array.isArray(value)) {
    for (const item of value) walkRecords(item, visit, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  visit(value);
  for (const item of Object.values(value)) walkRecords(item, visit, depth + 1);
}

function normalizeResetAt(record: Record<string, unknown>): number | undefined {
  const seconds = firstNumber(record.reset_after_seconds, record.resetAfterSeconds, record.resets_in_seconds, record.resetsInSeconds);
  if (seconds !== undefined) return now() + seconds * 1000;
  const raw = firstNumber(record.reset_at, record.resetAt, record.resets_at, record.resetsAt, record.next_reset_at, record.nextResetAt);
  if (raw === undefined) return undefined;
  return raw < 10_000_000_000 ? raw * 1000 : raw;
}

function quotaFromRecord(label: string, record: Record<string, unknown>): RouterProviderQuotaWindow | undefined {
  const limit = firstNumber(record.limit, record.cap, record.total, record.max, record.quota);
  const remaining = firstNumber(record.remaining, record.available, record.left, record.remaining_messages, record.remainingMessages);
  const used = firstNumber(record.used, record.consumed, record.current, record.used_messages, record.usedMessages);
  const usedPercent = firstNumber(record.used_percent, record.usedPercent);
  const percentRemaining = firstNumber(record.percent_remaining, record.percentRemaining, record.remaining_percent, record.remainingPercent) ?? (usedPercent !== undefined ? 100 - Math.max(0, Math.min(100, usedPercent)) : undefined);
  const resetAt = normalizeResetAt(record);

  if (limit === undefined && remaining === undefined && used === undefined && percentRemaining === undefined && resetAt === undefined) {
    return undefined;
  }

  return {
    label,
    used,
    limit,
    remaining,
    percentRemaining: percentRemaining !== undefined ? percentRemaining : limit && remaining !== undefined ? (remaining / limit) * 100 : undefined,
    resetAt,
    raw: Object.fromEntries(Object.entries(record).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))),
  };
}

function mergeQuota(previous: RouterProviderQuotaWindow | undefined, next: RouterProviderQuotaWindow | undefined): RouterProviderQuotaWindow | undefined {
  if (!previous) return next;
  if (!next) return previous;
  return { ...previous, ...next, raw: { ...(previous.raw ?? {}), ...(next.raw ?? {}) } };
}

function extractProviderUsage(json: unknown): Pick<RouterProviderUsageSnapshot, "planType" | "fiveHour" | "weekly"> {
  let planType: string | undefined;
  let fiveHour: RouterProviderQuotaWindow | undefined;
  let weekly: RouterProviderQuotaWindow | undefined;

  walkRecords(json, (record) => {
    planType ??= firstString(record.plan_type, record.planType, record.plan, record.subscription_plan, record.subscriptionPlan, record.account_plan, record.accountPlan);

    const rateLimit = isRecord(record.rate_limit) ? record.rate_limit : undefined;
    if (rateLimit) {
      const primary = isRecord(rateLimit.primary_window) ? rateLimit.primary_window : isRecord(rateLimit.primaryWindow) ? rateLimit.primaryWindow : undefined;
      const secondary = isRecord(rateLimit.secondary_window) ? rateLimit.secondary_window : isRecord(rateLimit.secondaryWindow) ? rateLimit.secondaryWindow : undefined;
      fiveHour = mergeQuota(fiveHour, primary ? quotaFromRecord("5h", primary) : undefined);
      weekly = mergeQuota(weekly, secondary ? quotaFromRecord("weekly", secondary) : undefined);
    }

    const name = [record.name, record.label, record.bucket, record.window, record.period, record.type, record.key, record.id]
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .join(" ");

    const directFive = isRecord(record.five_hour) ? record.five_hour : isRecord(record.fiveHour) ? record.fiveHour : isRecord(record["5h"]) ? record["5h"] : undefined;
    const directWeekly = isRecord(record.weekly) ? record.weekly : isRecord(record.week) ? record.week : isRecord(record["7d"]) ? record["7d"] : undefined;
    fiveHour = mergeQuota(fiveHour, directFive ? quotaFromRecord("5h", directFive) : undefined);
    weekly = mergeQuota(weekly, directWeekly ? quotaFromRecord("weekly", directWeekly) : undefined);

    if (/5\s*h|five.?hour|primary.?window/.test(name)) {
      fiveHour = mergeQuota(fiveHour, quotaFromRecord("5h", record));
    }
    if (/week|weekly|7\s*d|secondary.?window/.test(name)) {
      weekly = mergeQuota(weekly, quotaFromRecord("weekly", record));
    }
  });

  return { planType, fiveHour, weekly };
}

function resolveProbeUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

function collectRateLimitHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (/rate.?limit|reset|remaining|quota/i.test(key)) result[key] = value;
  }
  return result;
}

export async function refreshProviderUsageSnapshot(account: StoredRouterAccount, upstream: RouterUpstreamConfig): Promise<RouterProviderUsageSnapshot> {
  const base = inspectAccountToken(account);
  if (account.provider !== "openai-codex" || upstream.usageProbe?.enabled === false) return base;

  const accountId = base.accountId;
  const endpoints = Array.from(new Set(["/wham/usage", ...(upstream.usageProbe?.endpoints ?? [])]));
  if (!accountId || endpoints.length === 0) {
    return { ...base, message: `${base.message ?? "Token inspected."} No provider usage probe endpoints are configured.` };
  }

  let lastStatus: number | undefined;
  let lastEndpoint: string | undefined;
  let lastHeaders: Record<string, string> | undefined;
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const url = resolveProbeUrl(upstream.baseUrl, endpoint);
    lastEndpoint = url;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${account.access}`,
          "ChatGPT-Account-Id": accountId,
          "chatgpt-account-id": accountId,
          Originator: "codex_cli_rs",
          originator: "codex_cli_rs",
          "User-Agent": "codex_cli_rs/0.133.0 (Windows; x86_64) pi/oauth-router",
          accept: "application/json",
        },
      });
      lastStatus = response.status;
      lastHeaders = collectRateLimitHeaders(response.headers);
      const text = await response.text();
      const json = text ? JSON.parse(text) : undefined;
      const extracted = extractProviderUsage(json);
      const hasQuota = Boolean(extracted.fiveHour || extracted.weekly || extracted.planType);
      if (response.ok && hasQuota) {
        return {
          ...base,
          source: extracted.fiveHour || extracted.weekly ? "provider" : "token-claims",
          fetchedAt: now(),
          planType: extracted.planType ?? base.planType,
          fiveHour: extracted.fiveHour,
          weekly: extracted.weekly,
          endpoint: url,
          status: response.status,
          rateLimitHeaders: lastHeaders,
          raw: json,
          message: extracted.fiveHour || extracted.weekly
            ? "Provider-side quota metadata was extracted from an authenticated ChatGPT/Codex endpoint."
            : "Provider endpoint responded, but no 5h/weekly quota windows were found; token identity metadata is shown.",
        };
      }
      errors.push(`${endpoint}: HTTP ${response.status}${hasQuota ? " partial metadata only" : " no quota fields"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint}: ${message}`);
    }
  }

  return {
    ...base,
    fetchedAt: now(),
    endpoint: lastEndpoint,
    status: lastStatus,
    rateLimitHeaders: lastHeaders,
    message: `Provider quota probe did not find 5h/weekly windows. Tried ${endpoints.length} endpoint(s): ${errors.slice(0, 4).join("; ")}${errors.length > 4 ? "; …" : ""}`,
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
