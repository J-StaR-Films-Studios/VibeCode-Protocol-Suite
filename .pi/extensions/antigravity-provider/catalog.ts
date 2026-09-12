import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { AcpSessionInfo } from "./acp-session.ts";

/**
 * Model catalog sourced from the live ACP session, not hardcoded.
 *
 * Startup order: persisted catalog (~/.takomi/antigravity-catalog.json) ->
 * bundled fallback -> background refresh after the first session/new, which
 * re-registers the provider (takes effect immediately, no /reload needed).
 */

export interface CatalogEntry {
  id: string;
  name: string;
  /** Full ACP model ids collapsed into this group (effort variants). */
  variants?: string[];
  /** Base ACP model id without the effort suffix, when grouped. */
  baseModelId?: string;
}

/**
 * Effort suffixes exposed as separate ACP model ids (e.g.
 * gemini-3.8-flash-low / -medium / -high). Grouped into one Pi model so the
 * Pi thinking slider picks the variant instead of the picker list.
 */
export const EFFORT_SUFFIXES = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type EffortSuffix = (typeof EFFORT_SUFFIXES)[number];

export function parseEffort(modelId: string): { base: string; effort?: EffortSuffix } {
  const match = modelId.match(/-(off|minimal|low|medium|high|xhigh|max)$/i);
  if (!match) return { base: modelId };
  return {
    base: modelId.slice(0, -match[0].length),
    effort: match[1].toLowerCase() as EffortSuffix,
  };
}

/** Map a Pi thinking level to the closest available effort variant. */
export function resolveEffortVariant(
  variants: string[],
  effort: string | undefined,
): string | undefined {
  if (variants.length === 0) return undefined;
  if (!effort || effort === "off") {
    // "off" means the base model when one exists, else the first variant.
    const base = variants.find((v) => !parseEffort(v).effort);
    return base ?? variants[0];
  }
  const want = effort.toLowerCase();
  const exact = variants.find((v) => parseEffort(v).effort === want);
  if (exact) return exact;
  // Fall back to the nearest effort step so medium still works on
  // low/high-only families instead of failing the turn.
  const order = [...EFFORT_SUFFIXES];
  const wantIdx = order.indexOf(want as EffortSuffix);
  if (wantIdx === -1) return variants[0];
  const ranked = [...variants].sort((a, b) => {
    const ai = order.indexOf((parseEffort(a).effort ?? "medium") as EffortSuffix);
    const bi = order.indexOf((parseEffort(b).effort ?? "medium") as EffortSuffix);
    return Math.abs(ai - wantIdx) - Math.abs(bi - wantIdx);
  });
  return ranked[0];
}

const FALLBACK_CATALOG: CatalogEntry[] = [
  { id: "antigravity/antigravity-default", name: "Antigravity (account default)" },
];

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export function catalogPath(home = os.homedir()): string {
  return path.join(home, ".takomi", "antigravity-catalog.json");
}

export function toCatalogEntries(session: AcpSessionInfo): CatalogEntry[] {
  // Collect every known ACP model id first, then collapse effort variants
  // (base-low / base-medium / base-high) into one Pi model per base so the
  // Pi thinking slider picks the effort instead of the picker list.
  const seen = new Set<string>();
  const order: string[] = [];
  const display = new Map<string, string>();
  const push = (modelId: string, name: string) => {
    if (seen.has(modelId)) return;
    seen.add(modelId);
    order.push(modelId);
    if (!display.has(modelId)) display.set(modelId, name);
  };
  if (session.currentModel) {
    push(session.currentModel, session.currentModel);
  }
  for (const model of session.availableModels) {
    push(model.modelId, model.name || model.modelId);
  }

  const groups = new Map<string, { base: string; variants: string[]; label: string }>();
  for (const modelId of order) {
    const { base } = parseEffort(modelId);
    const key = base.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { base, variants: [], label: display.get(modelId) ?? modelId };
      groups.set(key, group);
    }
    group.variants.push(modelId);
    if (modelId === session.currentModel) group.label = display.get(modelId) ?? modelId;
  }

  const entries: CatalogEntry[] = [];
  for (const group of groups.values()) {
    const hasEfforts = group.variants.some((v) => parseEffort(v).effort);
    if (!hasEfforts) {
      const only = group.variants[0];
      const isCurrent = only === session.currentModel;
      entries.push({
        id: `antigravity/${only}`,
        name: `Antigravity ${display.get(only) ?? only}${isCurrent ? " (current)" : ""}`,
        variants: [...group.variants],
        baseModelId: only,
      });
      continue;
    }
    const isCurrent = group.variants.includes(session.currentModel ?? "");
    entries.push({
      id: `antigravity/${group.base}`,
      name: `Antigravity ${group.label.replace(/-(off|minimal|low|medium|high|xhigh|max)$/i, "")}${isCurrent ? " (current)" : ""}`,
      variants: [...group.variants],
      baseModelId: group.base,
    });
  }
  return entries;
}

export function toPiModels(entries: CatalogEntry[]): Model<Api>[] {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    reasoning: true,
    input: ["text", "image"],
    // Costs are unknown until measured; zeros signal "unknown", not free.
    cost: { ...ZERO_COST },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
    api: "antigravity-acp" as Api,
    provider: "antigravity",
    baseUrl: "acp://antigravity",
    apiKey: "antigravity-acp",
  }));
}

export function loadPersistedCatalog(catalogFile = catalogPath()): CatalogEntry[] | undefined {
  try {
    const raw = fs.readFileSync(catalogFile, "utf8");
    const parsed = JSON.parse(raw) as {
      models?: Array<{ id?: string; name?: string; variants?: unknown; baseModelId?: unknown }>;
    };
    if (!Array.isArray(parsed.models) || parsed.models.length === 0) return undefined;
    const entries: CatalogEntry[] = [];
    for (const m of parsed.models) {
      if (typeof m?.id !== "string" || typeof m?.name !== "string") continue;
      const entry: CatalogEntry = { id: m.id, name: m.name };
      if (Array.isArray(m.variants)) {
        const variants = m.variants.filter((v): v is string => typeof v === "string");
        if (variants.length > 0) entry.variants = variants;
      }
      if (typeof m.baseModelId === "string") entry.baseModelId = m.baseModelId;
      entries.push(entry);
    }
    return entries.length > 0 ? entries : undefined;
  } catch {
    return undefined;
  }
}

export function persistCatalog(entries: CatalogEntry[], catalogFile?: string): void {
  const target = catalogFile ?? catalogPath();
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      JSON.stringify({ fetchedAt: new Date().toISOString(), models: entries }, null, 2),
      "utf8",
    );
  } catch {
    // Persistence is best-effort; the live catalog still applies this run.
  }
}

export function startupCatalog(): CatalogEntry[] {
  return loadPersistedCatalog() ?? FALLBACK_CATALOG;
}
