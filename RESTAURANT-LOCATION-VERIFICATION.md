# Restaurant Location Verification — Research Notes

> Investigation into using web search APIs to double-check restaurant locations, verify they still exist, and maintain a fresh NYC restaurant database.

---

## Current State of The Crunch

The app currently has **16 hard-coded NYC restaurants** in `src/tools.ts` (lines 78–271) with no verification mechanism. Restaurants can close, move, or change details at any time. There's no persistent database — everything is in-memory. The only external data source is an optional OpenTable scraper via Apify.

**Key problem:** If a restaurant in our DB has permanently closed or moved, we'll recommend a place that no longer exists. We need a verification layer.

---

## Option 1: Exa AI (Semantic Web Search)

### What It Is
Exa is an embeddings-based web search API designed for AI applications. It performs semantic (meaning-based) search rather than keyword matching, making it good at finding contextual information about real-world entities like restaurants.

### How It Would Work for Verification
1. Query Exa with restaurant name + neighborhood (e.g., `"L'Artusi West Village NYC"`)
2. Filter results to authoritative domains: `yelp.com`, `google.com/maps`, `tripadvisor.com`, `theinfatuation.com`
3. Extract content from top results to confirm: address, hours, operational status
4. Use an LLM to compare extracted data against our stored data

### TypeScript SDK

```ts
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY);

// Verify a restaurant exists at its claimed location
async function verifyRestaurant(name: string, neighborhood: string) {
  const result = await exa.searchAndContents(
    `${name} restaurant ${neighborhood} NYC`,
    {
      type: "auto",
      numResults: 5,
      includeDomains: ["yelp.com", "google.com", "tripadvisor.com", "theinfatuation.com"],
      contents: { text: { maxCharacters: 1000 }, highlights: true },
    }
  );
  return result;
}
```

### Pricing
| Search Type        | Cost per 1k requests (1-25 results) |
|--------------------|--------------------------------------|
| Fast / Auto / Neural | $5                                 |
| Deep               | $15                                  |
| Content extraction | $1 per 1k pages                      |

- **Free tier:** $10 in credits for new users
- Content extraction (text/highlights/summary): $1 per 1k pages each
- Answer endpoint: $5 per 1k answers
- Research endpoint: $5/1k agent searches + $10/1k webpages read

### Pros
- Semantic search understands context (e.g., "permanently closed" mentions in reviews)
- Can search across multiple review sites at once
- Good for verifying **claims** — built for grounding AI in real-world data
- TypeScript SDK (`exa-js`) is well-maintained
- MCP server available for direct Claude integration
- Can be used as a Claude tool for real-time verification during chat

### Cons
- Not specifically designed for restaurant/location data
- No structured `business_status` field — requires parsing unstructured text
- More expensive than Google Maps for simple existence checks
- Requires LLM post-processing to interpret results
- Can't directly tell you if a restaurant moved (no `movedPlace` equivalent)

