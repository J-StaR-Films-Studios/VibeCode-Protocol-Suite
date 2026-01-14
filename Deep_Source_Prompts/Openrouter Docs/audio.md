# Audio Inputs

> Send audio files to speech-capable models through the OpenRouter API.

OpenRouter supports sending audio files to compatible models via the API. This guide will show you how to work with audio using our API.

**Note**: Audio files must be **base64-encoded** - direct URLs are not supported for audio content.

## Audio Inputs

Requests with audio files to compatible models are available via the `/api/v1/chat/completions` API with the `input_audio` content type. Audio files must be base64-encoded and include the format specification. Note that only models with audio processing capabilities will handle these requests.

You can search for models that support audio by filtering to audio input modality on our [Models page](/models?fmt=cards\&input_modalities=audio).

### Sending Audio Files

Here's how to send an audio file for processing:

<Template
  data={{
  API_KEY_REF,
  MODEL: 'google/gemini-2.5-flash'
}}
>
  <CodeGroup>
    ```typescript title="TypeScript SDK"
    import { OpenRouter } from '@openrouter/sdk';
    import fs from "fs/promises";

    const openRouter = new OpenRouter({
      apiKey: '{{API_KEY_REF}}',
    });

    async function encodeAudioToBase64(audioPath: string): Promise<string> {
      const audioBuffer = await fs.readFile(audioPath);
      return audioBuffer.toString("base64");
    }

    // Read and encode the audio file
    const audioPath = "path/to/your/audio.wav";
    const base64Audio = await encodeAudioToBase64(audioPath);

    const result = await openRouter.chat.send({
      model: "{{MODEL}}",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please transcribe this audio file.",
            },
            {
              type: "input_audio",
              inputAudio: {
                data: base64Audio,
                format: "wav",
              },
            },
          ],
        },
      ],
      stream: false,
    });

    console.log(result);
    ```

    ```python
    import requests
    import json
    import base64

    def encode_audio_to_base64(audio_path):
        with open(audio_path, "rb") as audio_file:
            return base64.b64encode(audio_file.read()).decode('utf-8')

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY_REF}",
        "Content-Type": "application/json"
    }

    # Read and encode the audio file
    audio_path = "path/to/your/audio.wav"
    base64_audio = encode_audio_to_base64(audio_path)

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Please transcribe this audio file."
                },
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": base64_audio,
                        "format": "wav"
                    }
                }
            ]
        }
    ]

    payload = {
        "model": "{{MODEL}}",
        "messages": messages
    }

    response = requests.post(url, headers=headers, json=payload)
    print(response.json())
    ```

    ```typescript title="TypeScript (fetch)"
    import fs from "fs/promises";

    async function encodeAudioToBase64(audioPath: string): Promise<string> {
      const audioBuffer = await fs.readFile(audioPath);
      return audioBuffer.toString("base64");
    }

    // Read and encode the audio file
    const audioPath = "path/to/your/audio.wav";
    const base64Audio = await encodeAudioToBase64(audioPath);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY_REF}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "{{MODEL}}",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please transcribe this audio file.",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: "wav",
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    console.log(data);
    ```
  </CodeGroup>
</Template>

Supported audio formats vary by provider. Common formats include:

* `wav` - WAV audio
* `mp3` - MP3 audio
* `aiff` - AIFF audio
* `aac` - AAC audio
* `ogg` - OGG Vorbis audio
* `flac` - FLAC audio
* `m4a` - M4A audio
* `pcm16` - PCM16 audio
* `pcm24` - PCM24 audio

**Note:** Check your model's documentation to confirm which audio formats it supports. Not all models support all formats.
