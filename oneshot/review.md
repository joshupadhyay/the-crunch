# Oneshot Review

Reviewer: Claude (monitoring agent)
Last reviewed: 2026-02-10 ~17:08

---

## Review #1 — Initial State (4 files)

### Files Present
- `README.md` — Template boilerplate from `bun init`
- `CLAUDE.md` — Bun conventions (duplicate of parent project CLAUDE.md)
- `PLAN.md` — Core product vision and requirements
- `SKILL-product-management.md` — PM skill definition

### PLAN.md — Feedback

**Strengths:**
- Clear product concept: chat-based restaurant/bar recommender with a warm 70s aesthetic
- Good UI/UX vision — the corkboard sidebar with sticky notes and pins is a memorable interaction pattern
- Color palette is well-defined and cohesive (warm earth tones fit the 70s brief)
- Smart to reference an existing chatbot repo (`claude-chatbot`) for structural consistency

**Concerns & Questions:**

1. **MCP/Tool integration is vague.** The plan says "Search for MCP / access to applications like The Infatuation, OpenTable, Resy, Michelin Guide" — but are there actually MCP servers or APIs available for these? This is the hardest part of the whole app. If no public APIs exist, the agent will need to fall back to web search, which is unreliable for structured restaurant data. This should be scoped early — what's the realistic data source?

2. **No mention of location handling.** Restaurant recommendations are inherently location-dependent. How will the app determine the user's city/neighborhood? Is it NYC-only (PLAN.md mentions "new york city neighborhood" in the sticky notes example) or multi-city? This affects architecture significantly.

3. **Database schema is undefined.** "Use the same database scheme (local db)" — for what exactly? Chat history? User preferences? Cached restaurant data? A schema outline would help.

4. **System prompt / personality not specified.** The plan says "The bot should have a default personality" but doesn't describe it. A brief character sketch would help — is it a casual foodie friend? A sommelier? A retro diner host?

5. **"--dangerously-skip-permissions"** — noted. The plan cuts off mid-sentence here. Not a content issue, just an observation that the file may be truncated.

### SKILL-product-management.md — Feedback

This is a well-structured PM framework document, but it feels like it was dropped in as reference material rather than being specific to "The Crunch." It's a generic PM skill definition.

**Question:** Is this meant to be used *by* the other Claude to do product analysis on The Crunch? Or is it being built *into* the app? If it's reference material for the working agent, it probably belongs outside the `oneshot` directory to avoid confusion with deliverables.

### CLAUDE.md — Feedback

This is an exact copy of the parent project's CLAUDE.md. No issues, but it's redundant — the parent CLAUDE.md already applies. Unless the other agent needs it for its own context, this is unnecessary duplication.

### What I'm Watching For Next

- Actual source code files (`.ts`, `.tsx`, `.html`, `.css`)
- A system prompt definition for the restaurant bot
- Database schema
- API route definitions
- Restaurant data source strategy (MCP tools, web scraping, API integrations)
- Frontend component structure

---

## Review #2 — 5min check (~16:56)

No new files added since initial review. The other Claude may still be working or may be writing to a different location.

**Parallel research kicked off:** Investigating whether Resy/OpenTable/Infatuation/Michelin have MCP servers, and researching Browserbase Stagehand as a browser automation alternative for restaurant data access. Results will be added in the next review cycle.

---

## Review #3 — 10min check (~17:02)

### New File: `PRD.md`

Solid PRD that addresses several of my earlier concerns. Good structure.

**Strengths:**
- Clean architecture breakdown — backend files (`server.ts`, `AnthropicChatBot.ts`, `Database.ts`, `tools.ts`, `system-prompt.ts`) and frontend components (`App.tsx`, `ChatView.tsx`, `CorkBoard.tsx`, `StickyNote.tsx`, `RestaurantPin.tsx`) are well-scoped
- API routes are defined and make sense (`/api/chat/create`, `/api/chat/send`, `/api/chat/conversations`, etc.)
- The `/api/chat/conversations/:id/context` endpoint for extracted preferences + restaurants is a smart design — separates the corkboard data from raw chat history
- Color palette usage is specified with roles (primary accent, secondary, highlights, deep accent, warm mid-tone)
- Design language section adds useful detail: retro serif display font, rounded corners, organic shapes, cork texture, sticky note rotation/shadow

**Concerns:**

1. **"In-memory Map for conversations"** — The PRD says `Database.ts` uses an in-memory Map. This means all data is lost on server restart. For a v1 this is fine, but worth noting. The PLAN.md referenced "local db" which implied SQLite (per Bun conventions). Which is it? If in-memory, there's no persistence at all.

2. **Tool use is still hand-wavy.** The PRD says `tools.ts` has "Restaurant search tool definitions for Claude" but doesn't say what data source those tools query. This is the core question of the whole app. See the research findings below.

3. **No mention of streaming.** For a chat interface with Anthropic API, streaming responses makes a huge UX difference. The PRD should specify whether the chat endpoint streams or waits for complete responses.

4. **Acceptance criteria are minimal.** "Tool use allows bot to 'search' for restaurants" — search where? With what data? The scare quotes around "search" suggest even the author isn't sure. This is the one criterion that needs to be concrete.

---

## Research: Restaurant Data Sources (MCP Servers & Alternatives)

### Resy MCP Server — EXISTS

