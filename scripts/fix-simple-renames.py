#!/usr/bin/env python3
from __future__ import annotations
import pathlib
import re
import sys

ROOTS = ["server", "shared", "client"]
EXTS = {".ts", ".tsx"}

REPLACEMENTS = [
    (re.compile(r"\bofficeSize\b"), "officeSizeSqm"),
    (re.compile(r"\bestimatedValueRange\b"), "estimatedValueMin"),
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

def process_file(path: pathlib.Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text
    for pattern, replacement in REPLACEMENTS:
        text = pattern.sub(replacement, text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        print(path)
        return True
    return False

def main() -> int:
    changed = 0
    for root in ROOTS:
        base = pathlib.Path(root)
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix not in EXTS or should_skip(path):
                continue
            try:
                if process_file(path):
                    changed += 1
            except Exception as exc:
                print(f"ERR {path}: {exc}", file=sys.stderr)
    print(f"\nChanged files: {changed}")
    print("Note: review all officeSize -> officeSizeSqm changes before commit.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
