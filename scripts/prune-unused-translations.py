from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "translations.csv"
FRONTEND_SOURCE_DIRS = (
    REPO_ROOT / "apps" / "web-react" / "src",
    REPO_ROOT / "apps" / "web-svelte" / "src",
)
SOURCE_EXTENSIONS = {".cjs", ".js", ".jsx", ".mjs", ".svelte", ".ts", ".tsx"}
IGNORED_DIRS = {".svelte-kit", "build", "dist", "node_modules"}


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for source_dir in FRONTEND_SOURCE_DIRS:
        for path in source_dir.rglob("*"):
            if any(part in IGNORED_DIRS for part in path.parts):
                continue
            if path.is_file() and path.suffix in SOURCE_EXTENSIONS:
                files.append(path)
    return files


def read_csv_rows(csv_path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "internal_name" not in reader.fieldnames:
            raise ValueError("translations.csv must contain an internal_name column")
        return reader.fieldnames, list(reader)


def write_csv_rows(csv_path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        handle.write(",".join(fieldnames) + "\n")
        writer = csv.DictWriter(handle, fieldnames=fieldnames, quoting=csv.QUOTE_ALL, lineterminator="\n")
        writer.writerows(rows)


def quoted_key_pattern(key: str) -> re.Pattern[str]:
    escaped = re.escape(key)
    return re.compile(rf"(?<!\\)(['\"`]){escaped}\1")


def translation_template_patterns(source_text: str) -> list[re.Pattern[str]]:
    patterns: list[re.Pattern[str]] = []
    calls = re.finditer(r"(?:\bt|\bi18n\.t)\s*\(\s*`((?:\\`|[^`])*)`", source_text)

    for match in calls:
        template = match.group(1)
        if "${" not in template:
            continue

        static_parts = re.sub(r"\$\{[^}]*\}", "", template)
        if not re.search(r"[A-Za-z0-9_]", static_parts):
            continue

        pattern = re.escape(re.sub(r"\$\{[^}]*\}", "\0", template))
        pattern = pattern.replace("\0", r"[A-Za-z0-9_-]+")
        patterns.append(re.compile(rf"^{pattern}$"))

    return patterns


def is_used_translation_key(
    key: str,
    source_text: str,
    dynamic_patterns: list[re.Pattern[str]],
) -> tuple[bool, str | None]:
    if quoted_key_pattern(key).search(source_text):
        return True, "quoted"

    for pattern in dynamic_patterns:
        if pattern.match(key):
            return True, "dynamic"

    return False, None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove translations.csv rows unused by both React and Svelte frontends.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print unused keys without changing translations.csv.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    fieldnames, rows = read_csv_rows(CSV_PATH)
    source_files = iter_source_files()
    source_text = "\n".join(path.read_text(encoding="utf-8") for path in source_files)
    dynamic_patterns = translation_template_patterns(source_text)

    kept_rows: list[dict[str, str]] = []
    removed_rows: list[dict[str, str]] = []
    used_by_dynamic = 0

    for row in rows:
        key = row["internal_name"].strip()
        if not key:
            kept_rows.append(row)
            continue

        is_used, reason = is_used_translation_key(key, source_text, dynamic_patterns)
        if is_used:
            kept_rows.append(row)
            if reason == "dynamic":
                used_by_dynamic += 1
        else:
            removed_rows.append(row)

    if not args.dry_run:
        write_csv_rows(CSV_PATH, fieldnames, kept_rows)

    action = "Would remove" if args.dry_run else "Removed"
    print(f"Scanned {len(source_files)} frontend source files")
    print(f"Found {len(dynamic_patterns)} dynamic translation key patterns")
    print(f"{action} {len(removed_rows)} unused translation rows; kept {len(kept_rows)}")
    if used_by_dynamic:
        print(f"Kept {used_by_dynamic} keys via dynamic template matches")
    if removed_rows:
        print("\n".join(row["internal_name"] for row in removed_rows))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
