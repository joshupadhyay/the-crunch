#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "browser-use==0.12.8",
#   "litellm>=1.80.0",
# ]
# ///
"""Experimental Browser Use reservation availability probe.

This script intentionally stops before booking. It checks whether Resy or
OpenTable exposes availability for a requested restaurant/date/time/party size
and writes a JSON report for product evaluation.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from browser_use import Agent, Browser
from browser_use.llm.litellm.chat import ChatLiteLLM


ARTIFACT_DIR = Path("artifacts/browser-use")
DEFAULT_MODEL = "openrouter/deepseek/deepseek-v4-pro"


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


def resolve_model() -> str:
    model = os.getenv("BROWSER_USE_MODEL") or os.getenv("LLM_MODEL") or DEFAULT_MODEL
    if os.getenv("OPENROUTER_API_KEY") and not model.startswith("openrouter/"):
        return f"openrouter/{model}"
    return model


def platform_domains(platform: str) -> list[str]:
    if platform == "resy":
        return ["resy.com", "*.resy.com"]
    if platform == "opentable":
        return ["opentable.com", "*.opentable.com"]
    return [
        "resy.com",
        "*.resy.com",
        "opentable.com",
        "*.opentable.com",
    ]


def start_url(platform: str) -> str:
    if platform == "resy":
        return "https://resy.com"
    if platform == "opentable":
        return "https://www.opentable.com"
    return "https://www.opentable.com"


def build_task(args: argparse.Namespace) -> str:
    platform_label = {
        "resy": "Resy",
        "opentable": "OpenTable",
        "both": "Resy and OpenTable",
    }[args.platform]

    return f"""
You are evaluating restaurant reservation availability on {platform_label}.

Goal:
- Restaurant: {args.restaurant}
- City or neighborhood: {args.location}
- Date: {args.date}
- Desired time: {args.time}
- Party size: {args.party_size}

Rules:
- Do not log in, create an account, solve payment steps, enter personal info, or complete a booking.
- Do not click a final button that reserves, confirms, books, purchases, joins a waitlist, or sends a message.
- It is okay to search, choose date/time/party size controls, open a restaurant result, and read availability.
- Stop when you can report availability near the requested time or explain the blocker.
- Prefer exact visible reservation times. If none are visible, say whether the site reports no availability, needs login, blocks automation, or only shows alternate dates/times.

Return a concise structured summary with:
- platform_checked
- restaurant_found
- date_checked
- requested_time
- party_size
- available_times
- nearest_alternatives
- booking_url
- blocker
- confidence
""".strip()


async def run_probe(args: argparse.Namespace) -> dict[str, Any]:
    load_dotenv()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required for this experiment.")
    if args.cloud and not os.getenv("BROWSER_USE_API_KEY"):
        raise RuntimeError("BROWSER_USE_API_KEY is required when --cloud is enabled.")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    history_path = ARTIFACT_DIR / f"reservation-probe-{run_id}-history.json"

    model = resolve_model()
    llm = ChatLiteLLM(model=model, api_key=api_key, temperature=0.0)
    browser = Browser(
        headless=args.headless,
        use_cloud=args.cloud,
        cloud_proxy_country_code=args.proxy_country if args.cloud else None,
        allowed_domains=platform_domains(args.platform),
        downloads_path=ARTIFACT_DIR / "downloads",
        traces_dir=ARTIFACT_DIR / "traces",
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
    )

    task = f"Start at {start_url(args.platform)}.\n\n{build_task(args)}"
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        use_vision=False,
        max_actions_per_step=3,
        save_conversation_path=ARTIFACT_DIR / f"reservation-probe-{run_id}-conversation",
        final_response_after_failure=True,
    )

    try:
        history = await agent.run(max_steps=args.max_steps)
        history.save_to_file(history_path)
        return {
            "runId": run_id,
            "model": model,
            "platform": args.platform,
            "restaurant": args.restaurant,
            "location": args.location,
            "date": args.date,
            "time": args.time,
            "partySize": args.party_size,
            "cloudBrowser": args.cloud,
            "proxyCountry": args.proxy_country if args.cloud else None,
            "success": history.is_successful(),
            "steps": history.number_of_steps(),
            "durationSeconds": history.total_duration_seconds(),
            "finalResult": history.final_result(),
            "errors": history.errors(),
            "judged": history.is_judged(),
            "validated": history.is_validated(),
            "judgement": history.judgement(),
            "urls": history.urls(),
            "historyPath": str(history_path),
        }
    finally:
        await browser.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe restaurant reservation availability with Browser Use.",
    )
    parser.add_argument("--platform", choices=["resy", "opentable", "both"], default="opentable")
    parser.add_argument("--restaurant", required=True)
    parser.add_argument("--location", default="New York, NY")
    parser.add_argument("--date", required=True, help="Reservation date, e.g. 2026-06-05")
    parser.add_argument("--time", required=True, help="Desired time, e.g. 8:00 PM")
    parser.add_argument("--party-size", type=int, default=2)
    parser.add_argument("--max-steps", type=int, default=18)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--headed", action="store_true", help="Show the browser window.")
    parser.add_argument(
        "--cloud",
        action="store_true",
        help="Use Browser Use Cloud's stealth browser. Requires BROWSER_USE_API_KEY.",
    )
    parser.add_argument(
        "--proxy-country",
        default="us",
        help="Browser Use Cloud residential proxy country code. Used only with --cloud.",
    )
    args = parser.parse_args()
    args.headless = not args.headed
    return args


async def main() -> None:
    args = parse_args()
    result = await run_probe(args)
    output = args.output or ARTIFACT_DIR / f"reservation-probe-{result['runId']}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True))
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
