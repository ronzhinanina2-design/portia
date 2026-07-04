# Portia — Milestone Hints + Protein Pro Card (CC Brief)

## What this is
Two additions to the Milestones screen:
1. Add a short hint line to every locked milestone card, explaining how to unlock it.
2. Bring back a previously-cut milestone: **Protein Pro**.

## 1. Hints on locked cards

**Placement:** small subtext directly under the existing "Locked" label, always visible (not tap/hover-revealed).

**Style:** short and literal — state the exact requirement, no flourish.

**Hint copy per card:**

| Card | Hint text |
|---|---|
| 7-day streak | Log meals 7 days in a row |
| 30-day streak | Log meals 30 days in a row |
| 90-day streak | Log meals 90 days in a row |
| Hydration Station | Log water 7 days in a row |
| First week | Use Portia for 7 days |
| First month | Use Portia for 30 days |

**Note/assumption to flag for CC:** "First week"/"First month" look like they're based on *account age* (days since signup), separate from the streak cards which track *consecutive logging*. If that's not how they were originally built, CC should flag it back to Nina rather than guess — the hint copy above assumes account-age logic.

**Styling:** use the existing Fog `#8B9BAD` color for the "Locked" label — hint text should sit visually subordinate to it (same color, smaller size, or reduced opacity — CC's call to match existing card typography scale).

## 2. Protein Pro card (new milestone)

**Unlock condition:** hit 100% of daily protein goal, 7 days in a row (same streak pattern as the existing 7-day/Hydration Station cards).

**Card contents:**
- Locked state: icon (see below) + "Protein Pro" + "Locked" + hint: "Hit protein goal 7 days in a row"
- Unlocked state: same checkmark-circle treatment as "First log", with "Unlocked [date]" subtext

**Icon:** needs to be visually distinct from the existing set (checkmark, star, calendar, water glass). Suggest Lucide's `Beef` or `Drumstick` icon (whichever renders better as an inline SVG at this size) — Nina should eyeball both before committing, this is a design call not a dev one.

**Placement in grid:** append as the next card in the existing 2-column grid, after Hydration Station (i.e. new row, left slot).

**Data/tracking needed:** this requires checking, for each of the last 7 days, whether logged protein for that day met or exceeded the daily protein goal. If Portia doesn't already store a clean daily "protein goal met: yes/no" signal, CC will need to derive it from existing daily nutrition logs.

## Reminder before coding
CTA/press states on any interactive elements here should use `transform: scale()` on `:active`, not padding changes. (Milestone cards themselves are likely static/non-interactive, but flagging in case tap-to-expand is added later.)

## Acceptance criteria
- [ ] All 6 currently-locked cards show a hint line under "Locked"
- [ ] Hint text matches the copy table above
- [ ] New "Protein Pro" card added to the grid, locked state with hint text
- [ ] Protein Pro unlocks after 7 consecutive days of hitting 100% protein goal
- [ ] Protein Pro unlocked state matches "First log" unlocked treatment (checkmark icon, "Unlocked [date]")
- [ ] Icon choice for Protein Pro reviewed by Nina before final implementation
