# WINNING Filter — Detailed Scoring Rubric

## Overview

WINNING = Pain x Timing x Execution Capability

Six criteria, each scored 1-10. Claude scores the first two (researchable), user scores the remaining four (domain-specific).

## Pain Intensity (Claude-Scored)

| Score | Meaning | Evidence |
|-------|---------|----------|
| 9-10 | Blocking — users can't accomplish core task | Multiple support tickets, churn mentions |
| 7-8 | Significant friction — workarounds exist but painful | Repeated complaints, negative reviews |
| 5-6 | Moderate — noticeable but livable | Occasional mentions, feature requests |
| 3-4 | Minor inconvenience | Rare complaints |
| 1-2 | Nice-to-have, no real pain | No organic demand |

**Sources**: Support tickets, reviews, social media mentions, user interviews, NPS comments.

## Market Timing (Claude-Scored)

| Score | Meaning | Evidence |
|-------|---------|----------|
| 9-10 | Urgent window — competitors shipping now | Recent competitor launches, trending searches |
| 7-8 | Strong momentum — category is heating up | Rising search trends, VC activity |
| 5-6 | Steady demand — not urgent but relevant | Stable interest, some competitors exploring |
| 3-4 | Early — market not yet ready | Low awareness, few competitors |
| 1-2 | Premature — no market signal | No demand indicators |

**Sources**: Google Trends, competitor changelogs, industry reports, search volume.

## Execution Capability (User-Scored)

| Score | Meaning |
|-------|---------|
| 9-10 | Existing architecture supports it, team has deep expertise |
| 7-8 | Mostly fits, some new patterns needed |
| 5-6 | Moderate effort, need to learn or build new infrastructure |
| 3-4 | Significant technical debt or skill gaps |
| 1-2 | Would require major rewrite or entirely new expertise |

## Strategic Fit (User-Scored)

| Score | Meaning |
|-------|---------|
| 9-10 | Core to positioning, reinforces primary value prop |
| 7-8 | Strong alignment with product vision |
| 5-6 | Tangentially related, could support strategy |
| 3-4 | Weak connection to core positioning |
| 1-2 | Off-strategy, would dilute focus |

## Revenue Potential (User-Scored)

| Score | Meaning |
|-------|---------|
| 9-10 | Direct revenue driver — clear path to conversion or upsell |
| 7-8 | Strong retention impact, reduces churn |
| 5-6 | Moderate impact on engagement metrics |
| 3-4 | Indirect value, hard to measure |
| 1-2 | No measurable revenue connection |

## Competitive Moat (User-Scored)

| Score | Meaning |
|-------|---------|
| 9-10 | Hard to replicate — unique data, network effects, patents |
| 7-8 | Significant effort to copy, first-mover advantage |
| 5-6 | Moderate barrier, could be replicated in 6-12 months |
| 3-4 | Easy to copy, low switching costs |
| 1-2 | Commodity feature, no defensibility |

## Action Thresholds

| Total Score | Action | Meaning |
|-------------|--------|---------|
| 40-60 | **FILE** | High conviction — create GitHub Issue immediately |
| 25-39 | **WAIT** | Monitor — revisit in 2-4 weeks |
| 1-24 | **SKIP** | Not worth pursuing now |

## Scoring Session Format

When running a scoring session, present Claude's scores first, then ask user for each remaining criterion:

```
## [Feature Name]

Claude's assessment:
- Pain Intensity: 8/10 — 12 support tickets this month, 3 churn exits cited this
- Market Timing: 7/10 — Competitor X shipped this in Q3, search trend +40% YoY

Your scores:
- Execution Capability (1-10): ___
- Strategic Fit (1-10): ___
- Revenue Potential (1-10): ___
- Competitive Moat (1-10): ___
```
