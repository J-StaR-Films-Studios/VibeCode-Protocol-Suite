import { existsSync, readFileSync } from "node:fs";
import { STATE_PATH, writeJsonFile } from "./config.ts";
import type { RouterAccountState, RouterRuntimeState, RoutingPolicyName } from "./types.ts";

const DEFAULT_STATE: RouterRuntimeState = {
  version: 1,
  policy: "round-robin",
  rrCursor: 0,
  weightedCursor: 0,
  accounts: {},
};

function normalizeAccountState(accountId: string, input?: Partial<RouterAccountState>): RouterAccountState {
  return {
    accountId,
    authHealth: input?.authHealth === "invalid" ? "invalid" : "ok",
    cooldownUntil: Number.isFinite(input?.cooldownUntil) ? input?.cooldownUntil : undefined,
    penaltyUntil: Number.isFinite(input?.penaltyUntil) ? input?.penaltyUntil : undefined,
    lastUsedAt: Number.isFinite(input?.lastUsedAt) ? input?.lastUsedAt : undefined,
    lastTriedAt: Number.isFinite(input?.lastTriedAt) ? input?.lastTriedAt : undefined,
    lastModel: typeof input?.lastModel === "string" ? input.lastModel : undefined,
    lastStatus: Number.isFinite(input?.lastStatus) ? input?.lastStatus : undefined,
    lastError: typeof input?.lastError === "string" ? input.lastError : undefined,
    failures: Number.isFinite(input?.failures) ? input!.failures! : 0,
    rateLimitCount: Number.isFinite(input?.rateLimitCount) ? input!.rateLimitCount! : 0,
    authFailureCount: Number.isFinite(input?.authFailureCount) ? input!.authFailureCount! : 0,
    successCount: Number.isFinite(input?.successCount) ? input!.successCount! : 0,
  };
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

  snapshot(): RouterRuntimeState {
    return JSON.parse(JSON.stringify(this.data)) as RouterRuntimeState;
  }

  getPolicy(defaultPolicy: RoutingPolicyName): RoutingPolicyName {
    if (this.data.policy !== "round-robin" && this.data.policy !== "weighted-round-robin") {
      this.data.policy = defaultPolicy;
      this.save();
    }
    return this.data.policy;
  }

  setPolicy(policy: RoutingPolicyName) {
    this.data.policy = policy;
    this.save();
  }

  getCursor(policy: RoutingPolicyName): number {
    return policy === "weighted-round-robin" ? this.data.weightedCursor : this.data.rrCursor;
  }

  advanceCursor(policy: RoutingPolicyName, next: number) {
    if (policy === "weighted-round-robin") {
      this.data.weightedCursor = next;
    } else {
      this.data.rrCursor = next;
    }
    this.save();
  }

  ensureAccount(accountId: string): RouterAccountState {
    if (!this.data.accounts[accountId]) {
      this.data.accounts[accountId] = normalizeAccountState(accountId);
      this.save();
    }
    return this.data.accounts[accountId]!;
  }

  pruneAccountIds(validIds: string[]) {
    const valid = new Set(validIds);
    for (const id of Object.keys(this.data.accounts)) {
      if (!valid.has(id)) delete this.data.accounts[id];
    }
    this.save();
  }

  markAttempt(accountId: string, modelId: string) {
    const account = this.ensureAccount(accountId);
    account.lastTriedAt = Date.now();
    account.lastModel = modelId;
    this.save();
  }

  markSuccess(accountId: string, status?: number) {
    const account = this.ensureAccount(accountId);
    account.authHealth = "ok";
    account.lastUsedAt = Date.now();
    account.lastStatus = status;
    account.lastError = undefined;
    account.penaltyUntil = undefined;
    account.failures = 0;
    account.successCount += 1;
    this.save();
  }

  markRateLimit(accountId: string, retryAfterMs: number, status = 429, message = "Rate limited") {
    const account = this.ensureAccount(accountId);
    const now = Date.now();
    account.lastStatus = status;
    account.lastError = message;
    account.cooldownUntil = now + Math.max(1_000, retryAfterMs);
    account.failures += 1;
    account.rateLimitCount += 1;
    this.save();
  }

  markAuthFailure(accountId: string, status = 401, message = "Authentication failed") {
    const account = this.ensureAccount(accountId);
    account.authHealth = "invalid";
    account.lastStatus = status;
    account.lastError = message;
    account.failures += 1;
    account.authFailureCount += 1;
    account.cooldownUntil = undefined;
    account.penaltyUntil = undefined;
    this.save();
  }

  markTransientFailure(accountId: string, penaltyMs: number, status = 500, message = "Transient upstream failure") {
    const account = this.ensureAccount(accountId);
    account.lastStatus = status;
    account.lastError = message;
    account.penaltyUntil = Date.now() + Math.max(1_000, penaltyMs);
    account.failures += 1;
    this.save();
  }

  clearHealth(accountId: string) {
    const account = this.ensureAccount(accountId);
    account.authHealth = "ok";
    account.cooldownUntil = undefined;
    account.penaltyUntil = undefined;
    account.lastError = undefined;
    this.save();
  }
}
