#!/usr/bin/env python3
"""Generate a validated SPK Type 13 from JPL Horizons geometric vectors.

Horizons remains an acquisition-time source.  The produced BSP and its adjacent
``.bsp.json`` manifest are the only artifacts consumed by the application.
NAIF's ``mkspk`` utility is required and is intentionally not downloaded by this
script so its executable can be pinned by the release/build environment.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import pathlib
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable


HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api"
J2000_JD = 2_451_545.0
SECONDS_PER_DAY = 86_400.0


@dataclass(frozen=True)
class State:
    jd_tdb: float
    values: tuple[float, float, float, float, float, float]

    @property
    def et_seconds(self) -> float:
        return (self.jd_tdb - J2000_JD) * SECONDS_PER_DAY


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected YYYY-MM-DD") from exc


def horizons_request(
    command: str, start: date, stop: date, step_days: float
) -> tuple[list[State], str, dict[str, str]]:
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "'500@10'",
        "START_TIME": f"'{start.isoformat()}'",
        "STOP_TIME": f"'{stop.isoformat()}'",
        "STEP_SIZE": f"'{step_days:g} d'",
        "VEC_TABLE": "2",
        "REF_SYSTEM": "ICRF",
        "REF_PLANE": "FRAME",
        "OUT_UNITS": "KM-S",
        "VEC_CORR": "NONE",
        "CSV_FORMAT": "YES",
    }
    url = f"{HORIZONS_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "KeferAstrology-SPK-Builder/1"})
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(f"Horizons rejected the request: {payload['error']}")
    result = payload.get("result", "")
    try:
        table = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    except IndexError as exc:
        raise RuntimeError("Horizons response did not contain a vector table") from exc

    states: list[State] = []
    for row in csv.reader(table.splitlines()):
        if not row or not row[0].strip():
            continue
        values = [cell.strip() for cell in row]
        states.append(
            State(
                jd_tdb=float(values[0]),
                values=tuple(float(value) for value in values[2:8]),  # type: ignore[arg-type]
            )
        )
    if len(states) < 2:
        raise RuntimeError("Horizons returned fewer than two state vectors")
    lines = [line.strip() for line in result.splitlines()]
    metadata: dict[str, str] = {}
    for key, prefix in (
        ("resolved_target", "Target body name:"),
        ("resolved_center", "Center body name:"),
    ):
        match = next((line for line in lines if line.startswith(prefix)), None)
        if match:
            metadata[key] = match.removeprefix(prefix).strip()
    solution = next((line for line in lines if "Soln.date:" in line and line.startswith("Rec #:")), None)
    if solution:
        metadata["solution_record"] = solution
    return states, url, metadata


def date_chunks(start: date, stop: date, years: int) -> Iterable[tuple[date, date]]:
    cursor = start
    while cursor < stop:
        try:
            boundary = cursor.replace(year=cursor.year + years)
        except ValueError:
            boundary = cursor.replace(month=2, day=28, year=cursor.year + years)
        chunk_stop = min(boundary, stop)
        yield cursor, chunk_stop
        cursor = chunk_stop


def fetch_range(
    command: str, start: date, stop: date, step_days: float, chunk_years: int
) -> tuple[list[State], list[str], dict[str, str]]:
    by_epoch: dict[float, State] = {}
    urls: list[str] = []
    source_metadata: dict[str, str] = {}
    for chunk_start, chunk_stop in date_chunks(start, stop, chunk_years):
        states, url, metadata = horizons_request(command, chunk_start, chunk_stop, step_days)
        urls.append(url)
        by_epoch.update((state.jd_tdb, state) for state in states)
        if not source_metadata:
            source_metadata = metadata
        elif metadata != source_metadata:
            raise RuntimeError("Horizons target/solution metadata changed between chunks")
    return [by_epoch[key] for key in sorted(by_epoch)], urls, source_metadata


def hermite_value_and_derivative(samples: list[tuple[float, float, float]], epoch: float) -> tuple[float, float]:
    """Evaluate the Newton-form Hermite polynomial and its derivative."""
    count = len(samples)
    size = count * 2
    nodes = [0.0] * size
    divided = [[0.0] * size for _ in range(size)]
    for index, (sample_epoch, value, derivative) in enumerate(samples):
        row = index * 2
        nodes[row] = sample_epoch
        nodes[row + 1] = sample_epoch
        divided[row][0] = value
        divided[row + 1][0] = value
        divided[row + 1][1] = derivative
        if index == 0:
            divided[row][1] = derivative
        else:
            divided[row][1] = (divided[row][0] - divided[row - 1][0]) / (nodes[row] - nodes[row - 1])
    for order in range(2, size):
        for row in range(order, size):
            divided[row][order] = (divided[row][order - 1] - divided[row - 1][order - 1]) / (
                nodes[row] - nodes[row - order]
            )

    value = divided[size - 1][size - 1]
    derivative = 0.0
    for index in range(size - 2, -1, -1):
        derivative = derivative * (epoch - nodes[index]) + value
        value = value * (epoch - nodes[index]) + divided[index][index]
    return value, derivative


def interpolation_window(states: list[State], epoch: float, state_count: int) -> list[State]:
    insertion = 0
    while insertion < len(states) and states[insertion].et_seconds < epoch:
        insertion += 1
    start = max(0, min(insertion - state_count // 2, len(states) - state_count))
    return states[start : start + state_count]


def validate_interpolation(source: list[State], reference: list[State], degree: int) -> dict[str, float | int | bool | str]:
    state_count = (degree + 1) // 2
    max_position = 0.0
    max_velocity = 0.0
    for expected in reference:
        window = interpolation_window(source, expected.et_seconds, state_count)
        if len(window) != state_count:
            raise RuntimeError("not enough source states for the requested polynomial degree")
        predicted: list[float] = []
        for axis in range(3):
            samples = [
                (item.et_seconds, item.values[axis], item.values[axis + 3]) for item in window
            ]
            position, velocity = hermite_value_and_derivative(samples, expected.et_seconds)
            predicted.extend((position, velocity))
        position_error = math.sqrt(
            sum((predicted[axis * 2] - expected.values[axis]) ** 2 for axis in range(3))
        )
        velocity_error = math.sqrt(
            sum((predicted[axis * 2 + 1] - expected.values[axis + 3]) ** 2 for axis in range(3))
        )
        max_position = max(max_position, position_error)
        max_velocity = max(max_velocity, velocity_error)
    return {
        "method": "held_out_horizons_vectors",
        "passed": True,
        "sample_count": len(reference),
        "max_position_error_km": max_position,
        "max_velocity_error_km_s": max_velocity,
        "probe_et_seconds": reference[len(reference) // 2].et_seconds,
    }


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_setup(path: pathlib.Path, args: argparse.Namespace) -> None:
    path.write_text(
        "\\begindata\n"
        "INPUT_DATA_TYPE   = 'STATES'\n"
        "OUTPUT_SPK_TYPE   = 13\n"
        f"OBJECT_ID         = {args.naif_target_id}\n"
        f"OBJECT_NAME       = '{args.name.upper()}'\n"
        "CENTER_ID         = 10\n"
        "CENTER_NAME       = 'SUN'\n"
        "REF_FRAME_NAME    = 'J2000'\n"
        "PRODUCER_ID       = 'Kefer Astrology; source JPL Horizons'\n"
        "DATA_ORDER        = 'EPOCH X Y Z VX VY VZ'\n"
        "INPUT_DATA_UNITS  = ('ANGLES=DEGREES' 'DISTANCES=KM')\n"
        "DATA_DELIMITER    = ' '\n"
        "LINES_PER_RECORD  = 1\n"
        "TIME_WRAPPER      = '# ETSECONDS'\n"
        f"LEAPSECONDS_FILE  = '{args.lsk.resolve()}'\n"
        f"POLYNOM_DEGREE    = {args.degree}\n"
        f"SEGMENT_ID        = 'KEFER {args.name.upper()} HORIZONS TYPE 13'\n"
        "\\begintext\n",
        encoding="ascii",
    )


def build(args: argparse.Namespace) -> None:
    if args.start >= args.stop:
        raise SystemExit("--start must be earlier than --stop")
    if args.step_days <= 0 or args.validation_stride <= 0 or args.chunk_years <= 0:
        raise SystemExit("step, validation stride, and chunk size must be positive")
    if args.degree < 3 or args.degree % 4 != 3:
        raise SystemExit("--degree must be 3 mod 4 (3, 7, 11, ...)")
    if args.output.exists() and not args.force:
        raise SystemExit(f"output already exists: {args.output} (use --force to replace it)")
    if not args.mkspk.is_file() or not os.access(args.mkspk, os.X_OK):
        raise SystemExit(f"mkspk is not executable: {args.mkspk}")
    if not args.lsk.is_file():
        raise SystemExit(f"leapseconds kernel not found: {args.lsk}")

    source, source_urls, source_metadata = fetch_range(
        args.command, args.start, args.stop, args.step_days, args.chunk_years
    )
    validation_start = args.start + timedelta(days=args.step_days / 2.0)
    validation_step = args.step_days * args.validation_stride
    reference, validation_urls, validation_metadata = fetch_range(
        args.command, validation_start, args.stop, validation_step, args.chunk_years
    )
    if validation_metadata != source_metadata:
        raise RuntimeError("Horizons target/solution metadata changed between source and validation requests")
    validation = validate_interpolation(source, reference, args.degree)
    if validation["max_position_error_km"] > args.max_position_error_km:
        raise SystemExit(
            f"position validation failed: {validation['max_position_error_km']:.9g} km > "
            f"{args.max_position_error_km:g} km"
        )
    if validation["max_velocity_error_km_s"] > args.max_velocity_error_km_s:
        raise SystemExit(
            f"velocity validation failed: {validation['max_velocity_error_km_s']:.9g} km/s > "
            f"{args.max_velocity_error_km_s:g} km/s"
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="kefer-spk-") as temporary:
        temporary_path = pathlib.Path(temporary)
        states_path = temporary_path / "states.txt"
        setup_path = temporary_path / "mkspk.setup"
        output_path = temporary_path / args.output.name
        with states_path.open("w", encoding="ascii") as handle:
            for state in source:
                fields = (state.et_seconds, *state.values)
                handle.write(" ".join(f"{value:.16e}" for value in fields) + "\n")
        write_setup(setup_path, args)
        completed = subprocess.run(
            [str(args.mkspk.resolve()), "-setup", str(setup_path), "-input", str(states_path), "-output", str(output_path)],
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0 or not output_path.exists():
            raise RuntimeError(f"mkspk failed:\n{completed.stdout}\n{completed.stderr}")
        # Temporary directories may be on another filesystem than the workspace.
        # Copy to an adjacent partial file, then atomically publish on the target FS.
        partial_output = args.output.with_suffix(args.output.suffix + ".partial")
        shutil.copyfile(output_path, partial_output)
        os.replace(partial_output, args.output)

    digest = sha256(args.output)
    manifest = {
        "schema_version": 1,
        "artifact_kind": "horizons-sampled-spk",
        "body_id": args.body_id,
        "display_name": args.name,
        "filename": args.output.name,
        "naif_target_id": args.naif_target_id,
        "naif_center_id": 10,
        "reference_frame": "J2000",
        "spk_type": 13,
        "coverage": {
            "start": args.start.isoformat(),
            "stop": args.stop.isoformat(),
            "start_et_seconds": source[0].et_seconds,
            "stop_et_seconds": source[-1].et_seconds,
        },
        "source": {
            "service": "NASA/JPL Horizons API",
            "endpoint": HORIZONS_API,
            "command": args.command,
            "center": "500@10",
            "reference_system": "ICRF",
            "reference_plane": "FRAME",
            "vector_corrections": "NONE",
            "units": "KM-S",
            **source_metadata,
            "request_urls": source_urls,
        },
        "generation": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator": "scripts/generate-horizons-type13.py",
            "sample_step_days": args.step_days,
            "polynomial_degree": args.degree,
            "source_sample_count": len(source),
        },
        "sha256": digest,
        "validation": {
            **validation,
            "max_allowed_position_error_km": args.max_position_error_km,
            "max_allowed_velocity_error_km_s": args.max_velocity_error_km_s,
            "request_urls": validation_urls,
        },
    }
    manifest_path = args.output.with_suffix(args.output.suffix + ".json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"generated {args.output} ({args.output.stat().st_size} bytes, sha256 {digest})")
    print(
        "validation: "
        f"{validation['sample_count']} samples, "
        f"{validation['max_position_error_km']:.9g} km position, "
        f"{validation['max_velocity_error_km_s']:.9g} km/s velocity"
    )
    print(f"manifest: {manifest_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--command", default="2060", help="Horizons COMMAND value")
    parser.add_argument("--body-id", default="chiron", help="stable Kefer body ID")
    parser.add_argument("--name", default="Chiron", help="display/object name")
    parser.add_argument("--naif-target-id", type=int, default=20_002_060)
    parser.add_argument("--start", type=parse_date, required=True)
    parser.add_argument("--stop", type=parse_date, required=True)
    parser.add_argument("--step-days", type=float, default=4.0)
    parser.add_argument("--validation-stride", type=int, default=8)
    parser.add_argument("--chunk-years", type=int, default=10)
    parser.add_argument("--degree", type=int, default=7)
    parser.add_argument("--max-position-error-km", type=float, default=1.0)
    parser.add_argument("--max-velocity-error-km-s", type=float, default=1e-5)
    parser.add_argument("--mkspk", type=pathlib.Path, required=True)
    parser.add_argument("--lsk", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--force", action="store_true")
    build(parser.parse_args())


if __name__ == "__main__":
    main()
