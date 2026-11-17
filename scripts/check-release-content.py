#!/usr/bin/env python3
"""Fail if a release would ship resources whose licensing is not settled.

Reads licensing/resource-inventory.json and reports every file under the
given directories that matches an 'unresolved' or 'decision-needed' entry.

  python scripts/check-release-content.py                 # repo inputs (static/, contracts/, src-tauri/resources/)
  python scripts/check-release-content.py path/to/bundle  # a built bundle / dist directory

Exit status 1 when blocked files are present. Not wired into release.yml:
making releases fail on these items is an owner decision (PHASE2_READINESS.md).
"""

from __future__ import annotations

import fnmatch
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOCKING = {"unresolved", "decision-needed"}


def blocked_files(directories: list[Path]) -> list[tuple[str, dict]]:
    inventory = json.loads((ROOT / "licensing" / "resource-inventory.json").read_text(encoding="utf-8"))
    entries = [e for e in inventory["entries"] if e["status"] in BLOCKING]
    found = []
    for directory in directories:
        for path in sorted(p for p in directory.rglob("*") if p.is_file()):
            rel = path.relative_to(ROOT if directory.is_relative_to(ROOT) else directory).as_posix()
            for entry in entries:
                pattern = entry["glob"]
                # Match repo-relative paths, and bundle paths by their trailing components.
                if fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch("/" + rel, "*/" + pattern.split("/", 1)[-1]):
                    found.append((rel, entry))
                    break
    return found


def main() -> int:
    targets = [Path(a).resolve() for a in sys.argv[1:]] or [
        ROOT / "static", ROOT / "contracts", ROOT / "src-tauri" / "resources"
    ]
    found = blocked_files(targets)
    by_item: dict[str, list[str]] = {}
    for rel, entry in found:
        by_item.setdefault(f"[{entry['status']}] {entry['item']} (decision {entry.get('decision', '-')})", []).append(rel)
    for item, files in by_item.items():
        print(f"{item}: {len(files)} file(s), e.g. {files[0]}")
    if found:
        print(f"BLOCKED: {len(found)} file(s) with unsettled licensing would ship")
        return 1
    print("release content OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
