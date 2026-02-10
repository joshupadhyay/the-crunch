# Gap Analysis — 2025-01-15

*Based on: Acme Corp, WidgetPro, DataFlow profiles*

## Summary

12 gaps identified, 3 high-conviction (40+), 2 existing issues matched

## Gaps

| Gap | WINNING | Status | Match | Action |
|-----|---------|--------|-------|--------|
| OAuth/SSO support | 47/60 | EXISTING | #42 (95%) | — |
| Real-time collaboration | 44/60 | NEW | — | FILE |
| Bulk data import (CSV/Excel) | 42/60 | NEW | — | FILE |
| Advanced filtering & saved views | 41/60 | NEW | — | FILE |
| Mobile responsive redesign | 36/60 | SIMILAR | #38 (62%) | WAIT |
| Webhook integrations | 34/60 | NEW | — | WAIT |
| Dark mode | 31/60 | NEW | — | WAIT |
| Custom branding | 28/60 | NEW | — | WAIT |
| AI-powered search | 25/60 | NEW | — | WAIT |
| Multi-language support | 22/60 | NEW | — | SKIP |
| Desktop app (Electron) | 18/60 | NEW | — | SKIP |
| Blockchain audit trail | 8/60 | EXISTING | #15 (88%) | — |

## Detail

### Real-time Collaboration — 44/60

**Problem**: Users on team plans share documents but can't edit simultaneously. Current workaround is manual "lock" comments.

**Evidence**:
- 8 support tickets in last 30 days
- Competitor WidgetPro launched multiplayer editing in Q4
- "real-time collaboration" search trend +65% YoY

**Score breakdown**:

| Criterion | Score | Notes |
|-----------|-------|-------|
| Pain Intensity | 8/10 | Active support tickets, workaround friction |
| Market Timing | 8/10 | WidgetPro just shipped, category expectation |
| Execution Capability | 7/10 | WebSocket infra exists, need CRDT layer |
| Strategic Fit | 8/10 | Core to team collaboration positioning |
| Revenue Potential | 7/10 | Key driver for team plan upgrades |
| Competitive Moat | 6/10 | Replicable but first-mover in our niche |

**Recommendation**: FILE — High conviction. Competitors shipping, strong pain signals, architecture supports it.

### Bulk Data Import — 42/60

**Problem**: New users can't migrate existing data without manual entry. Onboarding drop-off at 40% when users realize no import exists.

**Evidence**:
- Onboarding funnel data shows 40% drop-off
- 5 support tickets/week asking about CSV import
- All three competitors offer CSV import as tablestakes

**Score breakdown**:

| Criterion | Score | Notes |
|-----------|-------|-------|
| Pain Intensity | 9/10 | Blocking onboarding, measurable churn |
| Market Timing | 7/10 | Tablestakes — we're behind, not ahead |
| Execution Capability | 8/10 | Standard file parsing, clear implementation |
| Strategic Fit | 6/10 | Enabler, not differentiator |
| Revenue Potential | 7/10 | Direct conversion impact |
| Competitive Moat | 5/10 | Easy to replicate, but removes blocker |

**Recommendation**: FILE — High conviction. Onboarding blocker with measurable conversion impact.
