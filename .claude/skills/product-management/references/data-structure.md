# `.pm/` Data Structure

## Directory Layout

```
.pm/
├── config.md
├── product/
│   ├── inventory.md
│   └── architecture.md
├── competitors/
│   └── [competitor-slug].md
├── gaps/
│   └── [YYYY-MM-DD]-analysis.md
├── requests/
│   └── [issue-number].md
├── prds/
│   └── [feature-slug].md
└── cache/
    └── last-updated.json
```

## File Templates

### `config.md`

```markdown
# PM Configuration

## Positioning
**One-liner**: [What you do for whom]
**Category**: [Market category]
**Key differentiators**: [What makes you unique]

## Scoring Weights
Default WINNING weights (adjust if needed):
- Pain Intensity: 1x
- Market Timing: 1x
- Execution Capability: 1x
- Strategic Fit: 1x
- Revenue Potential: 1x
- Competitive Moat: 1x

## Target Personas
1. **[Persona name]**: [Description, goals, pain points]
2. **[Persona name]**: [Description, goals, pain points]
```

### `product/inventory.md`

```markdown
# Product Inventory
*Last updated: [date]*

## Features
| Feature | Category | Technical Moat | Debt Flag |
|---------|----------|----------------|-----------|
| [Name] | [Core/Secondary/Experimental] | [Yes/No] | [Yes/No] |

## Architecture Overview
[High-level description of stack, key patterns]

## API Surface
| Endpoint | Method | Purpose |
|----------|--------|---------|
| [path] | [GET/POST/etc] | [description] |
```

### `competitors/[slug].md`

```markdown
# [Competitor Name]
*Last researched: [date]*

## Overview
[1-2 sentences]

## Features
| Feature | Category | Our Status |
|---------|----------|------------|
| [Name] | Tablestakes/Differentiator/Emerging/Deprecated | Have/Gap/Partial |

## Pricing
[Pricing model summary]

## Strengths
- [Strength 1]

## Weaknesses
- [Weakness 1]

## Recent Moves
- [date]: [What they shipped or announced]
```

### `gaps/[date]-analysis.md`

```markdown
# Gap Analysis — [date]
*Based on: [competitor profiles used]*

## Summary
[X] gaps identified, [Y] high-conviction (40+), [Z] existing issues

## Gaps
| Gap | WINNING | Status | Match | Action |
|-----|---------|--------|-------|--------|
| [Name] | [X/60] | NEW/EXISTING/SIMILAR | [#issue (%)/-] | FILE/WAIT/SKIP |

## Detail
### [Gap Name] — [X/60]
**Problem**: [description]
**Evidence**: [signals]
**Score breakdown**: [table]
**Recommendation**: [FILE/WAIT/SKIP with rationale]
```

### `requests/[issue-number].md`

```markdown
# Issue #[number]: [title]
*Synced: [timestamp]*

**Labels**: [list]
**State**: [open/closed]
**WINNING**: [score if labeled]

## Body
[Issue body content]
```

### `cache/last-updated.json`

```json
{
  "github_sync": "2025-01-15T10:30:00Z",
  "competitor_refresh": {
    "competitor-a": "2025-01-10T08:00:00Z",
    "competitor-b": "2025-01-12T14:00:00Z"
  },
  "last_gap_analysis": "2025-01-15T10:00:00Z"
}
```
