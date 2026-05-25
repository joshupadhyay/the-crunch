#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "browser-use-sdk>=0.3.0",
#   "pydantic>=2.0.0",
# ]
# ///
"""Browser Use Cloud v3 reservation availability probe.

Uses Browser Use's managed stealth browser infrastructure. The probe checks
availability evidence and stops before any booking, waitlist, login, or personal
information step.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from browser_use_sdk.v3 import AsyncBrowserUse
from pydantic import BaseModel, Field


ARTIFACT_DIR = Path("artifacts/browser-use")
DEFAULT_MODEL = "gpt-5.4-mini"


class ReservationProbe(BaseModel):
    platform_checked: str
    restaurant_found: bool | None = None
    date_checked: str | None = None
    requested_time: str | None = None
    party_size: int | None = None
    available_times: list[str] = Field(default_factory=list)
    nearest_alternatives: list[str] = Field(default_factory=list)
    booking_url: str | None = None
    blocker: str | None = None
    confidence: str | None = None


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def build_task(args: argparse.Namespace) -> str:
    return f"""
Evaluate restaurant reservation availability on {args.platform}.

Restaurant: {args.restaurant}
Location: {args.location}
Date: {args.date}
Desired time: {args.time}
Party size: {args.party_size}

Rules:
- Do not log in, create an account, enter personal information, join waitlists, send notifications, or complete a booking.
- You may search, set party/date/time, open restaurant results, and read visible reservation times.
- Stop when you can report availability near the requested time or explain the blocker.
- Prefer exact visible reservation times.
- Include the booking URL if a restaurant-specific booking page is available.
""".strip()


async def run_probe(args: argparse.Namespace) -> dict:
    load_dotenv()

    api_key = os.getenv("BROWSER_USE_API_KEY")
    if not api_key:
        raise RuntimeError("BROWSER_USE_API_KEY is required.")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    client = AsyncBrowserUse(api_key=api_key)

    try:
        result = await client.run(
            build_task(args),
            schema=ReservationProbe,
            model=args.model,
            proxy_country_code=args.proxy_country,
            max_cost_usd=args.max_cost,
            enable_recording=True,
        )
    finally:
        await client.close()

    output = (
        result.output.model_dump()
        if hasattr(result.output, "model_dump")
        else result.output
    )
    report = {
        "runId": run_id,
        "sessionId": str(getattr(result, "id", "") or getattr(result, "session_id", "")),
        "status": str(getattr(result, "status", "")),
        "liveUrl": getattr(result, "live_url", None),
        "model": args.model,
        "proxyCountry": args.proxy_country,
        "maxCostUsd": args.max_cost,
        "output": output,
    }

    output_path = args.output or ARTIFACT_DIR / f"cloud-reservation-probe-{run_id}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True))
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe reservation availability with Browser Use Cloud v3.",
    )
    parser.add_argument("--platform", choices=["Resy", "OpenTable"], required=True)
    parser.add_argument("--restaurant", required=True)
    parser.add_argument("--location", default="New York, NY")
    parser.add_argument("--date", required=True)
    parser.add_argument("--time", required=True)
    parser.add_argument("--party-size", type=int, default=2)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--proxy-country", default="us")
    parser.add_argument("--max-cost", type=float, default=0.30)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


async def main() -> None:
    result = await run_probe(parse_args())
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
