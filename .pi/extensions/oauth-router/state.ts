import { existsSync, readFileSync } from "node:fs";
import { STATE_PATH, withJsonFileLock, writeJsonFile } from "./config.ts";
import type {
  RouterAccountState,
  RouterProviderUsageSnapshot,
  RouterRuntimeState,
  RouterUsageSample,
  RouterUsageSummary,
  RouterUsageWindowSummary,
  RoutingPolicyName,
} from "./types.ts";
import type { AssistantMessage } from "@earendil-works/pi-ai";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const USAGE_RETENTION_MS = WEEK_MS + 24 * 60 * 60 * 1000;

const DEFAULT_STATE: RouterRuntimeState = {
  version: 1,
  policy: "round-robin",
  rrCursor: 0,
  weightedCursor: 0,
  accounts: {},
};

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeUsageSample(input: Partial<RouterUsageSample>): RouterUsageSample | undefined {
  const at = finiteNumber(input.at, 0);
  if (!at) return undefined;
  return {
    at,
    model: typeof input.model === "string" && input.model ? input.model : "unknown",
    status: optionalFiniteNumber(input.status),
    input: finiteNumber(input.input),
    output: finiteNumber(input.output),
    cacheRead: finiteNumber(input.cacheRead),
    cacheWrite: finiteNumber(input.cacheWrite),
    totalTokens: finiteNumber(input.totalTokens),
    costTotal: finiteNumber(input.costTotal),
  };
}

function normalizeUsageSamples(input: unknown): RouterUsageSample[] {
  if (!Array.isArray(input)) return [];
  const cutoff = Date.now() - USAGE_RETENTION_MS;
  return input
    .map((sample) => normalizeUsageSample(sample as Partial<RouterUsageSample>))
    .filter((sample): sample is RouterUsageSample => Boolean(sample))
    .filter((sample) => sample.at >= cutoff)
    .sort((a, b) => a.at - b.at);
}

function stripQuotaRaw(window: RouterProviderUsageSnapshot["fiveHour"]): RouterProviderUsageSnapshot["fiveHour"] {
  if (!window) return undefined;
  const { raw: _raw, ...safeWindow } = window;
  return safeWindow;
}

function normalizeProviderUsage(input: unknown): RouterProviderUsageSnapshot | undefined {
  if (!input || typeof input !== "object") return undefined;
  const snapshot = input as Partial<RouterProviderUsageSnapshot>;
  const fetchedAt = optionalFiniteNumber(snapshot.fetchedAt);
  if (!fetchedAt) return undefined;
  const source =
    snapshot.source === "token-claims" || snapshot.source === "provider" || snapshot.source === "local" || snapshot.source === "unavailable"
      ? snapshot.source
      : "unavailable";
  const { raw: _raw, ...safeSnapshot } = snapshot;
  return {
    ...safeSnapshot,
    fetchedAt,
    source,
    fiveHour: stripQuotaRaw(snapshot.fiveHour),
    weekly: stripQuotaRaw(snapshot.weekly),
  };
}

function normalizeAccountState(accountId: string, input?: Partial<RouterAccountState>): RouterAccountState {
  return {
    accountId,
    authHealth: input?.authHealth === "invalid" ? "invalid" : "ok",
    cooldownUntil: optionalFiniteNumber(input?.cooldownUntil),
    penaltyUntil: optionalFiniteNumber(input?.penaltyUntil),
    lastUsedAt: optionalFiniteNumber(input?.lastUsedAt),
    lastTriedAt: optionalFiniteNumber(input?.lastTriedAt),
    lastModel: typeof input?.lastModel === "string" ? input.lastModel : undefined,
    lastStatus: optionalFiniteNumber(input?.lastStatus),
    lastError: typeof input?.lastError === "string" ? input.lastError : undefined,
    failures: finiteNumber(input?.failures),
    rateLimitCount: finiteNumber(input?.rateLimitCount),
    authFailureCount: finiteNumber(input?.authFailureCount),
    successCount: finiteNumber(input?.successCount),
    usageSamples: normalizeUsageSamples(input?.usageSamples),
    providerUsage: normalizeProviderUsage(input?.providerUsage),
  };
}

