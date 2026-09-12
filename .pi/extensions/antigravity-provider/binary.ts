import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type AntigravityBinarySource =
  | "linked"
  | "t3-managed"
  | "path"
  | "takomi-managed"
  | "missing";

export interface AntigravityBinaryConfig {
  /** Explicit link to an existing server, e.g. the T3-managed exe. */
  binaryPath?: string;
  /** Harness helper next to the server. Defaults to the sibling file. */
  harnessPath?: string;
  /** Override for tests. Defaults to ~/.t3. */
  t3Dir?: string;
  /** Override for tests. Defaults to ~/.takomi. */
  takomiDir?: string;
}

export interface AntigravityBinaryResolution {
  source: AntigravityBinarySource;
  executablePath?: string;
  harnessPath?: string;
  version?: string;
  detail: string;
}

export function executableNames(platform: NodeJS.Platform = process.platform): {
  executable: string;
  harness: string;
} {
  return platform === "win32"
    ? { executable: "agy_acp_server.exe", harness: "localharness_external.exe" }
    : { executable: "agy_acp_server.par", harness: "localharness_external" };
}

function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readJsonFile<T>(p: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a versioned install dir laid out like T3's:
 *   <root>/active.json -> { releaseId }
 *   <root>/versions/<releaseId>/{agy_acp_server.*, localharness_external*}
 *   <root>/versions/<releaseId>/.install-complete.json -> { version }
 */
function resolveManagedDir(
  managedDir: string,
  names: { executable: string; harness: string },
): Pick<AntigravityBinaryResolution, "executablePath" | "harnessPath" | "version"> | undefined {
  const active = readJsonFile<{ releaseId?: string }>(path.join(managedDir, "active.json"));
  if (!active?.releaseId) return undefined;
  const versionDir = path.join(managedDir, "versions", active.releaseId);
  const executablePath = path.join(versionDir, names.executable);
  const harnessPath = path.join(versionDir, names.harness);
  if (!fileExists(executablePath) || !fileExists(harnessPath)) return undefined;
  const record = readJsonFile<{ version?: string }>(path.join(versionDir, ".install-complete.json"));
  return { executablePath, harnessPath, version: record?.version };
}

function platformArchDir(platform: NodeJS.Platform, arch: string): string {
  return `${platform}-${arch}`;
}

function findOnPath(names: { executable: string; harness: string }): string | undefined {
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, names.executable);
    if (fileExists(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Resolution order:
 *   1. explicit link (binaryPath / ANTIGRAVITY_ACP_BIN) — user-owned server
 *   2. T3-managed runtime (~/.t3/tools/antigravity-acp/...) — read-only reuse
 *   3. PATH lookup
 *   4. Takomi-managed fallback (~/.takomi/tools/antigravity-acp/...)
 *
 * Binary location and auth profile are independent: reusing a binary does
 * not reuse its owner's credentials. Auth reuse is a GEMINI_HOME decision,
 * handled where the ACP process is spawned, not here.
 *
 * Takomi never installs into ~/.gemini — that tree is Google-owned mutable
 * state (CLI/IDE/browser profiles, oauth tokens). Versioned ~560MB
 * artifacts belong in a tool dir with an active.json pointer, mirroring T3.
 */
export function resolveAntigravityBinary(
  config: AntigravityBinaryConfig = {},
): AntigravityBinaryResolution {
  const names = executableNames();
  const envBin = process.env.ANTIGRAVITY_ACP_BIN?.trim();
  const envHarness = process.env.ANTIGRAVITY_ACP_HARNESS?.trim();
  const binaryPath = config.binaryPath?.trim() || envBin || undefined;
  const harnessOpt = config.harnessPath?.trim() || envHarness || undefined;

  // 1. Explicit link.
  if (binaryPath) {
    if (!fileExists(binaryPath)) {
      return {
        source: "missing",
        detail: `Linked Antigravity server not found: ${binaryPath}`,
      };
    }
    const dir = path.dirname(binaryPath);
    const harnessPath = harnessOpt ?? path.join(dir, names.harness);
    if (!fileExists(harnessPath)) {
      return {
        source: "missing",
        detail: `Linked server found but harness helper missing: ${harnessPath} (set harnessPath explicitly if it lives elsewhere)`,
      };
    }
    return {
      source: "linked",
      executablePath: binaryPath,
      harnessPath,
      detail: `Using linked Antigravity server: ${binaryPath}`,
    };
  }

  const home = os.homedir();
  const arch = process.arch;

  // 2. T3-managed runtime, read-only reuse (T3 owns updates/removal).
  const t3Dir = config.t3Dir ?? path.join(home, ".t3");
  const t3Managed = resolveManagedDir(
    path.join(t3Dir, "tools", "antigravity-acp", platformArchDir(process.platform, arch)),
    names,
  );
  if (t3Managed?.executablePath && t3Managed?.harnessPath) {
    return {
      source: "t3-managed",
      ...t3Managed,
      detail: `Reusing T3-managed Antigravity runtime: ${t3Managed.executablePath}`,
    };
  }

  // 3. PATH.
  const onPath = findOnPath(names);
  if (onPath) {
    const dir = path.dirname(onPath);
    const harnessPath = path.join(dir, names.harness);
    return {
      source: "path",
      executablePath: onPath,
      harnessPath: fileExists(harnessPath) ? harnessPath : undefined,
      detail: `Using Antigravity server from PATH: ${onPath}`,
    };
  }

  // 4. Takomi-managed fallback (installed on demand, never in ~/.gemini).
  const takomiDir = config.takomiDir ?? path.join(home, ".takomi");
  const takomiManaged = resolveManagedDir(
    path.join(takomiDir, "tools", "antigravity-acp", platformArchDir(process.platform, arch)),
    names,
  );
  if (takomiManaged?.executablePath && takomiManaged?.harnessPath) {
    return {
      source: "takomi-managed",
      ...takomiManaged,
      detail: `Using Takomi-managed Antigravity runtime: ${takomiManaged.executablePath}`,
    };
  }

  return {
    source: "missing",
    detail:
      "No Antigravity server found. Link one via binaryPath (or ANTIGRAVITY_ACP_BIN), " +
      `reuse the T3 runtime at ${path.join(t3Dir, "tools", "antigravity-acp")}, ` +
      `or install into ${path.join(takomiDir, "tools", "antigravity-acp")} from the ACP registry.`,
  };
}

/** Takomi-managed install root for a future download (mirrors T3 layout). */
export function takomiManagedDir(takomiDir?: string): string {
  const home = takomiDir ?? path.join(os.homedir(), ".takomi");
  return path.join(
    home,
    "tools",
    "antigravity-acp",
    platformArchDir(process.platform, process.arch),
  );
}
