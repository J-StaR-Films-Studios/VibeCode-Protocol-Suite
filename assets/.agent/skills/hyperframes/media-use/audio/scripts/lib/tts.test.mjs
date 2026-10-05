import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import {
  parseFfmpegDurationBanner,
  ffprobeDuration,
  synthesizeOne,
  synthesizeHeygen,
  synthResult,
} from "./tts.mjs";

test("parseFfmpegDurationBanner reads ffmpeg's stderr Duration line", () => {
  const stderr = [
    "ffmpeg version 6.0",
    "Input #0, wav, from 'a.wav':",
    "  Duration: 00:00:03.42, bitrate: 705 kb/s",
    "At least one output file must be specified",
  ].join("\n");
  assert.equal(parseFfmpegDurationBanner(stderr), 3.42);
});

test("parseFfmpegDurationBanner handles an hours component", () => {
  const stderr = "  Duration: 01:02:03.50, start: 0.000000, bitrate: 128 kb/s";
  assert.equal(parseFfmpegDurationBanner(stderr), 3723.5);
});

test("parseFfmpegDurationBanner returns NaN when there is no Duration line", () => {
  assert.ok(Number.isNaN(parseFfmpegDurationBanner("ffmpeg: command not found")));
  assert.ok(Number.isNaN(parseFfmpegDurationBanner("")));
  assert.ok(Number.isNaN(parseFfmpegDurationBanner(undefined)));
});

// Regression for the actual bug: ffprobeDuration used to collapse "ffprobe
// binary is missing" (ENOENT — the "essentials"-style Windows ffmpeg build
// with no ffprobe.exe) and "file is genuinely unreadable" into the same NaN,
// giving audio.mjs no way to tell "measure differently" from "give up".
//
// Inject both subprocess outcomes so this regression exercises ENOENT fallback
// on every platform without depending on shell scripts or installed binaries.
test("ffprobeDuration falls back to ffmpeg when the ffprobe binary itself is missing", () => {
  const calls = [];
  const spawnFn = (command, args, options) => {
    calls.push({ command, args, options });
    if (command === "ffprobe") return { error: { code: "ENOENT" } };
    return {
      status: 1,
      stderr: "Duration: 00:00:02.50, start: 0.000000, bitrate: 128 kb/s",
    };
  };
  assert.equal(ffprobeDuration("input.wav", spawnFn), 2.5);
  assert.deepEqual(calls.map(({ command }) => command), ["ffprobe", "ffmpeg"]);
  assert.deepEqual(calls[1].args, ["-i", "input.wav"]);
});

test("ffprobeDuration returns NaN when neither ffprobe nor ffmpeg resolve", () => {
  const dir = mkdtempSync(join(tmpdir(), "tts-no-binaries-"));
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = dir; // empty directory — nothing resolves
    assert.ok(Number.isNaN(ffprobeDuration("/does/not/matter.wav")));
  } finally {
    process.env.PATH = originalPath;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("synthesizeOne(elevenlabs) creates the output dir before writing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tts-el-mkdir-"));
  const wavAbs = join(dir, "assets", "voice", "line-0.wav"); // nested, not yet created
  const savedKey = process.env.ELEVENLABS_API_KEY;
  try {
    // Unset the key so the Python side fails fast — the mkdir must run before
    // the spawn regardless, which is what this guards.
    delete process.env.ELEVENLABS_API_KEY;
    await synthesizeOne({
      provider: "elevenlabs",
      text: "hi",
      voiceId: "v",
      wavAbs,
      hyperframesDir: dir,
    });
    assert.ok(existsSync(dirname(wavAbs)), "output directory should be created");
  } finally {
    if (savedKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = savedKey;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("synthesizeHeygen surfaces a thrown HTTP error (e.g. 402) instead of swallowing it", async () => {
  const res = await synthesizeHeygen(
    { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: "/tmp/x.wav" },
    {
      heygenAuthHeaders: () => ({}),
      heygenJSON: async () => {
        throw new Error("HeyGen POST /voices/speech → HTTP 402\nplan_upgrade_required");
      },
    },
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /402/);
  assert.match(res.error, /plan_upgrade_required/);
});

test("synthesizeHeygen surfaces a failed audio_url fetch with its status", async () => {
  const res = await synthesizeHeygen(
    { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: "/tmp/x.wav" },
    {
      heygenAuthHeaders: () => ({}),
      heygenJSON: async () => ({ data: { audio_url: "http://audio.example/x" } }),
      fetch: async () => ({ ok: false, status: 403 }),
    },
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /HTTP 403/);
});

test("synthesizeHeygen reports a missing audio_url", async () => {
  const res = await synthesizeHeygen(
    { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: "/tmp/x.wav" },
    { heygenAuthHeaders: () => ({}), heygenJSON: async () => ({}) },
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /no audio_url/);
});

test("synthesizeHeygen reports wav transcode failures", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hf-tts-test-"));
  try {
    const res = await synthesizeHeygen(
      { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: join(dir, "voice.wav") },
      {
        heygenAuthHeaders: () => ({}),
        heygenJSON: async () => ({ data: { audio_url: "http://audio.example/x" } }),
        fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }),
        transcodeToWav: () => false,
      },
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, "wav transcode failed (ffmpeg)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("synthResult names a non-zero subprocess exit", () => {
  const res = synthResult({ status: 2 }, "/tmp/none.wav", "kokoro (npx hyperframes tts)");
  assert.equal(res.ok, false);
  assert.match(res.error, /kokoro .* exited with status 2/);
});
