# Research: Restaurant Data Sources for The Crunch

**From:** Reviewer Claude (monitoring agent)
**For:** Builder Claude (main agent)
**Date:** 2026-02-10

Your simulated 16-restaurant DB is a great v1 move. When you're ready to wire up real data, here's what exists.

---

## TL;DR Recommendation

| Source | MCP Exists? | Best For | Effort |
|--------|-------------|----------|--------|
| **OpenTable (Apify)** | Yes | Discovery, menus, reviews, availability | Low — plug and play |
| **Resy** | Yes | Reservations, booking, waitlists | Low — but booking-focused, not search |
| **Michelin Guide** | No (scrapers exist) | Fine dining recommendations | Medium — wrap Apify scraper or hit Algolia API |
| **The Infatuation** | No | Editorial recommendations | High — needs Stagehand browser automation |
| **Browserbase Stagehand** | Yes (MCP) | Fallback for any site without an API | Medium — general purpose |

---

## 1. OpenTable MCP Servers (BEST OPTION for discovery)

### Apify OpenTable MCP
- **URL:** https://apify.com/canadesk/opentable/api/mcp
- **What it does:** Full restaurant intelligence — detailed info, menus with prices, reviews & ratings, real-time availability, photos, VIP offers, loyalty programs
- **Why it's good for The Crunch:** This is the closest thing to a "search for restaurants by criteria" API. You can query by location, cuisine, price, and get structured data back. This is what `search_restaurants` should eventually call.

### Apify OpenTable Extended
- **URL:** https://apify.com/canadesk/opentable-extended/api/mcp
- **Extended version** with more data fields

### Bright Data OpenTable MCP
- **URL:** https://brightdata.com/ai/mcp-server/opentable
- **What it does:** Same data but with built-in proxy rotation, CAPTCHA solving, and anti-blocking. More robust for production use.

### How to integrate
Your `AnthropicChatBot.ts` already has a tool-use loop. You'd:
1. Add a new tool definition in `tools.ts` (or modify `search_restaurants`)
2. When the tool is called, forward the query to the Apify/Bright Data MCP
3. Return structured results back to Claude

---

## 2. Resy MCP Server

### musemen/resy-mcp-server
- **URL:** https://lobehub.com/mcp/musemen-resy-mcp-server
- **What it does:**
  - Schedule bookings for specific restaurants/dates/times
  - Advance reservation booking (14/30 day snipe — polls every 500ms before release)
  - Join/check/leave waitlists
  - Export reservations to calendar
- **Auth:** Requires encrypted token storage in `~/.resy-mcp/` (SQLite + encryption key)

### jrklein343-svg/restaurant-mcp (Resy + OpenTable unified)
- **URL:** https://glama.ai/mcp/servers/@jrklein343-svg/restaurant-mcp
- **What it does:** Unified search across both Resy AND OpenTable. Real-time availability. Books using payment methods already saved in user accounts.
- **This might be the single best option** if you want both search and booking in one tool.

### Important caveat
Resy MCP servers are primarily **booking tools**, not **discovery tools**. They assume you already know what restaurant you want. For "help me find a restaurant matching X criteria," you still need the OpenTable search layer or similar.

---

## 3. Michelin Guide

### No dedicated MCP server found.

**Available alternatives:**

#### Apify Michelin Scraper
- **URL:** https://apify.com/bmldata/michelin-restaurant-scraper
- Extracts data from Michelin Guide across 47+ countries
- Gets starred restaurants, Bib Gourmand, and recommended venues
- Not MCP-native, but could be wrapped

#### Michelin's Algolia Search API
- Michelin Guide uses Algolia under the hood for search
- The API configuration can be extracted from their frontend
- You could query it directly for structured restaurant data (name, stars, location, cuisine, price)
- This is how most Michelin scraping tools work

#### michelin-stars-restaurants-api (GitHub)
- **URL:** https://github.com/NicolaFerracin/michelin-stars-restaurants-api
- Scraper + REST API for Michelin data
- Could be self-hosted or used as reference for building your own

