# Groq transcription

Use the Groq transcription service first. This skill contains no API key. A key supplied in an earlier chat is not automatically available to another agent.

## Credentials

Read GROQ_API_KEY from the current process environment or the user's approved secret store. Check availability without printing its value. Do not search arbitrary personal files for credentials or copy them into the skill, transcript, command-line arguments, logs, ZIP or handoff.

If no key is available, ask the user to set it securely for the new agent. On PowerShell, the user can set a process-scoped value without typing it in chat:

```powershell
$groqSecret = Read-Host 'Groq API key' -AsSecureString
$env:GROQ_API_KEY = [System.Net.NetworkCredential]::new('', $groqSecret).Password
Remove-Variable groqSecret
```

The transcription process must inherit that environment. A separate terminal's environment does not automatically reach an already-running agent. Prefer the application's secure secret mechanism when available. Do not claim the key is configured until the transcription process can read it.

If the user explicitly supplies a temporary key for this chat, use it only for that authorized session. Never echo it, embed it in generated code, or transfer it to another agent. Remove temporary process copies when finished. Do not persist it in a profile, system environment or shared configuration.

## Prepare and transcribe

Extract the intended speech stream from the linked audio. For a transcription copy, 16 kHz mono can reduce upload size; keep the master audio unchanged. Confirm stream selection when there are multiple audio tracks.

```powershell
ffmpeg -hide_banner -i 'source-video.mp4' -map 0:a:0 -vn -ar 16000 -ac 1 -c:a flac 'work/speech.flac'
python '<skill-folder>/scripts/transcribe_groq.py' --audio 'work/speech.flac' --out-dir 'work/transcription'
```

The helper uses Python requests for multipart uploads. Install requests in the chosen Python environment if unavailable. The standard urllib client returned HTTP 403 with a valid key in this workflow; the requests client succeeded with the same endpoint. Do not replace this client with the default urllib request implementation.

The helper defaults to whisper-large-v3-turbo and requests verbose_json with word and segment timestamps. Use --model whisper-large-v3 for a targeted recognition comparison when needed. When the spoken language is known, pass --language, for example --language en for English. Auto-detection misidentified this English sermon as Yoruba. Leave language unset when it is genuinely unknown or needs multilingual assessment.

Check the current account upload limit before sending a large file. Compress or split when needed. For chunks, maintain exact source offsets, use short overlaps and reconcile duplicate boundary words before assembling the transcript. The helper transcribes one file; it does not perform chunk stitching or align the transcript to an edited timeline.

Keep raw JSON and a readable timestamped transcript. For later captions, convert source times through the edit map and proof against rendered speech.

## Failures

The helper prints sanitized status only. Missing key, missing file or HTTP failure must not become invented transcription success.

- 401: Ask the user to check the key. Do not repeatedly retry invalid credentials.
- 403: Do not conclude that the key is invalid from status alone. Confirm the bundled requests client is being used. If an older urllib helper failed, retry once with this helper and the same authorized key. If requests also receives 403, ask the user to check account access or network restrictions. Do not print authorization headers or secrets.
- 413: Reduce the file or split with offsets.
- 429: Respect the service's retry interval and account limits. Avoid tight retry loops.
- Timeout or 5xx: A bounded retry may be appropriate. Report persistent failure.

After Groq fails, the user may provide a new temporary key. Reuse the same prepared audio. Resolve transcription or another local method is a fallback when available and consistent with the user's instructions.

API details were checked against [Groq's API reference](https://console.groq.com/docs/api-reference) and [speech-to-text guide](https://console.groq.com/docs/speech-to-text) on 2026-10-01. Recheck provider details if requests fail or the documentation changes.