function isAbortLikeError(message?: string): boolean {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("abort") || lower.includes("cancelled") || lower.includes("canceled");
}

function usageFromMessage(usage: AssistantMessage["usage"]): Omit<RouterUsageSample, "at" | "model" | "status"> {
  return {
    input: finiteNumber(usage?.input),
    output: finiteNumber(usage?.output),
    cacheRead: finiteNumber(usage?.cacheRead),
    cacheWrite: finiteNumber(usage?.cacheWrite),
    totalTokens: finiteNumber(usage?.totalTokens),
    costTotal: finiteNumber(usage?.cost?.total),
  };
}

function summarizeWindow(label: RouterUsageWindowSummary["label"], samples: RouterUsageSample[], windowMs: number, until = Date.now()): RouterUsageWindowSummary {
  const since = until - windowMs;
  const selected = samples.filter((sample) => sample.at >= since && sample.at <= until);
  return selected.reduce<RouterUsageWindowSummary>(
    (summary, sample) => ({
      ...summary,
      requests: summary.requests + 1,
      input: summary.input + sample.input,
      output: summary.output + sample.output,
      cacheRead: summary.cacheRead + sample.cacheRead,
      cacheWrite: summary.cacheWrite + sample.cacheWrite,
      totalTokens: summary.totalTokens + sample.totalTokens,
      costTotal: summary.costTotal + sample.costTotal,
    }),
    { label, since, until, requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costTotal: 0 },
  );
}

export class RouterStateStore {
  private data: RouterRuntimeState;

  constructor(initialPolicy: RoutingPolicyName) {
    this.data = this.load(initialPolicy);
  }

  private load(initialPolicy: RoutingPolicyName): RouterRuntimeState {
    if (!existsSync(STATE_PATH)) {
      const initial = { ...DEFAULT_STATE, policy: initialPolicy } satisfies RouterRuntimeState;
      writeJsonFile(STATE_PATH, initial, true);
      return initial;
    }

    try {
      const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<RouterRuntimeState>;
      const accounts = Object.fromEntries(
        Object.entries(parsed.accounts ?? {}).map(([accountId, state]) => [accountId, normalizeAccountState(accountId, state)]),
      );
      return {
        version: 1,
        policy:
          parsed.policy === "weighted-round-robin" || parsed.policy === "round-robin" ? parsed.policy : initialPolicy,
        rrCursor: typeof parsed.rrCursor === "number" && Number.isFinite(parsed.rrCursor) ? parsed.rrCursor : 0,
        weightedCursor: typeof parsed.weightedCursor === "number" && Number.isFinite(parsed.weightedCursor) ? parsed.weightedCursor : 0,
        accounts,
      };
    } catch {
      const initial = { ...DEFAULT_STATE, policy: initialPolicy } satisfies RouterRuntimeState;
      writeJsonFile(STATE_PATH, initial, true);
      return initial;
    }
  }

  private save() {
    writeJsonFile(STATE_PATH, this.data, true);
  }

  private mutate<T>(fn: () => T): T {
    return withJsonFileLock(STATE_PATH, () => {
      this.data = this.load(this.data.policy);
      const result = fn();
      this.save();
      return result;
    });
  }

  private ensureAccountInMemory(accountId: string): RouterAccountState {
    if (!this.data.accounts[accountId]) {
      this.data.accounts[accountId] = normalizeAccountState(accountId);
    }
    return this.data.accounts[accountId]!;
  }

  snapshot(): RouterRuntimeState {
    return JSON.parse(JSON.stringify(this.data)) as RouterRuntimeState;
  }

  getPolicy(defaultPolicy: RoutingPolicyName): RoutingPolicyName {
    if (this.data.policy !== "round-robin" && this.data.policy !== "weighted-round-robin") {
      return this.mutate(() => {
        this.data.policy = defaultPolicy;
        return this.data.policy;
      });
    }
    return this.data.policy;
  }

  setPolicy(policy: RoutingPolicyName) {
    this.mutate(() => {
      this.data.policy = policy;
    });
  }

  getCursor(policy: RoutingPolicyName): number {
    return policy === "weighted-round-robin" ? this.data.weightedCursor : this.data.rrCursor;
  }