---

## 4. The Infatuation

### Nothing exists. No API, no MCP, no scraper.

The Infatuation is the hardest source to integrate. Their content is editorial (reviews, guides, ranked lists) and they don't expose any public API. Options:

1. **Browserbase Stagehand** (see below) — automate a browser to search and extract from their site
2. **Manual curation** — continue your simulated DB approach, hand-picking restaurants inspired by Infatuation picks
3. **Skip it for now** — OpenTable + Resy + Michelin covers the data gap reasonably well

---

## 5. Browserbase Stagehand (General-Purpose Fallback)

### What it is
An AI browser automation framework that lets LLMs control a web browser using natural language.

- **GitHub:** https://github.com/browserbase/stagehand
- **npm:** `@browserbasehq/stagehand`
- **MCP server:** `@browserbasehq/mcp-stagehand` (also on npm)
- **MCP server repo:** https://github.com/browserbase/mcp-server-browserbase
- **Docs:** https://docs.stagehand.dev

### Key methods
- `act()` — execute a single browser action (click, type, navigate)
- `agent()` — multi-step tasks with AI reasoning
- `extract()` — get structured data from a page using a schema

### Why it matters for The Crunch
If you need data from a site that has no API (like The Infatuation), Stagehand can:
1. Navigate to the site
2. Search for restaurants matching criteria
3. Extract structured data (name, rating, review summary, price, location)
4. Return it as JSON for your tool-use loop

### Local mode (no cloud account needed)
- **URL:** https://github.com/weijiafu14/stagehand-mcp-local
- Runs Stagehand locally without a Browserbase cloud account
- Good for development/testing

### Considerations
- Slower than API calls (browser automation takes seconds per page)
- May hit rate limits or anti-bot measures on some sites
- Requires an LLM API key for Stagehand's AI reasoning (can use the same Anthropic key)
- Best used as a fallback, not primary data source

---

## Suggested Integration Roadmap

### Phase 1 (Current — v1)
Keep the simulated 16-restaurant DB. It works, it's fast, no external dependencies.

### Phase 2 — Real search data
Wire up **Apify OpenTable MCP** as the primary search backend. Modify `search_restaurants` in `tools.ts` to forward queries to the MCP instead of filtering the local array.

### Phase 3 — Booking integration
Add the **jrklein343-svg/restaurant-mcp** (unified Resy + OpenTable) for actual reservation functionality. New tool: `book_restaurant` or `check_availability`.

### Phase 4 — Premium data
Add **Michelin Guide** data via Algolia API for fine dining recommendations. Add **Stagehand** for The Infatuation editorial content as a bonus layer.

---

## Links Summary

| Resource | URL |
|----------|-----|
| Apify OpenTable MCP | https://apify.com/canadesk/opentable/api/mcp |
| Apify OpenTable Extended | https://apify.com/canadesk/opentable-extended/api/mcp |
| Bright Data OpenTable MCP | https://brightdata.com/ai/mcp-server/opentable |
| Resy MCP (LobeHub) | https://lobehub.com/mcp/musemen-resy-mcp-server |
| Unified Resy+OpenTable MCP | https://glama.ai/mcp/servers/@jrklein343-svg/restaurant-mcp |
| Apify Michelin Scraper | https://apify.com/bmldata/michelin-restaurant-scraper |
| Michelin API (GitHub) | https://github.com/NicolaFerracin/michelin-stars-restaurants-api |
| Stagehand (GitHub) | https://github.com/browserbase/stagehand |
| Stagehand MCP npm | https://www.npmjs.com/package/@browserbasehq/mcp-stagehand |
| Stagehand MCP Server repo | https://github.com/browserbase/mcp-server-browserbase |
| Stagehand Local MCP | https://github.com/weijiafu14/stagehand-mcp-local |
| Browserbase MCP docs | https://docs.stagehand.dev/v3/integrations/mcp/introduction |
