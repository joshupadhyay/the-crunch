# GitHub Labels

Auto-created labels for PM workflow. Create with `gh label create`.

## Category Labels

| Label | Color | Description |
|-------|-------|-------------|
| `pm:feature-request` | `#1d76db` | Feature identified through PM analysis |
| `pm:gap-identified` | `#d876e3` | Gap found during competitive analysis |
| `pm:competitor-intel` | `#f9d0c4` | Competitive intelligence tracking |

## Priority Labels

| Label | Color | Description |
|-------|-------|-------------|
| `priority:now` | `#b60205` | Ship this sprint/cycle |
| `priority:next` | `#e4e669` | Next sprint/cycle |
| `priority:later` | `#c2e0c6` | Backlog, revisit later |

## WINNING Score Labels

| Label | Color | Score Range | Description |
|-------|-------|-------------|-------------|
| `winning:high` | `#0e8a16` | 40-60 | High conviction, file immediately |
| `winning:medium` | `#fbca04` | 25-39 | Monitor, revisit in 2-4 weeks |
| `winning:low` | `#e4e669` | 1-24 | Not worth pursuing now |

## Label Creation Script

```bash
# Run once to set up all labels
gh label create "pm:feature-request" --color "1d76db" --description "Feature identified through PM analysis"
gh label create "pm:gap-identified" --color "d876e3" --description "Gap found during competitive analysis"
gh label create "pm:competitor-intel" --color "f9d0c4" --description "Competitive intelligence tracking"
gh label create "priority:now" --color "b60205" --description "Ship this sprint/cycle"
gh label create "priority:next" --color "e4e669" --description "Next sprint/cycle"
gh label create "priority:later" --color "c2e0c6" --description "Backlog, revisit later"
gh label create "winning:high" --color "0e8a16" --description "WINNING 40-60: high conviction"
gh label create "winning:medium" --color "fbca04" --description "WINNING 25-39: monitor"
gh label create "winning:low" --color "e4e669" --description "WINNING 1-24: skip"
```
