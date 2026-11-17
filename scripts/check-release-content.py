#!/usr/bin/env python3
"""Check what a release would ship against the licensing inventory.

Two registers drive the check:

* licensing/resource-inventory.json — licensing status per resource glob;
  'unresolved' and 'decision-needed' (and 'permission-scope-pending') entries
  block a release.
* licensing/approved-assets.json — every graphical export allowed to ship
  (path + SHA-256 + origin). Any exported file under the registered asset
  directories that is missing from it, or whose content changed, blocks too:
  only approved exports may be distributed.

Usage:
  python scripts/check-release-content.py                  # enforce on repo inputs
  python scripts/check-release-content.py --audit          # report only, exit 0
  python scripts/check-release-content.py --report out.json [--audit] [dir ...]

`--report` writes a verification record (commit, inventory hashes, every
blocking finding with its reason) to keep with each release (licence.md §9).
"""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INVENTORY = ROOT / "licensing" / "resource-inventory.json"
ASSETS = ROOT / "licensing" / "approved-assets.json"
BLOCKING = {"unresolved", "decision-needed", "permission-scope-pending"}
DEFAULT_TARGETS = ("static", "contracts", "src-tauri/resources")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel_path(path: Path, directory: Path) -> str:
    base = ROOT if directory.is_relative_to(ROOT) else directory
    return path.relative_to(base).as_posix()


def matches(rel: str, pattern: str) -> bool:
    # Repo-relative paths, and bundle paths by their trailing components.
    return fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch("/" + rel, "*/" + pattern.split("/", 1)[-1])


def inventory_findings(files: list[tuple[str, Path]], inventory: dict) -> list[dict]:
    entries = [e for e in inventory["entries"] if e["status"] in BLOCKING]
    findings = []
    for rel, _path in files:
        for entry in entries:
            if matches(rel, entry["glob"]):
                findings.append({
                    "file": rel, "kind": "licensing", "status": entry["status"],
                    "item": entry["item"], "decision": entry.get("decision"),
                    "reason": entry.get("reason", entry["status"]),
                })
                break
    return findings


def asset_findings(files: list[tuple[str, Path]], register: dict) -> list[dict]:
    approved = {a["path"]: a for a in register["assets"]}
    findings = []
    for rel, path in files:
        directory = next((d for d in register["asset_directories"] if matches(rel, d + "/**")), None)
        if directory is None:
            continue
        key = rel if rel in approved else next((p for p in approved if rel.endswith(p.split("/", 1)[-1])), None)
        if key is None:
            findings.append({"file": rel, "kind": "asset", "status": "not-approved",
                             "reason": "export not in licensing/approved-assets.json"})
        elif approved[key]["sha256"] != sha256(path):
            findings.append({"file": rel, "kind": "asset", "status": "changed",
                             "reason": "content differs from the approved export"})
        elif approved[key]["approval"] in BLOCKING:
            findings.append({"file": rel, "kind": "asset", "status": approved[key]["approval"],
                             "decision": approved[key].get("decision"),
                             "reason": approved[key].get("note", "asset licensing not settled")})
    return findings


def git_commit() -> str | None:
    try:
        return subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                              capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", help="directories to scan (default: repo release inputs)")
    parser.add_argument("--audit", action="store_true", help="report only; always exit 0")
    parser.add_argument("--report", type=Path, help="write a JSON verification record")
    args = parser.parse_args()

    targets = [Path(t).resolve() for t in args.targets] or [ROOT / t for t in DEFAULT_TARGETS]
    files = [(rel_path(p, d), p) for d in targets for p in sorted(d.rglob("*")) if p.is_file()]
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    register = json.loads(ASSETS.read_text(encoding="utf-8"))
    findings = inventory_findings(files, inventory)
    covered = {f["file"] for f in findings}
    findings += [f for f in asset_findings(files, register) if f["file"] not in covered]

    groups: dict[str, list[str]] = {}
    for f in findings:
        label = f"[{f['status']}] {f.get('item') or f['reason']}" + (f" (decision {f['decision']})" if f.get("decision") else "")
        groups.setdefault(label, []).append(f["file"])
    for label, items in sorted(groups.items()):
        print(f"{label}: {len(items)} file(s), e.g. {items[0]}")
    print(f"{'BLOCKED' if findings else 'OK'}: {len(findings)} file(s) with unsettled licensing in {len(files)} scanned")

    if args.report:
        record = {
            "schema_version": 1,
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "commit": git_commit(),
            "mode": "audit" if args.audit else "enforce",
            "targets": [rel_path(t, t.parent) if not t.is_relative_to(ROOT) else t.relative_to(ROOT).as_posix() for t in targets],
            "files_scanned": len(files),
            "inventory_sha256": sha256(INVENTORY),
            "approved_assets_sha256": sha256(ASSETS),
            "blocking": bool(findings),
            "summary": {label: len(items) for label, items in sorted(groups.items())},
            "findings": findings,
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print(f"verification record: {args.report}")
    return 0 if (args.audit or not findings) else 1


if __name__ == "__main__":
    sys.exit(main())
