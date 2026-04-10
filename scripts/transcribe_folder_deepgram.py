#!/usr/bin/env python3
"""
Batch transcribe .mp4 / .mp3 in a folder with Deepgram, write .txt next to each file.

Usage:
  export DEEPGRAM_API_KEY="your_key"
  python3 scripts/transcribe_folder_deepgram.py                    # uses ~/Desktop/trancribefiles
  python3 scripts/transcribe_folder_deepgram.py /path/to/folder

Or:
  TRANSCRIBE_FOLDER=~/Desktop/my_calls python3 scripts/transcribe_folder_deepgram.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests:  pip install requests", file=sys.stderr)
    sys.exit(1)

LISTEN_URL = "https://api.deepgram.com/v1/listen"
PARAMS = {
    "model": "nova-2-phonecall",
    "smart_format": "true",
    "punctuate": "true",
}
EXTS = {".mp4", ".mp3"}


def content_type_for(path: Path) -> str:
    suf = path.suffix.lower()
    if suf == ".mp4":
        return "video/mp4"
    if suf == ".mp3":
        return "audio/mpeg"
    return "application/octet-stream"


def main() -> None:
    key = os.environ.get("DEEPGRAM_API_KEY", "").strip()
    if not key:
        print("Set DEEPGRAM_API_KEY in the environment.", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) > 1:
        folder = Path(sys.argv[1]).expanduser().resolve()
    else:
        raw = os.environ.get("TRANSCRIBE_FOLDER", "").strip()
        folder = (
            Path(raw).expanduser().resolve()
            if raw
            else (Path.home() / "Desktop" / "trancribefiles").resolve()
        )

    if not folder.is_dir():
        print(f"Folder not found: {folder}", file=sys.stderr)
        print("Create it and put .mp4/.mp3 files there, or pass a path:", file=sys.stderr)
        print(f"  python3 {sys.argv[0]} /path/to/your/recordings", file=sys.stderr)
        sys.exit(1)

    headers_base = {"Authorization": f"Token {key}"}

    files = sorted(
        p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTS
    )
    if not files:
        print(f"No .mp4 or .mp3 files in: {folder}")
        sys.exit(0)

    for filepath in files:
        print(f"Transcribing: {filepath.name}")
        ct = content_type_for(filepath)
        hdrs = {**headers_base, "Content-Type": ct}

        with open(filepath, "rb") as f:
            r = requests.post(
                LISTEN_URL,
                params=PARAMS,
                headers=hdrs,
                data=f,
                timeout=600,
            )

        try:
            data = r.json()
        except Exception:
            print(f"  HTTP {r.status_code}: non-JSON body", file=sys.stderr)
            sys.exit(1)

        if not r.ok:
            msg = data.get("err_msg") or data.get("message") or str(data)[:500]
            print(f"  Error ({r.status_code}): {msg}", file=sys.stderr)
            continue

        try:
            transcript = (
                data["results"]["channels"][0]["alternatives"][0]["transcript"]
            )
        except (KeyError, IndexError, TypeError) as e:
            print(f"  Unexpected response shape: {e}", file=sys.stderr)
            continue

        out_path = filepath.with_suffix(".txt")
        out_path.write_text((transcript or "").strip() + "\n", encoding="utf-8")
        print(f"  Saved: {out_path}\n")

    print("Done.")


if __name__ == "__main__":
    main()
