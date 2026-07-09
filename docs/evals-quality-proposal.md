# The Crunch — Quality Eval Proposal

**Status:** Proposal (not yet implemented)  
**Extends:** `evals/research-evals.ts` + `evals/research-eval-cases.json`  
**Goal:** Measure whether the concierge actually helps users plan nights out — not just whether it calls the right tools.

---

## Why a second eval layer?

The current research evals check **behavioral compliance**: tool choice, constraint capture, over-asking, context block shape. That catches regressions in the *workflow*, but not whether recommendations are **correct, sourced, and useful**.

This proposal adds **outcome evals** in three tiers:

| Tier | What it checks | Automation | When to run |
|------|----------------|------------|-------------|
| **L1 — Structural** | Tool use, tone patterns, multi-stage planning | Fully automated (regex + tool logs) | Every PR / CI |
| **L2 — Extraction** | Restaurants/cuisines match request; names appear in Exa results | Semi-automated (parse tool results + output) | Nightly + pre-release |
| **L3 — Judgment** | Relevance, source quality, collaborative tone | LLM-as-judge (human spot-check sample) | Weekly + after prompt changes |

User feedback (`user-feedback` scores in Langfuse) becomes **L4 — Production signal** and calibrates L3 over time.

---

## Eval dimensions (mapped to your criteria)

### 1. Restaurants identified match user intent

**Question:** Did the bot recommend venues that fit neighborhood, budget, occasion, and dietary constraints?

| Signal | L1 (auto) | L2 (semi) | L3 (judge) |
|--------|-----------|-----------|------------|
| Named restaurants appear in `<!--context-->` JSON | ✓ `contextKeys: ["restaurants"]` | | |
| Every recommended name was in Exa `web_search` results for that turn | | ✓ cross-ref tool_result JSON | |
| No venue contradicts stated constraints (e.g. "$$$" when user said "$$") | ✓ regex on output | | ✓ |
| Neighborhood matches (West Village ≠ Midtown) | | ✓ geocode neighborhood or Exa snippet | ✓ |

**Example L2 check:**

```ts
// Pseudocode: restaurant_provenance
const exaVenueNames = extractVenueNamesFromToolResults(toolResults);
const mentionedVenues = extractFromContextBlock(outputText).restaurants?.map(r => r.name);
const score = mentionedVenues.every(name => fuzzyMatch(name, exaVenueNames)) ? 1 : 0;
```

**Failure modes to catch:**
- Hallucinated restaurant names (not in search results)
- Wrong neighborhood ("great LES spot" when user asked West Village)
- Ignoring hard constraints (vegetarian, price cap)

---

### 2. Restaurants extracted from reputable sources

**Question:** Are recommendations grounded in Exa results from trusted domains, not invented?

| Signal | How to measure |
|--------|----------------|
| `web_search` was called before naming specific venues | L1: `requiredTools: ["web_search"]` (already in evals) |
| Exa results include allowlisted domains | L2: domain allowlist on tool_result URLs |
| Bot does not claim "I went there" or fake reviews | L1: `forbiddenText` patterns |
| Source diversity (not 5 results from one blog spam site) | L2: unique domains ≥ 2 |

**Proposed domain tiers** (configure in eval config):

```json
{
  "reputableDomains": {
    "tier1": ["nytimes.com", "eater.com", "theinfatuation.com", "michelin.com"],
    "tier2": ["resy.com", "opentable.com", "timeout.com", "grubstreet.com"],
    "reject": ["tripadvisor.com/user", "yelp.com/biz"] 
  }
}
```

**Score:** `source_quality = (tier1_hits + 0.5 * tier2_hits) / total_cited_urls`, min 0.6 to pass.

**Note:** Exa returns URLs in tool results today — L2 can parse without new infra. If URLs are missing, add them to the tool wrapper before eval.

---

### 3. Cuisines match what user asked

**Question:** If the user asks for Italian, tacos, or "something light," do recommendations and context reflect that?

| Signal | L1 | L2 | L3 |
|--------|----|----|-----|
| User cuisine keyword appears in assistant reply | ✓ regex | | |
| `preferences` or `restaurants[].cuisine` in context block matches request | ✓ `contextKeys` | | |
| No obvious cuisine mismatch (user: sushi → bot: steakhouse) | | | ✓ judge rubric |

**Example cases** (add to `research-eval-cases.json` or new `quality-eval-cases.json`):

```json
{
  "id": "cuisine-italian-west-village",
  "input": "Italian date night in the West Village, $$, not too loud.",
  "expected": {
    "requiredTools": ["web_search"],
    "requiredText": ["Italian|pasta|trattoria", "West Village"],
    "forbiddenText": ["party size", "what time"],
    "contextKeys": ["restaurants"],
    "quality": {
      "cuisineMustInclude": ["italian"],
      "neighborhoodMustInclude": ["west village"],
      "maxPriceLevel": 2
    }
  }
}
```

---

### 4. Tone & style — collaborative, multi-stage planning

**Question:** Does the bot work *with* the user instead of dumping a list? Does it progress through planning stages?

The system prompt already defines stages: **anchor → vibe/distance → research → plan**. Eval this explicitly.

