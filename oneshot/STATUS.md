# The Crunch — Build Status

**Builder:** Claude (main agent)
**Updated:** 2026-02-10 ~17:10

## Current State: MVP FUNCTIONAL

The app builds, runs, and works end-to-end. `bun dev` starts the server at localhost:3000.

### What's Built

**Backend:**
- `server.ts` — Bun.serve with 4 API routes
- `AnthropicChatBot.ts` — Anthropic SDK wrapper with full tool-use loop
- `Database.ts` — In-memory Map<string, MessageParam[]>
- `tools.ts` — `search_restaurants` tool with 16 curated NYC restaurants/bars
- `system-prompt.ts` — "The Crunch" 70s concierge personality with context extraction

**Frontend:**
- `App.tsx` — Layout with context state management
- `ChatView.tsx` — Chat UI with suggestion chips, markdown rendering, loading states
- `CorkBoard.tsx` — Cork-textured sidebar
- `StickyNote.tsx` — Rotating colored sticky notes for preferences
- `RestaurantPin.tsx` — Pinned restaurant cards with colored dots

**Styling:**
- Full 70s palette in Tailwind (crunch-walnut, crunch-khaki, crunch-orange, crunch-mahogany, crunch-copper)
- Playfair Display + DM Sans fonts
- Cork board CSS texture
- All custom colors registered in Tailwind 4's `@theme` block

### Verified Working
- Build passes (`bun run build`)
- Server starts and serves HTML
- Conversation create/list/get endpoints work
- Chat endpoint calls Anthropic API with tool use
- Bot searches restaurant DB and responds conversationally
- Context extraction (preferences + restaurants) parses from `<!--context ... -->` blocks

### Addressing Reviewer Concerns

1. **In-memory vs SQLite** — Yes, using in-memory Map. Data lost on restart. Intentional for v1. SQLite upgrade path is clear (swap Map for bun:sqlite).

2. **Tool/data strategy** — Using a simulated DB of 16 hand-curated NYC restaurants/bars for v1. Your MCP research is excellent — the next step would be wiring up Apify OpenTable MCP for real search data. The tool-use loop in AnthropicChatBot.ts is already built to handle multiple tools.

3. **Streaming** — Not yet implemented. The backend does full request/response. Adding streaming would mean switching to `client.messages.stream()` and using Server-Sent Events on the API route. Worth doing.

4. **System prompt** — Fully defined. See `system-prompt.ts`. Personality is a warm 70s food critic concierge. Uses `<!--context {...} -->` HTML comments to extract structured preferences and restaurant data for the corkboard.

### Known Gaps
- No streaming (full response only)
- No persistence (in-memory)
- No real restaurant API integration (simulated DB)
- No error handling for API failures in the UI beyond a generic message
- Corkboard sidebar is desktop-only (no mobile responsive)
