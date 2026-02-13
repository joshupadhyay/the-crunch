# Night-Out Planner (Demo) — Build Plan (Supabase + Bun + Exa + Mapbox MCP)

## Goal
User selects a starting venue → enters “planning mode” → AI generates **3 full itineraries (Plan A/B/C)** (each 2–4 stops) → user can toggle plans on a Mapbox map + vote → share a permalink + optionally export a static map image.

**Exa = discovery + context.**  
**Mapbox = canonical POIs + lat/lng + visualization.**  
**Supabase = persistence (itinerary JSON + optional place cache + votes + storage).**  
**Bun = API + orchestration.**

---

## High-level flow

### 1) Start Mode (User picks canonical starting point)
1. User types venue / neighborhood query.
2. Backend calls Mapbox Search (via MCP) for autocomplete/POI search.
3. UI shows top candidates (name + address + neighborhood).
4. User selects 1 → app stores canonical `start_place` object (includes Mapbox id + lat/lng).

### 2) Planning Mode (Vibe + Distance)
User selects:
- `vibe`: e.g. `slow_bar_night`, `sober_entertainment`, `date_night`, `divey`, etc.
- `distance_pref`: `5_min_walk`, `15_min_walk`, `30_min_transit`

Backend:
1. Use Exa to discover candidate venues and/or curated lists around the start area, aligned to vibe.
2. Resolve each candidate venue to canonical POI with Mapbox Search (lat/lng + address).
3. Deduplicate venues across candidates.
4. LLM assembles **3 plans** from canonical POIs:
   - Plan A: conservative + close
   - Plan B: best “vibe match”
   - Plan C: more adventurous / farther

### 3) Artifact + Sharing
- Save itinerary + plans to Supabase with `share_slug`
- Render interactive map + plan toggles on client
- Optional: generate static map image per plan on share/export and store in Supabase Storage

---

## Architecture / Components

### Client (Next.js or similar)
Pages:
- `/` Start mode (search + select start place)
- `/plan` Planning mode (pick vibe + distance, generate plans)
- `/i/:share_slug` Read-only shared itinerary + voting

UI blocks:
- PlaceSearch (autocomplete results)
- PlanningControls (vibe + distance)
- PlanCards (A/B/C + “Why” + stops + vote)
- MapView (Mapbox GL JS: markers + fit bounds + plan toggle)

### Backend (Bun API)
Routes:
- `GET /api/place/search?q=...&near=...` → Mapbox POI search/autocomplete
- `POST /api/itinerary/create` → create itinerary from start_place, vibe, distance
- `GET /api/i/:share_slug` → fetch saved itinerary JSON
- `POST /api/i/:share_slug/vote` → increment vote for A/B/C
- `POST /api/i/:share_slug/export` → generate static image(s), upload to storage, persist URLs

### Supabase
Tables:
- `itineraries`
  - `id uuid PK`
  - `share_slug text unique`
  - `start_place jsonb`
  - `inputs jsonb` (vibe, distance_pref)
  - `plans jsonb` (A/B/C)
  - `selected_plan_key text nullable`
  - `vote_counts jsonb` (or separate votes table)
  - `assets jsonb` (static map images)
  - `created_at timestamptz`
- `places_cache` (optional but nice)
  - `mapbox_id text PK`
  - `name text`
  - `address text`
  - `lat double`
  - `lng double`
  - `categories jsonb`
  - `last_verified_at timestamptz`
- (Optional) `votes`
  - `itinerary_id uuid`
  - `plan_key text`
  - `created_at timestamptz`
  - `fingerprint text` (optional)

Storage bucket:
- `itinerary-assets/` for static map images (png)

---

## Data contracts (JSON)

### `StartPlace`
```json
{
  "provider": "mapbox",
  "mapbox_id": "poi.123",
  "name": "Clemente Bar",
  "address": "....",
  "neighborhood": "NoMad",
  "city": "New York",
  "lat": 40.74,
  "lng": -73.99,
  "confidence": 0.92
}
