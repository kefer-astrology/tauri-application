#!/usr/bin/env python3
"""Vendor or verify `contracts/` from kefer-contracts.

`contracts/` in this repository is a verified copy of
https://github.com/kefer-astrology/kefer-contracts `contracts/` at the version
recorded in `contracts/manifest.json`. Rust embeds it with `include_str!`, so
builds stay offline; do not edit files there by hand.

Usage:
  python scripts/sync-kefer-contracts.py /path/to/kefer-contracts   # copy + verify
  python scripts/sync-kefer-contracts.py --check                    # verify only

The Rust test `contract_conformance::vendored_contracts_match_manifest` runs
the same verification on every `cargo test`.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

DEST = Path(__file__).resolve().parent.parent / "contracts"


def verify(directory: Path) -> str:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    expected = manifest["files"]
    present = {
        p.relative_to(directory).as_posix()
        for p in directory.rglob("*")
        if p.is_file() and p.name != "manifest.json"
    }
    problems = [f"missing: {f}" for f in sorted(set(expected) - present)]
    problems += [f"unexpected: {f}" for f in sorted(present - set(expected))]
    for rel, digest in expected.items():
        path = directory / rel
        if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            problems.append(f"modified: {rel}")
    if problems:
        raise SystemExit("contracts do not match manifest:\n  " + "\n  ".join(problems))
    return manifest["version"]


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        print(f"contracts/ verified against manifest version {verify(DEST)}")
        return 0
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = Path(sys.argv[1]).resolve() / "contracts"
    version = verify(source)
    shutil.rmtree(DEST)
    shutil.copytree(source, DEST)
    verify(DEST)
    print(f"vendored kefer-contracts {version} into {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
