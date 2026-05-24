import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ContextManagerState } from "./state";

type KnownTakomiExtension = {
  toolName: string;
  relativePath: string;
};

const KNOWN_TAKOMI_EXTENSIONS: KnownTakomiExtension[] = [
  { toolName: "takomi_workflow", relativePath: path.join("takomi-runtime", "index.ts") },
  { toolName: "takomi_board", relativePath: path.join("takomi-runtime", "index.ts") },
  { toolName: "takomi_subagent", relativePath: path.join("takomi-subagents", "index.ts") },
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function homePiExtensionsRoot(): string {
  return path.join(os.homedir(), ".pi", "agent", "extensions");
}

export async function detectDuplicateTakomiExtensions(cwd: string): Promise<Array<{ toolName: string; paths: string[] }>> {
  const globalRoot = homePiExtensionsRoot();
  const projectRoot = path.resolve(cwd, ".pi", "extensions");
  const warnings: Array<{ toolName: string; paths: string[] }> = [];

  for (const known of KNOWN_TAKOMI_EXTENSIONS) {
    const globalPath = path.join(globalRoot, known.relativePath);
    const projectPath = path.join(projectRoot, known.relativePath);
    if (await exists(globalPath) && await exists(projectPath)) {
      warnings.push({ toolName: known.toolName, paths: [globalPath, projectPath] });
    }
  }

  return warnings;
}

export function renderDuplicateExtensionGuidance(warnings: Array<{ toolName: string; paths: string[] }>): string[] {
  if (warnings.length === 0) return ["- Duplicate Takomi extensions: none detected"];
  const lines = ["- Duplicate Takomi extensions detected:"];
  for (const warning of warnings) {
    lines.push(`  - ${warning.toolName}`);
    for (const filePath of warning.paths) lines.push(`    - ${filePath}`);
  }
  lines.push("- Recommended dev command: use scripts/pi-dev.ps1, which starts Pi with --no-extensions and explicit project-local Takomi extensions.");
  lines.push("- For global Pi sessions, disable/remove one duplicate source or prefer explicit extension loading to avoid tool registration conflicts.");
  return lines;
}
