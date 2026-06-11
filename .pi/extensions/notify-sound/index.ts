import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir, platform } from "node:os";
import { spawn } from "node:child_process";

type NotifySoundConfig = {
  enabled: boolean;
};

type NotifyMethod = "auto" | "wav";

const GLOBAL_NOTIFY_DIR = join(homedir(), ".pi", "agent", "notify-sound");
const CONFIG_PATH = join(GLOBAL_NOTIFY_DIR, "notify-sound.json");
const WAV_PATH = join(GLOBAL_NOTIFY_DIR, "notify-sound.wav");
const PS1_PATH = join(GLOBAL_NOTIFY_DIR, "notify-sound.ps1");
const VBS_PATH = join(GLOBAL_NOTIFY_DIR, "notify-sound.vbs");
const STALE_AGENT_START_MS = 24 * 60 * 60 * 1000;

let config: NotifySoundConfig = { enabled: true };
let lastAgentStartedAt = 0;

export default async function notifySoundExtension(pi: ExtensionAPI) {
  await loadConfig();
  await ensureTuneWav();

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
    getArgumentCompletions: (argumentPrefix: string) => {
      const token = argumentPrefix.trim().toLowerCase();
      return [
        { value: "status", label: "status", description: "Show whether the completion tune is on" },
        { value: "test", label: "test", description: "Play the completion tune" },
        { value: "test wav", label: "test wav", description: "Play the generated WAV completion tune" },
        { value: "on", label: "on", description: "Enable the completion tune" },
        { value: "off", label: "off", description: "Disable the completion tune" },
        { value: "toggle", label: "toggle", description: "Toggle the completion tune" },
      ].filter((completion) => !token || completion.value.startsWith(token));
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const action = args.trim().toLowerCase() || "toggle";

      if (action === "test") {
        playCompletionTune("wav");
        ctx.ui.notify("Played completion tune using WAV mode. This is the default reliable Windows path.", "info");
        return;
      }

      if (action === "test wav") {
        playCompletionTune("wav");
        ctx.ui.notify("Played completion tune using WAV mode.", "info");
        return;
      }

      if (action.startsWith("test ")) {
        ctx.ui.notify("Usage: /notify test", "warning");
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

async function ensureTuneWav(): Promise<void> {
  await mkdir(dirname(WAV_PATH), { recursive: true });
  await writeFile(WAV_PATH, createTuneWav(), "binary");
  const wav = WAV_PATH.replace(/'/g, "''");
  await writeFile(PS1_PATH, [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `if (Test-Path '${wav}') {`,
    `  $p = New-Object System.Media.SoundPlayer '${wav}'`,
    "  $p.Load()",
    "  $p.PlaySync()",
    "}",
    "[System.Media.SystemSounds]::Asterisk.Play()",
    "Start-Sleep -Milliseconds 250",
    "",
  ].join("\n"), "utf8");
  const ps1 = PS1_PATH.replace(/"/g, "\"\"");
  await writeFile(VBS_PATH, [
    "Set shell = CreateObject(\"WScript.Shell\")",
    `shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""${ps1}""", 0, False`,
    "",
  ].join("\r\n"), "utf8");
}

function createTuneWav(): Buffer {
  const sampleRate = 44100;
  const notes = [
    [659, 0.11],
    [784, 0.11],
    [988, 0.15],
    [1319, 0.21],
    [1175, 0.12],
    [1319, 0.26],
  ];
  const gapSeconds = 0.035;
  const samples: number[] = [];

  for (const [freq, seconds] of notes) {
    const count = Math.floor(sampleRate * seconds);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      const fadeIn = Math.min(1, i / 120);
      const fadeOut = Math.min(1, (count - i) / 300);
      const env = Math.min(fadeIn, fadeOut) * 0.28;
      samples.push(Math.sin(2 * Math.PI * freq * t) * env);
    }
    for (let i = 0; i < Math.floor(sampleRate * gapSeconds); i++) samples.push(0);
  }

  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (const sample of samples) {
    const value = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(value * 32767), offset);
    offset += 2;
  }
  return buffer;
}

function updateStatus(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  ctx.ui.setStatus("notify-sound", ctx.ui.theme.fg("dim", `tune:${config.enabled ? "on" : "off"}`));
}

function playCompletionTune(method: NotifyMethod = "auto"): void {
  const os = platform();

  if (os === "win32") {
    playWindowsTune(method);
    return;
  }

  if (os === "darwin") {
    runDetached("osascript", ["-e", "beep 1", "-e", "delay 0.12", "-e", "beep 1", "-e", "delay 0.12", "-e", "beep 2"]);
    return;
  }

  playLinuxTune();
}

function playWindowsTune(method: NotifyMethod): void {
  // Windows uses the generated WAV path because Console.Beep, system sounds,
  // and terminal bells are silent on many modern Windows machines.
  playWindowsWav();
}

function playWindowsWav(): void {
  // WScript launches the PowerShell player hidden without stealing focus. This
  // is more reliable than spawning hidden PowerShell directly from Pi's TUI.
  runDetached("wscript.exe", [VBS_PATH]);
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
      shell: false,
    });
    child.unref();
  } catch {
    // Notification failures should never interrupt pi.
  }
}
