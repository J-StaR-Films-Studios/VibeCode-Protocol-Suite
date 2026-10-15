"""Transcribe one prepared audio file without persisting or logging credentials."""

import argparse
import json
import mimetypes
import os
from pathlib import Path
import sys
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', required=True, type=Path)
    parser.add_argument('--out-dir', required=True, type=Path)
    parser.add_argument('--model', default='whisper-large-v3-turbo')
    parser.add_argument('--language')
    args = parser.parse_args()
    key = os.environ.get('GROQ_API_KEY')
    if not key:
        parser.exit(1, 'GROQ_API_KEY is unavailable; no request sent.\n')
    if not args.audio.is_file():
        parser.exit(1, 'Audio file not found; no request sent.\n')
    if any((args.out_dir / name).exists() for name in ('transcript.json', 'transcript.txt')):
        parser.exit(1, 'Transcript outputs already exist; choose a new output directory.\n')
    fields = [
        ('model', args.model),
        ('response_format', 'verbose_json'),
        ('timestamp_granularities[]', 'word'),
        ('timestamp_granularities[]', 'segment'),
        ('temperature', '0'),
    ]
    if args.language:
        fields.append(('language', args.language))
    mime = mimetypes.guess_type(args.audio.name)[0] or 'application/octet-stream'
    upload_name = 'speech' + args.audio.suffix.lower()
    try:
        with args.audio.open('rb') as audio:
            response = requests.post(
                'https://api.groq.com/openai/v1/audio/transcriptions',
                headers={'Authorization': 'Bearer ' + key},
                files={'file': (upload_name, audio, mime)},
                data=fields,
                timeout=240,
            )
        if response.status_code != 200:
            print(json.dumps({'success': False, 'http_status': response.status_code,
                              'retry_after': response.headers.get('Retry-After')}))
            return 1
        result = response.json()
    except requests.RequestException:
        print(json.dumps({'success': False, 'reason': 'Connection failed or timed out'}))
        return 1
    except (ValueError, UnicodeError):
        print(json.dumps({'success': False, 'reason': 'Invalid JSON response'}))
        return 1
    if not isinstance(result, dict) or not isinstance(result.get('text'), str):
        print(json.dumps({'success': False, 'reason': 'Unexpected transcription response'}))
        return 1
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / 'transcript.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    segments = result.get('segments', [])
    lines = [f"[{s['start']:.2f} - {s['end']:.2f}] {s['text'].strip()}" for s in segments]
    (args.out_dir / 'transcript.txt').write_text(
        '\n'.join(lines) if lines else result['text'], encoding='utf-8')
    print(json.dumps({'success': True, 'language': result.get('language'),
                      'duration': result.get('duration'), 'segments': len(segments),
                      'words': len(result.get('words', []))}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