A Resy MCP server exists: [musemen/resy-mcp-server on LobeHub](https://lobehub.com/mcp/musemen-resy-mcp-server). It supports:
- Scheduling bookings for specific restaurants/dates/times
- Advance reservation booking (14/30 day snipe)
- Waitlist join/check/leave
- Calendar export

There's also a [combined Resy + OpenTable MCP server](https://glama.ai/mcp/servers/@jrklein343-svg/restaurant-mcp) that unifies search across both platforms with real-time availability checking.

**Note:** These are primarily *reservation/booking* tools, not *discovery/recommendation* tools. They assume you already know what restaurant you want. For "help me find a restaurant," you still need a search layer.

### OpenTable MCP Server — EXISTS (multiple)

Several options:
- [Apify OpenTable MCP](https://apify.com/canadesk/opentable/api/mcp) — Full restaurant intelligence: menus, prices, reviews, ratings, real-time availability, photos
- [Bright Data OpenTable MCP](https://brightdata.com/ai/mcp-server/opentable) — Real-time public data with proxy rotation and CAPTCHA solving
- [Apify OpenTable Extended](https://apify.com/canadesk/opentable-extended/api/mcp) — Extended data extraction

**These are more useful for discovery** — they can search by criteria, not just book a known restaurant.

### Michelin Guide — NO dedicated MCP, but scrapers exist

- No official Michelin Guide MCP server found
- [Apify Michelin Scraper](https://apify.com/bmldata/michelin-restaurant-scraper) exists but isn't MCP-native
- [michelin-stars-restaurants-api](https://github.com/NicolaFerracin/michelin-stars-restaurants-api) — scraper + API, could be wrapped
- Michelin uses Algolia search API under the hood, which can be queried directly

### The Infatuation — NOTHING found

No MCP server, no public API, no scraper. This is the hardest source to integrate. Would require Browserbase Stagehand or similar browser automation.

### Browserbase Stagehand — STRONG OPTION as fallback

[Stagehand](https://github.com/browserbase/stagehand) is an AI browser automation framework. Key facts:
- **Has an official MCP server**: [mcp-server-browserbase](https://github.com/browserbase/mcp-server-browserbase) — allows LLMs to control a browser
- **npm package**: `@browserbasehq/stagehand`
- **Also available as MCP**: `@browserbasehq/mcp-stagehand` on npm
- **Key methods**: `act()` (single actions), `agent()` (multi-step tasks), `extract()` (structured data from pages)
- **Local mode available**: [stagehand-mcp-local](https://github.com/weijiafu14/stagehand-mcp-local) — runs without Browserbase cloud
- Supports multiple LLM backends (Claude, OpenAI, Gemini)

**Recommendation for The Crunch:**
1. **Primary**: Use the Apify OpenTable MCP for structured restaurant search/discovery
2. **Secondary**: Use the Resy MCP for reservation-specific features
3. **Fallback**: Use Stagehand MCP for scraping The Infatuation and Michelin Guide when needed
4. **Don't try to build custom scrapers** — these MCP servers handle the hard parts (CAPTCHA, rate limiting, data extraction)

---

## Review #4 — 15min check (~17:08)

### Major drop: 13 new source files + STATUS.md

The other Claude shipped a full working MVP. Impressive velocity.

### STATUS.md — Good self-awareness
The builder acknowledged all my earlier concerns directly in `STATUS.md` under "Addressing Reviewer Concerns." Shows they're reading this review file. Good collaboration loop.

### New File Added: `RESEARCH-restaurant-data-sources.md`
I wrote and dropped a comprehensive research document into the oneshot directory with MCP server findings, links, and a phased integration roadmap. The builder can use this when ready to upgrade from the simulated DB.

### Source Code Review

**`system-prompt.ts` — Well done.**
- Personality is clear: warm 70s food critic concierge with retro flair ("groovy choice", "far out")
- Smart behavioral rules: ask about budget early, note dietary restrictions, suggest restaurant + bar for a night out
- The `<!--context {...} -->` pattern for structured data extraction is clever — keeps context machine-parseable without disrupting the conversational flow
- Minor note: the prompt says "use your search_restaurants tool to find real options" but the data is simulated. Fine for v1.

**`tools.ts` — Solid v1 approach.**
- 16 well-curated NYC restaurants/bars with good variety (fine dining to tacos, Italian to Korean, restaurants and bars)
- Good restaurant picks — L'Artusi, Via Carota, Sushi Nakazawa, Tatiana, Atomix, Double Chicken Please are all legit NYC favorites
- Search function handles: cuisine, neighborhood, price_range, dietary, vibe
- Fallback to top 5 when no filters match is smart
- `occasion` is in the tool schema but never used in the filter function — minor bug

**`server.ts` — Clean and minimal.**
- 4 routes as specified in PRD
- Note: the PRD mentioned `GET /api/chat/conversations/:id/context` but it's not implemented. The context extraction presumably happens client-side by parsing `<!--context-->` blocks from messages.

**`AnthropicChatBot.ts` — Not reviewed yet (will check next cycle).**

**`Database.ts` — One-liner.** `Map<string, MessageParam[]>` export. Simple, works.

**Frontend files** (`App.tsx`, `ChatView.tsx`, `CorkBoard.tsx`, `StickyNote.tsx`, `RestaurantPin.tsx`) — Will review in next cycle.

### Overall Assessment

This is a legitimately functional MVP built in ~15 minutes. The architecture is clean, the file structure matches the PRD, and the system prompt is well-crafted. The main gaps are the known ones: no streaming, no persistence, simulated restaurant data. All addressed in STATUS.md with clear upgrade paths.

---

*Monitoring continues. Next review in ~5 minutes.*
