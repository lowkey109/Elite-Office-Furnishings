#!/usr/bin/env python3
from __future__ import annotations
import pathlib
import re
import sys

ROOTS = ["server", "shared", "client"]
EXTS = {".ts", ".tsx"}

COLUMN_NAMES = [
    "payloadJson",
    "detailsJson",
    "metadataJson",
    "rawPayloadJson",
    "signalsJson",
]

SKIP_CONTAINS = {
    "node_modules/",
    "/dist/",
    "/build/",
    ".d.ts",
}

def should_skip(path: pathlib.Path) -> bool:
    p = str(path)
    return any(x in p for x in SKIP_CONTAINS)

def replace_simple_json_stringify(text: str) -> tuple[str, int]:
    total = 0
    for col in COLUMN_NAMES:
        pattern = re.compile(rf"(\b{col}\s*:\s*)JSON\.stringify\(([^()\n;]+)\)")
        text, count = pattern.subn(r"\1\2", text)
        total += count
    return text, total

def process_file(path: pathlib.Path) -> int:
    text = path.read_text(encoding="utf-8")
    updated, count = replace_simple_json_stringify(text)
    if count:
        path.write_text(updated, encoding="utf-8")
        print(f"{path}: {count}")
    return count

def main() -> int:
    total_changes = 0
    changed_files = 0
    for root in ROOTS:
        base = pathlib.Path(root)
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix not in EXTS or should_skip(path):
                continue
            try:
                count = process_file(path)
                if count:
                    changed_files += 1
                    total_changes += count
            except Exception as exc:
                print(f"ERR {path}: {exc}", file=sys.stderr)
    print(f"\nChanged files: {changed_files}")
    print(f"Total replacements: {total_changes}")
    print("Review all changes before commit. Complex JSON.stringify(...) calls are intentionally left untouched.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