| Stage | Expected behavior | L1 metric |
|-------|-------------------|-----------|
| Vague first message | Ask 1–2 clarifying questions; do **not** geocode or over-research | `forbiddenTools: ["geocode_venues"]`, question count ≤ 2 |
| Anchor confirmed | Acknowledge anchor; ask vibe + distance | `requiredText: ["vibe|feel|distance|walk"]` |
| Ready to research | Call `web_search`; present 2–3 options, not 10 | `requiredTools: ["web_search"]`, `forbiddenText: ["here are 10"]` |
| Plan offered | Summarize evening arc (drinks → dinner → walk) | `requiredText: ["then|after|next"]` |

**New metric: `planning_stage_compliance`**

Score per turn in multi-turn cases:

```ts
// 1.0 = correct stage behavior, 0.5 = partial, 0 = wrong stage (researched too early or over-asked)
```

**Tone rubric (L3 judge prompt):**

> Rate 1–5: Does the assistant sound like a knowledgeable friend planning a night out (warm, concise, NYC-native), not a generic chatbot or reservation bot? Penalize: corporate tone, listing without context, asking for party size/reservation time before anchor+vibe are set.

---

## Proposed file layout

```
evals/
├── research-eval-cases.json      # existing — workflow/regression (L1)
├── quality-eval-cases.json       # new — outcome cases (L1 + L2 fields)
├── research-evals.ts             # existing runner
├── quality-evals.ts              # new runner (extends scoring)
├── judges/
│   └── recommendation-rubric.md  # L3 LLM-as-judge prompt
└── reports/
    └── quality-eval-*.html
```

**New npm script:** `bun run eval:quality` (parallel to `eval:research`).

---

## Scoring model

Per case:

```
overall = weighted_mean([
  required_tool_use          (0.15)  # existing
  forbidden_tool_avoidance   (0.10)  # existing
  constraint_capture         (0.15)  # existing
  overasking_and_bad_claims  (0.10)  # existing
  restaurant_provenance      (0.20)  # new L2
  source_quality             (0.15)  # new L2
  cuisine_match              (0.10)  # new L1/L2
  planning_stage_compliance  (0.05)  # new L1
])
```

Optional L3 judge adds a separate `human_alignment` score posted to Langfuse — do **not** blend into CI gate until judge is calibrated (≥20 human-labeled traces).

**CI gate (phase 1):** `eval:research` average ≥ 0.8 (unchanged).  
**CI gate (phase 2):** add `eval:quality` L1+L2 average ≥ 0.75.  
**CI gate (phase 3):** L3 sample ≥ 0.7 on 5 held-out cases.

---

## Langfuse integration

| Eval output | Langfuse destination |
|-------------|---------------------|
| Session-level scores | `sessionId: quality-eval-{runId}` (same as research evals) |
| Per-case scores | `name: quality_{metric}`, `value: 0–1` |
| L3 judge | `name: judge_recommendation_quality`, linked to trace |
| Production feedback | `user-feedback` score (already implemented) — compare eval vs live |

**Calibration loop:** Monthly, pull traces where `user-feedback = 0` and run L3 judge retroactively. If judge agrees with user >80%, promote judge to CI gate.

---

## Example quality cases (starter set)

| ID | User input | Primary check |
|----|------------|---------------|
| `quality-hallucination-guard` | "Best new French in SoHo" | Every named restaurant ∈ Exa results |
| `quality-cuisine-tacos` | "Best tacos in Manhattan, casual" | Output mentions tacos/mexican; no fine-dining mismatch |
| `quality-budget-respect` | "Starting at L'Artusi, vegetarian, max $$" | No $$$ venues; vegetarian acknowledged |
| `quality-stage-vague` | "Date night West Village" | Questions only; no geocode; no premature list |
| `quality-stage-full-arc` | Multi-turn: anchor → vibe → research | web_search only after turn 2; plan has sequence |
| `quality-source-tier` | "What's good on the LES right now?" | ≥1 tier1/tier2 domain in Exa results |

---

## Implementation phases

### Phase 1 — Document + L1 cases (1–2 days)
- Add `quality-eval-cases.json` with 6–8 cases (regex + tool checks only)
- Extend `scoreCase()` with `cuisine_match` and `planning_stage_compliance`
- Wire into existing HTML report

### Phase 2 — L2 provenance (2–3 days)
- Parse Exa tool_result JSON in eval runner
- Implement `restaurant_provenance` + `source_quality` scorers
- Add domain allowlist config

### Phase 3 — L3 judge (3–5 days)
- `judges/recommendation-rubric.md` + optional second LLM call in eval runner
- Compare judge vs `user-feedback` Langfuse scores on 20 traces
- Add GitHub Actions nightly workflow (like `research-evals.yml`)

---

## Local commands (once implemented)

```bash
# Existing workflow evals
bun run eval:research

# Proposed quality evals
bun run eval:quality

# Stricter gate before release
EVAL_MIN_AVERAGE=0.75 EVAL_FAIL_ON_ERROR=true bun run eval:quality
```

---

## Open questions

1. **Geocoding as quality signal?** If Mapbox returns a different neighborhood than claimed, flag as mismatch — but adds API cost to eval runs.
2. **Frozen Exa snapshots?** Record tool results in eval fixtures so CI doesn't depend on live search changing daily.
3. **Multi-turn eval cost?** Full arc cases = 2–3 LLM calls each; run nightly not every PR.

---

## Success criteria

We know this eval suite works when:

- A deliberate regression (e.g. skip `web_search`, hallucinate "Carbone") fails `restaurant_provenance`
- Live `user-feedback = 0` traces correlate with low L3 judge scores
- Prompt changes show before/after delta in `evals/reports/quality-eval-*.html` before merge
