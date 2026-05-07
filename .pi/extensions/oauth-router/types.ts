import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";

export type RouterUpstreamApi = "openai-completions" | "openai-responses" | "openai-codex-responses";
export type RouterAuthMode = "oauth" | "api-key";
export type RoutingPolicyName = "round-robin" | "weighted-round-robin";
export type AuthHealth = "ok" | "invalid";

export interface RouterModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
  route?: {
    upstreamIds?: string[];
  };
}

export interface RouterUpstreamConfig {
  id: string;
  label: string;
  description?: string;
  baseUrl: string;
  api: RouterUpstreamApi;
  authMode: RouterAuthMode;
  oauthProviderId?: string;
  enabled: boolean;
  modelIds: string[];
  headers?: Record<string, string>;
}

export interface RouterConfig {
  version: 1;
  providerName: "oauth-router";
  policy: RoutingPolicyName;
  tokenRefreshSkewMs: number;
  rateLimitCooldownMs: number;
  transientPenaltyMs: number;
  models: RouterModelConfig[];
  upstreams: RouterUpstreamConfig[];
}

export interface StoredRouterAccount {
  id: string;
  label: string;
  provider: string;
  upstreamId: string;
  access: string;
  refresh: string;
  expires: number;
  enabled: boolean;
  weight: number;
  createdAt: number;
  updatedAt: number;
  meta?: Record<string, unknown>;
}

export interface RouterCredentialStore {
  version: 1;
  accounts: StoredRouterAccount[];
}

export interface RouterAccountState {
  accountId: string;
  authHealth: AuthHealth;
  cooldownUntil?: number;
  penaltyUntil?: number;
  lastUsedAt?: number;
  lastTriedAt?: number;
  lastModel?: string;
  lastStatus?: number;
  lastError?: string;
  failures: number;
  rateLimitCount: number;
  authFailureCount: number;
  successCount: number;
}

export interface RouterRuntimeState {
  version: 1;
  policy: RoutingPolicyName;
  rrCursor: number;
  weightedCursor: number;
  accounts: Record<string, RouterAccountState>;
}

export interface RouterStatusRow {
  id: string;
  label: string;
  upstream: string;
  provider: string;
  enabled: boolean;
  weight: number;
  authHealth: AuthHealth;
  cooldownUntil?: number;
  penaltyUntil?: number;
  lastUsedAt?: number;
  lastStatus?: number;
  failures: number;
  rateLimitCount: number;
  authFailureCount: number;
  successCount: number;
  expires: number;
}

export interface EligibleAccount {
  account: StoredRouterAccount;
  upstream: RouterUpstreamConfig;
  modelConfig: RouterModelConfig;
  state: RouterAccountState;
}

export interface DelegateSelection {
  account: StoredRouterAccount;
  upstream: RouterUpstreamConfig;
  modelConfig: RouterModelConfig;
  apiKey: string;
  headers: Record<string, string>;
  delegatedModel: Model<Api>;
}

export interface FailureClassification {
  kind: "rate-limit" | "auth" | "transient" | "fatal";
  status?: number;
  retryAfterMs?: number;
  message: string;
}

export interface StreamAttemptResult {
  completed: boolean;
  emittedMeaningfulOutput: boolean;
  failure?: FailureClassification;
}

export interface RouterStreamInput {
  model: Model<Api>;
  context: Context;
  options?: SimpleStreamOptions;
}

export interface RouterErrorMessageInput {
  model: Model<Api>;
  message: string;
  stopReason?: AssistantMessage["stopReason"];
}