  advanceCursor(policy: RoutingPolicyName, next: number) {
    this.mutate(() => {
      if (policy === "weighted-round-robin") {
        this.data.weightedCursor = next;
      } else {
        this.data.rrCursor = next;
      }
    });
  }

  ensureAccount(accountId: string): RouterAccountState {
    return this.mutate(() => this.ensureAccountInMemory(accountId));
  }

  pruneAccountIds(validIds: string[]) {
    this.mutate(() => {
      const valid = new Set(validIds);
      for (const id of Object.keys(this.data.accounts)) {
        if (!valid.has(id)) delete this.data.accounts[id];
      }
    });
  }

  markAttempt(accountId: string, modelId: string) {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.lastTriedAt = Date.now();
      account.lastModel = modelId;
    });
  }

  markSuccess(accountId: string, status?: number) {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.authHealth = "ok";
      account.lastUsedAt = Date.now();
      account.lastStatus = status;
      account.lastError = undefined;
      account.penaltyUntil = undefined;
      account.failures = 0;
      account.successCount += 1;
    });
  }

  recordUsage(accountId: string, modelId: string, usage: AssistantMessage["usage"], status?: number) {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      const cutoff = Date.now() - USAGE_RETENTION_MS;
      account.usageSamples = [
        ...account.usageSamples.filter((sample) => sample.at >= cutoff),
        {
          at: Date.now(),
          model: modelId,
          status,
          ...usageFromMessage(usage),
        },
      ];
    });
  }

  getUsageSummary(accountId: string): RouterUsageSummary {
    const account = this.ensureAccount(accountId);
    const until = Date.now();
    return {
      accountId,
      fiveHour: summarizeWindow("5h", account.usageSamples, FIVE_HOURS_MS, until),
      weekly: summarizeWindow("weekly", account.usageSamples, WEEK_MS, until),
      provider: account.providerUsage,
    };
  }

  setProviderUsage(accountId: string, snapshot: RouterProviderUsageSnapshot) {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.providerUsage = snapshot;
    });
  }

  resetUsage(accountId: string) {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.usageSamples = [];
      account.providerUsage = undefined;
    });
  }

  markRateLimit(accountId: string, retryAfterMs: number, status = 429, message = "Rate limited") {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      const now = Date.now();
      account.lastStatus = status;
      account.lastError = message;
      account.cooldownUntil = now + Math.max(1_000, retryAfterMs);
      account.failures += 1;
      account.rateLimitCount += 1;
    });
  }

  markAuthFailure(accountId: string, status = 401, message = "Authentication failed") {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.authHealth = "invalid";
      account.lastStatus = status;
      account.lastError = message;
      account.failures += 1;
      account.authFailureCount += 1;
      account.cooldownUntil = undefined;
      account.penaltyUntil = undefined;
    });
  }

  markTransientFailure(accountId: string, penaltyMs: number, status = 500, message = "Transient upstream failure") {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.lastStatus = status;
      account.lastError = message;
      account.penaltyUntil = Date.now() + Math.max(1_000, penaltyMs);
      account.failures += 1;
    });
  }

  recordClientNetworkFailure(accountId: string, status: number | undefined, message = "Client/network transport failure") {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.lastStatus = status;
      account.lastError = message;
      account.failures += 1;
      account.penaltyUntil = undefined;
      account.cooldownUntil = undefined;
    });
  }

  clearHealth(accountId: string) {
    this.mutate(() => {
      const account = this.ensureAccountInMemory(accountId);
      account.authHealth = "ok";
      account.cooldownUntil = undefined;
      account.penaltyUntil = undefined;
      account.lastError = undefined;
    });
  }

  clearAbortHealth(accountIds: string[]) {
    this.mutate(() => {
      for (const accountId of accountIds) {
        const account = this.ensureAccountInMemory(accountId);
        if (!isAbortLikeError(account.lastError)) continue;
        account.authHealth = "ok";
        account.cooldownUntil = undefined;
        account.penaltyUntil = undefined;
        account.lastError = undefined;
        account.lastStatus = undefined;
      }
    });
  }
}
