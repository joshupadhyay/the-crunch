# Browser Use Reservation Spike

This branch experiments with using [`browser-use`](https://github.com/browser-use/browser-use) to check live reservation availability on Resy and OpenTable.

## Why This Is Separate From The Chat Runtime

Browser Use is Python-first and launches a real Chromium browser. That is a poor fit for the current Lambda Function URL app runtime:

- Chromium is large and memory-heavy compared with the existing Bun chat server.
- Resy/OpenTable often use bot defenses, cookies, location state, and dynamic widgets.
- Booking is a high-trust action. The first production shape should check availability and hand the user a booking link, not click final confirmation.

The safer architecture is an async worker later:

1. The chat app asks for restaurant, date, time, party size, and platform.
2. The app queues a reservation probe job.
3. A worker with browser isolation runs Browser Use.
4. The worker returns available times, nearest alternatives, screenshots/history, and a direct booking URL.
5. The user manually completes the booking.

## Local Probe

Run the probe with the OpenRouter key in `.env`:

```sh
bun run reservation:probe -- \
  --platform opentable \
  --restaurant "L'Artusi" \
  --location "New York, NY" \
  --date 2026-06-05 \
  --time "8:00 PM" \
  --party-size 2
```

For Resy:

```sh
bun run reservation:probe -- \
  --platform resy \
  --restaurant "Dhamaka" \
  --location "New York, NY" \
  --date 2026-06-05 \
  --time "8:00 PM" \
  --party-size 2
```

Reports are written to `artifacts/browser-use/` and are ignored by git.

## Cloud Stealth Probe

Browser Use does support an "undetectable" browser, but it is part of Browser
Use Cloud rather than the plain local open-source Chromium path.

Set a Browser Use Cloud API key:

```sh
BROWSER_USE_API_KEY=bu_...
```

Then rerun a probe with the cloud stealth browser and a US residential proxy:

```sh
bun run reservation:probe -- \
  --cloud \
  --proxy-country us \
  --platform opentable \
  --restaurant "L'Artusi" \
  --location "New York, NY" \
  --date 2026-06-05 \
  --time "8:00 PM" \
  --party-size 2
```

Browser Use Cloud claims stealth is enabled by default for every cloud browser:
anti-fingerprint Chromium, cookie/ad banner blocking, Cloudflare/anti-bot
bypass, captcha solving, and residential proxies.

## Guardrails

The probe prompt explicitly forbids:

- logging in,
- entering personal information,
- sending payment or contact details,
- clicking final Reserve/Confirm/Book/Waitlist buttons.

The intended output is availability evidence, not a completed booking.

## Current Findings

- `browser-use==0.12.8` works locally with `ChatLiteLLM`.
- The OpenRouter model string must be `openrouter/deepseek/deepseek-v4-pro`.
- DeepSeek runs with `use_vision=False`; Browser Use also warns and disables vision automatically for DeepSeek.
- A smoke task against `example.com` succeeded with the local OpenRouter key.
- OpenTable homepage automation worked enough to type a query and set a date,
  but submitting search triggered `403 Access Denied` twice. Browser Use also
  warned that the agent appeared blocked by bot/captcha defenses.
- Resy was more navigable: the agent changed location to New York and entered a
  restaurant query. The final result is not reliable yet: the Browser Use judge
  flagged the run as a likely false negative because the agent did not properly
  select/wait for autocomplete results before concluding the restaurant was not
  listed.
- DeepSeek can run Browser Use, but for these booking sites it is slower than we
  want and sometimes repeats unproductive DOM clicks. For product use, compare
  it against `ChatBrowserUse()` or a stronger browser-control model.
- The next necessary experiment is the same OpenTable/Resy probe with
  `--cloud`, because the local browser is not the undetectable browser Browser
  Use markets. Without Browser Use Cloud, we are testing normal Playwright-like
  automation against heavy bot defenses.

## Production Recommendation

Do not put Browser Use inside the current Lambda web container. Use a separate worker:

- AWS ECS Fargate task or AWS Batch job for the easiest Chromium runtime.
- If Browser Use Cloud works on Resy/OpenTable, prefer that over self-hosting
  Chromium initially. It already bundles stealth Chromium, residential proxies,
  captcha handling, recordings, live preview, and an API key boundary.
- SQS queue from the chat app to the worker.
- DynamoDB table item for job status and result payload.
- S3 for screenshots/history traces if we want auditability.
- Strict allowlist for domains: `resy.com`, `opentable.com`.
- Human confirmation required before final booking.