### Links
- [Exa API Overview](https://exa.ai/exa-api)
- [Exa Pricing](https://exa.ai/pricing)
- [Search API Docs](https://docs.exa.ai/reference/search)
- [TypeScript SDK (exa-js)](https://github.com/exa-labs/exa-js)
- [TypeScript SDK Spec](https://docs.exa.ai/sdks/typescript-sdk-specification)
- [Exa MCP Server](https://github.com/exa-labs/exa-mcp-server)

---

## Option 2: Google Maps Places API (New)

### What It Is
Google's Places API provides structured, authoritative data about physical locations including restaurants. The "New" version of the API has explicit fields for business status, moved locations, and AI-powered summaries.

### How It Would Work for Verification
1. Use **Text Search (New)** to find a restaurant by name + area
2. Get the `place_id` from the result
3. Use **Place Details (New)** to check `businessStatus`
4. Store `place_id` for future re-verification (refresh every 12 months per Google's recommendation)

### Key Verification Fields

| Scenario | API Response |
|---|---|
| Restaurant is open | `businessStatus: "OPERATIONAL"` |
| Temporarily closed | `businessStatus: "CLOSED_TEMPORARILY"` |
| Permanently closed | `businessStatus: "CLOSED_PERMANENTLY"` |
| Restaurant moved | `businessStatus: "CLOSED_PERMANENTLY"` + `movedPlace` / `movedPlaceId` |
| Place ID expired | `NOT_FOUND` status |

### JavaScript API Example

```ts
// Using Google Maps Places API (New) — HTTP endpoint
async function verifyRestaurantGoogle(name: string, neighborhood: string) {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.businessStatus,places.rating,places.currentOpeningHours,places.websiteUri",
      },
      body: JSON.stringify({
        textQuery: `${name} restaurant ${neighborhood} New York City`,
        locationBias: {
          circle: {
            center: { latitude: 40.7128, longitude: -74.006 }, // NYC center
            radius: 20000, // 20km radius
          },
        },
        maxResultCount: 3,
      }),
    }
  );
  return response.json();
}

// Check if a stored place_id is still valid
async function checkPlaceStatus(placeId: string) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
        "X-Goog-FieldMask": "id,displayName,businessStatus,movedPlaceId",
      },
    }
  );
  return response.json();
}
```

### Pricing (2026)
- **Free tier:** 10,000 requests/month on Essentials tier
- **Text Search:** ~$5–$32 per 1,000 requests (depends on fields requested)
- **Place Details:** ~$2–$25 per 1,000 requests (depends on tier: Essentials/Pro/Enterprise)
- **Subscription plans available** (enrollment window Nov 2025 – March 2026) with locked pricing

### Pros
- **Structured `businessStatus` field** — definitive answer on whether a restaurant is open
- **`movedPlace` / `movedPlaceId`** — automatically tells you if a restaurant relocated
- **Authoritative data** — Google is the de facto source for business operational status
- **AI-powered summaries** — new feature that synthesizes reviews/highlights
- Includes ratings, hours, photos, reviews, address, phone number
- Can store `place_id` for efficient re-checks
- Well-documented, mature API with huge ecosystem

### Cons
- More expensive per-request than Exa for broad searches
- Pricing can escalate quickly with field masks (Pro/Enterprise fields cost more)
- Rate limits require careful management
- `place_id` can become stale — need to refresh every ~12 months
- No semantic understanding of context like Exa has

### Links
- [Places API Overview](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Business Status Blog Post](https://mapsplatform.google.com/resources/blog/temporary-closures-now-available-places-api/)
- [Pricing](https://mapsplatform.google.com/pricing/)
- [Usage & Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

---

## Recommended Approach: Use Both (Layered Strategy)

The best approach is to use **Google Maps as the primary verification source** (structured, authoritative) and **Exa as a supplementary enrichment/discovery layer** (semantic, broader web context).

### Verification Flow

```
┌─────────────────────────────────────────────────────────┐
│                    VERIFICATION PIPELINE                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Google Maps Places API (Primary)                    │
│     ├── Text Search → get place_id                      │
│     ├── Place Details → check businessStatus            │
│     ├── OPERATIONAL → ✅ Restaurant verified             │
│     ├── CLOSED_TEMPORARILY → ⚠️ Flag, keep in DB        │
│     ├── CLOSED_PERMANENTLY → ❌ Remove or archive        │
│     └── movedPlaceId → 🔄 Update to new location        │
│                                                         │
│  2. Exa AI (Supplementary — for enrichment/discovery)   │
│     ├── Semantic search for recent reviews/mentions      │
│     ├── Cross-reference with food blogs, Infatuation     │
│     ├── Discover NEW trending restaurants                │
│     └── Get real-time context (events, menu changes)     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### As a Claude Tool

Add a `verify_restaurant` tool that Claude can call during conversation:

```ts
// Tool definition
{
  name: "verify_restaurant",
  description: "Verify a restaurant's current status (open, closed, moved) using Google Maps and web search. Use before recommending a restaurant to ensure it's still operating.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Restaurant name" },
      neighborhood: { type: "string", description: "Neighborhood" },
      place_id: { type: "string", description: "Google Maps place_id if known" },
    },
    required: ["name"],
  },
}
```

---

## NYC Restaurant Database with Periodic Cache Refresh

### Architecture

Replace the hard-coded `RESTAURANT_DB` array with a SQLite-backed cache that periodically refreshes from external sources.

```
┌──────────────────────────────────────────────────────────┐
│                    DATA ARCHITECTURE                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                   │
│  │  SQLite DB   │────▶│  Restaurant  │                   │
│  │ (bun:sqlite) │     │    Cache     │                   │
│  └──────┬───────┘     └──────────────┘                   │
│         │                                                │
│         │  Periodic refresh (setInterval)                 │
│         │  Default: every 24 hours                        │
│         │                                                │
│  ┌──────▼──────────────────────────────────┐             │
│  │          DATA SOURCES                    │             │
│  │                                          │             │
│  │  1. Google Maps Places API               │             │
│  │     - Text Search for "popular            │             │
│  │       restaurants in [neighborhood]"      │             │
│  │     - Place Details for full info         │             │
│  │     - businessStatus for freshness        │             │
│  │                                          │             │
│  │  2. Exa AI Search                        │             │
│  │     - "best new restaurants NYC 2026"     │             │
│  │     - "trending restaurants [area]"       │             │
│  │     - Food blog / review aggregation      │             │
│  │                                          │             │
│  │  3. NYC Open Data (Free)                 │             │
│  │     - Health inspection grades            │             │
│  │     - Permits and licensing               │             │
│  │     - Via SODA API                        │             │
│  │                                          │             │
│  │  4. OpenTable (existing Apify scraper)   │             │
│  │     - Ratings, reviews, availability      │             │
│  └──────────────────────────────────────────┘             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### SQLite Schema (bun:sqlite)

```ts
import { Database } from "bun:sqlite";

const db = new Database("the-crunch.sqlite", { create: true });

// Enable WAL mode for better concurrent read/write performance
db.run("PRAGMA journal_mode = WAL");

db.run(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cuisine TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    price_range TEXT NOT NULL,
    vibe TEXT,
    rating REAL,
    description TEXT,
    highlights TEXT,          -- JSON array
    dietary TEXT,             -- JSON array
    address TEXT,
    latitude REAL,
    longitude REAL,
    google_place_id TEXT,
    business_status TEXT DEFAULT 'OPERATIONAL',
    phone TEXT,
    website TEXT,
    source TEXT,              -- 'manual', 'google', 'exa', 'opentable'
    last_verified_at TEXT,    -- ISO timestamp
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS verification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER REFERENCES restaurants(id),
    status TEXT NOT NULL,     -- 'OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'MOVED', 'NOT_FOUND'
    source TEXT NOT NULL,     -- 'google', 'exa'
    details TEXT,             -- JSON with raw response data
    checked_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_restaurants_neighborhood ON restaurants(neighborhood);
  CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);
  CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(business_status);
`);
```

### Periodic Cache Refresh Logic

```ts
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days

async function refreshCache() {
  console.log("[Cache] Starting periodic restaurant verification...");

  // 1. Get all restaurants that haven't been verified in > 7 days
  const stale = db.query(`
    SELECT * FROM restaurants
    WHERE last_verified_at IS NULL
       OR datetime(last_verified_at) < datetime('now', '-7 days')
    ORDER BY last_verified_at ASC
    LIMIT 50
  `).all();

  for (const restaurant of stale) {
    // 2. Verify via Google Maps
    if (restaurant.google_place_id) {
      const status = await checkPlaceStatus(restaurant.google_place_id);
      // Update DB based on status...
    }

    // 3. Rate limit: space out API calls
    await Bun.sleep(200);
  }

  // 4. Optionally discover new trending restaurants via Exa
  await discoverNewRestaurants();

  console.log("[Cache] Refresh complete.");
}

// Start periodic refresh
setInterval(refreshCache, REFRESH_INTERVAL);

// Also run on startup (after a short delay)
setTimeout(refreshCache, 5000);
```

### NYC Neighborhoods to Populate

For initial seeding, run Google Maps Text Search for popular restaurants in each major NYC dining neighborhood:

- **Manhattan:** West Village, East Village, Lower East Side, SoHo, NoHo, Nolita, Chinatown, Little Italy, Tribeca, Chelsea, Gramercy, Flatiron, NoMad, Murray Hill, Midtown, Upper West Side, Upper East Side, Harlem, Washington Heights
- **Brooklyn:** Williamsburg, DUMBO, Park Slope, Carroll Gardens, Cobble Hill, Boerum Hill, Bushwick, Bed-Stuy, Greenpoint, Fort Greene, Crown Heights, Prospect Heights
- **Queens:** Astoria, Long Island City, Flushing, Jackson Heights, Woodside
- **Bronx:** Arthur Avenue, Mott Haven

### Discovery via Exa AI

Use Exa's semantic search to find new/trending restaurants that aren't yet in the DB:

```ts
async function discoverNewRestaurants() {
  const queries = [
    "best new restaurant openings NYC 2026",
    "trending restaurants New York City this month",
    "hottest restaurant openings Manhattan Brooklyn",
    "James Beard nominees NYC restaurants 2026",
  ];

  for (const query of queries) {
    const results = await exa.searchAndContents(query, {
      type: "neural",
      numResults: 10,
      startPublishedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // Last 90 days
      includeDomains: [
        "eater.com",
        "theinfatuation.com",
        "nytimes.com",
        "grubstreet.com",
        "timeout.com",
      ],
      contents: { text: { maxCharacters: 2000 }, highlights: true },
    });

    // Parse results, extract restaurant names, cross-reference with Google Maps
    // Insert new restaurants into DB
  }
}
```

---

## Environment Variables Needed

```env
# Google Maps (Primary verification)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Exa AI (Supplementary search & discovery)
EXA_API_KEY=your_exa_api_key

# Existing
ANTHROPIC_API_KEY=your_anthropic_key
APIFY_API_TOKEN=your_apify_token  # Optional, for OpenTable
```

---

## Cost Estimates (Monthly)

### Low Usage (16 restaurants, verified weekly)
| Service | Requests/month | Est. Cost |
|---|---|---|
| Google Maps Place Details | ~64 | Free (within 10k free tier) |
| Exa discovery queries | ~30 | Free (within $10 credit) |
| **Total** | | **$0** |

### Medium Usage (200 restaurants, daily verification + discovery)
| Service | Requests/month | Est. Cost |
|---|---|---|
| Google Maps Text Search | ~200 | ~$5 |
| Google Maps Place Details | ~6,000 | Free (within 10k free tier) |
| Exa search + contents | ~500 | ~$5 |
| **Total** | | **~$10/month** |

### High Usage (1000+ restaurants, real-time verification)
| Service | Requests/month | Est. Cost |
|---|---|---|
| Google Maps Text Search | ~1,000 | ~$25 |
| Google Maps Place Details | ~30,000 | ~$60 |
| Exa search + contents | ~2,000 | ~$15 |
| **Total** | | **~$100/month** |

---

## Additional Data Sources (Free / Low-Cost)

### NYC Open Data (Free)
- **Restaurant inspection results**: Health grades (A/B/C), violations, inspection dates
- **Sidewalk cafe licenses**: Confirms outdoor dining availability
- API: SODA (Socrata Open Data API) — free with app token
- [NYC Open Data Restaurant Dataset](https://data.cityofnewyork.us/Health/restaurant-data-set-2/f6tk-2b7a)
- [Data.gov NYC Restaurant CSVs](https://catalog.data.gov/dataset?res_format=CSV&tags=restaurant&organization=city-of-new-york)

### Foursquare Places API
- Competitive alternative to Google Maps
- Includes tips, ratings, photos, hours
- Free tier available

### Comparison of API Sources
| Feature | Google Maps | Exa AI | NYC Open Data | Foursquare |
|---|---|---|---|---|
| Business status | Yes (structured) | No (inferred) | No | Yes |
| Moved detection | Yes | No | No | No |
| Address/coords | Yes | No (via content) | Yes | Yes |
| Ratings/reviews | Yes | Via content | No | Yes |
| Health grades | No | Via content | Yes | No |
| Trending/new | Limited | Excellent | No | Limited |
| Semantic search | No | Yes | No | No |
| Cost | $$  | $$ | Free | $ |
| Freshness | Real-time | Real-time web | Updated periodically | Real-time |

---

## Implementation Priority

1. **Phase 1 — Google Maps verification tool** (highest impact)
   - Add `google_place_id` to restaurant records
   - Implement `verify_restaurant` Claude tool
   - Check `businessStatus` before recommending

2. **Phase 2 — SQLite persistent cache** (replace in-memory DB)
   - Migrate `RESTAURANT_DB` to `bun:sqlite`
   - Add verification metadata (last_verified_at, business_status)
   - Implement periodic refresh with `setInterval`

3. **Phase 3 — Exa-powered discovery** (expand restaurant coverage)
   - Semantic search for new/trending restaurants
   - Auto-populate DB from food blogs and review sites
   - Cross-reference discoveries with Google Maps for verification

4. **Phase 4 — NYC Open Data enrichment** (free bonus data)
   - Health inspection grades
   - Outdoor dining availability
   - Merge with existing records by name + address

---

## Key Takeaways

- **Google Maps Places API is the gold standard** for verifying whether a restaurant still exists (`businessStatus` field is definitive)
- **Exa AI excels at discovery and enrichment** — finding new restaurants, aggregating reviews, semantic search across food media
- **The two complement each other**: Google for structured verification, Exa for unstructured discovery
- **bun:sqlite with WAL mode** is the right persistence layer — fast, embedded, no external dependencies
- **Periodic cache refresh** (daily verification, weekly discovery) keeps costs minimal while ensuring data freshness
- **Free tier covers small-scale usage** — both Google (10k/month) and Exa ($10 credit) have generous free allowances
