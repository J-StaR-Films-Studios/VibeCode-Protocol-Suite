export interface PricingCoverage {
  /** Fully priced API events. Incomplete events are counted separately even with a partial subtotal. */
  pricedEvents: number;
  unpricedEvents: number;
  /** Component token sums, not a replacement for native totalTokens. Subscription tokens are separate. */
  pricedTokens: number;
  unpricedTokens: number;
  subscriptionEvents: number;
  subscriptionTokens: number;
  estimatedTokenEvents: number;
  estimatedTokens: number;
  missingModels: string[];
}
export type UsageComponent = 'input' | 'cache' | 'cacheWrite' | 'output';
export interface UsagePricing {
  cost: number;
  pricing: PricingCoverage;
  priceBasis: 'local-rate' | 'missing-rate' | 'subscription';
  rateSource: 'recorded-catalog' | 'recorded-schedule' | 'oauth-router-catalog' | 'missing' | 'subscription';
  tokenProvenance: 'persisted' | 'estimated';
  unpricedComponents: UsageComponent[];
}
export interface UsageTotals {
  input: number;
  cache: number;
  cacheWrite: number;
  output: number;
  total: number;
  /** Known estimated subtotal, not invoice spend. Consult pricing for completeness. */
  cost: number;
  pricing: PricingCoverage;
}
export interface UsageRollup extends UsageTotals { key: string; events: number }
export interface SessionRow extends UsageTotals {
  key: string;
  session: string;
  source: string;
  file: string;
  project: string;
  cwd: string;
  start: string;
  end: string;
  turns: number;
  messages: number;
  toolCalls: number;
  subagentCalls: number;
  usageEvents: number;
  activeMs: number;
  models: Map<string, number>;
  roles: Map<string, number>;
  stages: Map<string, number>;
  workflows: Map<string, number>;
}
export interface UsageEvent extends UsageTotals, UsagePricing {
  kind: 'usage';
  usageKind: string;
  source: string;
  file: string;
  timestamp: string;
  day: string;
  session: string;
  provider: string;
  model: string;
  project: string;
}
export interface ActivityEvent {
  kind: 'tool' | 'role';
  source: string; file: string; timestamp: string; day: string; session: string;
  provider: string; model: string; project: string;
  input: number; cache: number; output: number; total: number; cost: number;
  tool?: string; role?: string; stage?: string; workflow?: string;
}
export interface TakomiStats {
  generatedAt: string;
  cwd: string;
  since: string | null;
  totals: UsageTotals & { events: number; toolCalls: number; turns: number };
  sessions: number;
  byDay: UsageRollup[];
  byMonth: UsageRollup[];
  byModel: UsageRollup[];
  bySource: UsageRollup[];
  byProject: UsageRollup[];
  byUsageKind: UsageRollup[];
  byTool: UsageRollup[];
  byRole: UsageRollup[];
  byStage: UsageRollup[];
  byWorkflow: UsageRollup[];
  byAgent: UsageRollup[];
  sessionRows: SessionRow[];
  topSessions: SessionRow[];
  mostSubagentsSession: SessionRow | null;
  taskRows: unknown[];
  topTasks: unknown[];
  runs: unknown[];
  longestRun: unknown;
  recent: (UsageEvent | ActivityEvent)[];
  sourceRoots?: { source: string; root: string; default: boolean; exists: boolean; files: number }[];
  statsConfigFiles?: string[];
  runHistorySources?: { file: string; default: boolean; exists: boolean; runs: number }[];
}
export interface StatsOptions {
  home?: string; cwd?: string; json?: boolean; full?: boolean; limit?: number; view?: string; since?: string;
  sessionsRoot?: string; sessionRoots?: string | string[]; projectRoot?: string; projectRoots?: string | string[];
  runHistory?: string; statsConfig?: string; cacheFile?: string; noCache?: boolean;
  discounts?: { model?: string; month?: string; start?: string; end?: string; discountPct?: number; discount_pct?: number; discount?: number }[];
}
export function collectTakomiStats(opts?: StatsOptions): Promise<TakomiStats>;
export function renderTakomiStats(stats: TakomiStats, opts?: Pick<StatsOptions, 'full' | 'limit' | 'view' | 'since'>): string;
export function printTakomiStats(options?: StatsOptions): Promise<void>;
export interface SessionTurn extends UsageTotals {
  turnIndex: number; start: string; end: string; title: string; model: string; tools: string[];
}
export function getSessionTurns(file: string, discounts?: StatsOptions['discounts'], home?: string): Promise<SessionTurn[]>;
export function fmtEstimatedCost(row: Pick<UsageTotals, 'cost' | 'pricing'>, short?: boolean): string;
export function pricingSummary(row: Pick<UsageTotals, 'pricing'>): string;
