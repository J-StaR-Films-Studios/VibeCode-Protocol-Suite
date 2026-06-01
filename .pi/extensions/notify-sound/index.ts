import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { platform } from "node:os";
import { spawn } from "node:child_process";

type NotifySoundConfig = {
  enabled: boolean;
};

const CONFIG_PATH = join(process.cwd(), ".pi", "notify-sound.json");
const STALE_AGENT_START_MS = 24 * 60 * 60 * 1000;

let config: NotifySoundConfig = { enabled: true };
let lastAgentStartedAt = 0;

export default async function notifySoundExtension(pi: ExtensionAPI) {
  await loadConfig();

  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("agent_start", async () => {
    lastAgentStartedAt = Date.now();
  });

  pi.on("agent_end", async (_event, ctx) => {
    updateStatus(ctx);

    if (!config.enabled) return;
    if (!lastAgentStartedAt) return;
    if (Date.now() - lastAgentStartedAt > STALE_AGENT_START_MS) return;

    playCompletionTune();
  });

  const command = {
    description: "Toggle or test the agent completion tune notification",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const action = args.trim().toLowerCase() || "toggle";

      if (action === "test") {
        playCompletionTune();
        ctx.ui.notify("Played completion tune.", "info");
        return;
      }

      if (action === "status") {
        updateStatus(ctx);
        ctx.ui.notify(`Completion tune is ${config.enabled ? "ON" : "OFF"}.`, "info");
        return;
      }

      if (action === "on") {
        await setEnabled(true, ctx);
        return;
      }

      if (action === "off") {
        await setEnabled(false, ctx);
        return;
      }

      if (action === "toggle") {
        await setEnabled(!config.enabled, ctx);
        return;
      }

      ctx.ui.notify("Usage: /notify [test|status|on|off|toggle]", "warning");
    },
  };

  pi.registerCommand("notify-sound", command);
  pi.registerCommand("notify", {
    ...command,
    description: "Alias for /notify-sound",
  });
}

async function loadConfig(): Promise<void> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<NotifySoundConfig>;
    config = { enabled: parsed.enabled !== false };
  } catch {
    config = { enabled: true };
    await saveConfig();
  }
}

async function saveConfig(): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function setEnabled(enabled: boolean, ctx: ExtensionContext): Promise<void> {
  config.enabled = enabled;
  await saveConfig();
  updateStatus(ctx);
  ctx.ui.notify(`Completion tune ${enabled ? "enabled" : "disabled"}.`, "info");
}

function updateStatus(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  ctx.ui.setStatus("notify-sound", ctx.ui.theme.fg("dim", `tune:${config.enabled ? "on" : "off"}`));
}

function playCompletionTune(): void {
  const os = platform();

  if (os === "win32") {
    playWindowsTune();
    return;
  }

  if (os === "darwin") {
    runDetached("osascript", ["-e", "beep 1", "-e", "delay 0.12", "-e", "beep 1", "-e", "delay 0.12", "-e", "beep 2"]);
    return;
  }

  playLinuxTune();
}

function playWindowsTune(): void {
  // A short ascending arpeggio + resolution. This is a tune, not a single alert beep.
  const melody = [
    [659, 110], // E5
    [784, 110], // G5
    [988, 150], // B5
    [1319, 210], // E6
    [1175, 120], // D6
    [1319, 260], // E6
  ];

  const commands = melody
    .map(([frequency, duration]) => `[Console]::Beep(${frequency}, ${duration})`)
    .join("; Start-Sleep -Milliseconds 35; ");

  runDetached("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    commands,
  ]);
}

function playLinuxTune(): void {
  // Prefer shell printf bells for broad compatibility; terminal may silence them.
  // If paplay/aplay exists, play the freedesktop complete sound as an additional fallback.
  runDetached("sh", [
    "-c",
    "(command -v paplay >/dev/null 2>&1 && paplay /usr/share/sounds/freedesktop/stereo/complete.oga >/dev/null 2>&1) || " +
      "(command -v aplay >/dev/null 2>&1 && aplay /usr/share/sounds/alsa/Front_Center.wav >/dev/null 2>&1) || " +
      "printf '\\a'; sleep 0.12; printf '\\a'; sleep 0.12; printf '\\a'",
  ]);
}

function runDetached(command: string, args: string[]): void {
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {
    // Notification failures should never interrupt pi.
  }
}
