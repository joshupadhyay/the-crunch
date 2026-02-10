---
name: product-management
description: Provides AI-native product management for startups. Use when the user asks to analyze a product, research competitors, find feature gaps, create feature requests, prioritize backlogs, generate PRDs, plan roadmaps, or asks "what should we build next". Uses the WINNING prioritization filter and GitHub Issues integration with deduplication.
---

# Product Management Skill

Transform Claude into an expert PM that processes signals, not feature lists.

```
WINNING = Pain x Timing x Execution Capability
```

Filter aggressively from 50 gaps to 3-5 high-conviction priorities.

## Commands

| Command | Purpose |
|---------|---------|
| `/pm:analyze` | Scan codebase + interview for product inventory |
| `/pm:landscape` | Research competitor landscape |
| `/pm:gaps` | Run gap analysis with WINNING filter |
| `/pm:file` | Batch create GitHub Issues for approved gaps |
| `/pm:prd` | Generate PRD and create GitHub Issue |
| `/pm:sync` | Sync local cache with GitHub Issues |

## Agents

| Agent | Triggers On | Purpose |
|-------|-------------|---------|
| `research-agent` | "research [competitor]", "scout [name]" | Deep autonomous web research |
| `gap-analyst` | "find gaps", "what should we build" | Systematic gap identification with scoring |
| `prd-generator` | "create PRD for [feature]" | Generate PRD + create GitHub Issue |

## Data Storage

All data lives in `.pm/` at project root. See `references/data-structure.md` for complete templates.

```
.pm/
├── config.md                 # Positioning, scoring weights
├── product/                  # Product inventory, architecture
├── competitors/              # Competitor profiles
├── gaps/                     # Gap analyses with scores
├── requests/                 # Synced GitHub Issues (for dedup)
├── prds/                     # Generated PRDs
└── cache/last-updated.json   # Staleness tracking
```

## WINNING Filter

Hybrid scoring — Claude scores researchable criteria, user scores domain-specific:

| Criterion | Scorer | Source |
|-----------|--------|--------|
| Pain Intensity (1-10) | Claude | Sentiment, support data |
| Market Timing (1-10) | Claude | Trends, competitor velocity |
| Execution Capability (1-10) | User | Architecture fit, team skills |
| Strategic Fit (1-10) | User | Positioning alignment |
| Revenue Potential (1-10) | User | Conversion/retention impact |
| Competitive Moat (1-10) | User | Defensibility once built |

**Total X/60** action thresholds:
- **40+** → FILE (high conviction)
- **25-39** → WAIT (monitor)
- **<25** → SKIP (not worth it)

See `references/winning-filter.md` for detailed scoring rubric.

## Workflows

### Product Analysis (`/pm:analyze`)

- [ ] Scan codebase for features (routes, components, APIs, models)
- [ ] Interview user for business context
- [ ] Generate inventory with technical moats and debt flags
- [ ] Save to `.pm/product/`

### Competitive Intelligence (`/pm:landscape`)

- [ ] Research competitors via WebFetch/WebSearch
- [ ] Categorize features: Tablestakes, Differentiators, Emerging, Deprecated
- [ ] Save profiles to `.pm/competitors/`

### Gap Analysis (`/pm:gaps`)

- [ ] Load product inventory + competitor profiles
- [ ] Check staleness (>30 days → prompt refresh)
- [ ] Sync with GitHub Issues for deduplication
- [ ] Identify all gaps, score with WINNING filter
- [ ] Mark as NEW/EXISTING/SIMILAR
- [ ] Save to `.pm/gaps/[date]-analysis.md`

### Feature Filing (`/pm:review` → `/pm:file`)

- [ ] `/pm:review` — Walk through gaps, decide FILE/WAIT/SKIP
- [ ] `/pm:file` — Create GitHub Issues for approved gaps (skips duplicates)
- [ ] Apply labels: `pm:feature-request`, `winning:*`, `priority:*`

### PRD Generation (`/pm:prd [feature]`)

- [ ] Load feature context from gap analysis or GitHub Issue
- [ ] Generate PRD: Problem, User Stories, Acceptance Criteria, etc.
- [ ] Save to `.pm/prds/[slug].md`
- [ ] Create GitHub Issue with PRD content

### Backlog & Roadmap (`/pm:backlog`, `/pm:roadmap`)

- [ ] Fetch open issues with `pm:` labels
- [ ] Sort by WINNING score
- [ ] Organize into Now/Next/Later priorities

## Deduplication & Sync

### On Session Start
1. Check `.pm/cache/last-updated.json` for staleness
2. If >24 hours since last sync, prompt for `/pm:sync`

### `/pm:sync` Process
1. Fetch all GitHub Issues with `pm:*` labels via `gh issue list --json`
2. Update `.pm/requests/[issue-number].md` for each issue
3. Update `last-updated.json` timestamp

### During Gap Analysis
1. Load existing issues from `.pm/requests/`
2. Fuzzy match each new gap against existing:
   - Title similarity (Levenshtein): 40%
   - Keyword overlap: 30%
   - Label match: 20%
   - Description similarity: 10%
3. Mark gaps:
   - **EXISTING** (>80% match) → Show linked issue
   - **SIMILAR** (50-80%) → Warn, ask user
   - **NEW** (<50%) → Proceed normally

Output format:

```markdown
| Gap | WINNING | Status | Match |
|-----|---------|--------|-------|
| OAuth support | 47/60 | EXISTING | #42 (95%) |
| Dark mode | 38/60 | NEW | - |
```

## Staleness Handling

- **Competitor data >30 days** → Prompt refresh before gap analysis
- **Gap analysis >14 days** → Warn when viewing backlog
- **GitHub sync >24 hours** → Suggest `/pm:sync` on session start

## GitHub Integration

### Labels (Auto-Created)

```
pm:feature-request    pm:gap-identified    pm:competitor-intel
priority:now          priority:next        priority:later
winning:high (40+)    winning:medium (25-39)    winning:low (<25)
```

**Prerequisite**: GitHub CLI (`gh`) installed and authenticated. Verify with `gh auth status`.

See `references/github-labels.md` for label definitions and colors.
See `references/issue-template.md` for issue format.

## Integration with spec-kit

This skill handles **WHAT to build and WHY** (product discovery). For **HOW to build it**, use spec-kit:

```
PM Skill → GitHub Issue → spec-kit
/pm:file     Creates issue   /speckit.specify
/pm:prd      Creates issue   /speckit.plan → /speckit.implement
```

The GitHub Issue IS the handoff — no separate command needed.

## Reference Files

- `references/winning-filter.md` — Detailed WINNING scoring rubric
- `references/github-labels.md` — Label definitions and colors
- `references/issue-template.md` — GitHub Issue template
- `references/data-structure.md` — Complete `.pm/` folder structure
- `examples/gap-analysis.md` — Sample gap analysis output
- `examples/competitor-profile.md` — Sample competitor profile
