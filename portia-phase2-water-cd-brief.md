# Portia — Phase 2: Water Intake Tracker
## CD Handoff Brief

---

## Overview

A new water intake tracker, surfaced in two places:

1. **Today tab** — a new card sitting alongside the existing Calories card, same row
2. **Progress tab** — a new small metric card in the Goals & Metrics grid, alongside Protein Goal, Calorie Limit, Waist, Hips

Logging is a single tap: each tap on the water icon button adds 250ml. Daily goal is user-set and editable, same pattern as other goals in the app.

This does **not** affect the streak system — streaks remain tied to calorie goal only. Water gets its own lightweight, fun achievement instead (see below).

---

## Today tab placement

**Current layout:** Calories card sits full-width (large ring, "0 / 1,300 kcal", "1,300 kcal left today"). Protein card sits below it, full width.

**New layout:**
- Calories card stays full-width, unchanged, at the top
- Protein and Water become a **two-card row** directly below it, side by side, equal width
- Protein card is scaled down to fit this half-width slot — same internal structure (label, big number + unit, percentage, progress bar) just narrower. Numbers and bar may need to drop to a smaller type size to fit comfortably; use judgement to keep it legible at half-width.

**Water card structure (mirrors Protein card exactly):**

- Eyebrow label, top-left: `WATER` — Fog, caps, caption size
- Top-right: the tap-to-add button (glass/cup icon) lives here, replacing where Protein shows its `%`. The progress bar fill already communicates progress, so no percentage needed on this card.
- Big number: current ml logged, e.g. `750`
- Unit suffix: `ml` (same treatment as Protein's `g`)
- Secondary text: `/ 2000ml` goal, Fog, same as Protein's `/ 100g`
- Progress bar: same style, teal fill, Storm background track

**The tap-to-log button:**

A small icon button, glass/cup icon style (stylized water glass — Lucide has a `GlassWater` icon that would fit the existing icon language). Placed in the **top-right corner** of the Water card, in the spot where Protein shows its percentage — since the progress bar already communicates fill level, no percentage is needed here.

**Tap behavior:**
- Each tap adds 250ml instantly — number ticks up, bar fills, no confirmation modal
- Button press state: `transform: scale()` on `:active`, consistent with all other CTAs in Portia
- A small water-drop or ripple micro-animation on tap would reinforce the action (optional, nice-to-have — flag for CC feasibility, not required for MVP)
- No undo needed for water (low stakes, unlike the meal "Done for today" lock) — but if CD wants a quick correction path, a long-press or small "−" affordance could subtract 250ml. Not required; can be V1 without it.

**Goal editing:**
Tap the card body (not the add button) to open a small edit state — same pattern as other editable goals in Portia (e.g. how Calorie Limit / Protein Goal are edited in Progress tab settings). Single field: daily goal in ml.

**Goal reached state:**
Water should get the same "goal reached" highlight treatment as Calories/Protein cards once daily goal is hit — match whatever success treatment exists for those (Cold Amber tint / success indicator) so all three goal cards feel consistent.

---

## Progress tab placement

**Current layout:** Goals & Metrics section has one large Weight chart card, then a row of four small metric cards below: Protein Goal, Calorie Limit, Waist, Hips.

**New layout:**
- Existing row of four stays exactly as is
- A **second row** of small metric cards starts below it, left-aligned — same card style, same grid sizing as the row above
- Water Goal is the first (and currently only) card in this new row

**Water Goal card (matches existing small card style exactly):**

- Eyebrow label: `WATER` — Fog, caps
- Big number: `2,000` — Cold White, same size as Protein Goal's `100`
- Unit: `ml`
- Below: `Daily target` with teal dot — identical to Protein Goal's "Daily target" pattern

No progress bar needed here (Waist/Hips show a bar because they track toward a target over time; Water Goal is just a daily setting, same as Protein Goal and Calorie Limit which also have no bar).

---

## Achievement badge — new addition

A new badge for the Achievements & Milestones section, in the **logging badges** category (unlocks based on tracking behavior, not tied to calorie streak compliance — consistent with how Portia separates streak badges from logging badges).

**Badge name:** `Hydration Station`
**Trigger:** Hit water goal 7 days in a row
**Icon:** same glass/water-drop icon as the card's log button, for visual consistency

This sits alongside existing badges like Goal Crusher and Protein Pro in the same horizontal badge row — same tile size, same locked/unlocked visual treatment (desaturated + lock icon when locked, full color + unlock date when earned).

---

## Colour & component reference (unchanged — for consistency check only)

| Token | Hex | Usage |
|---|---|---|
| Deep Ink | `#141B24` | Page background |
| Slate Well | `#1C2733` | Card background |
| Storm | `#2A3A4A` | Progress bar track |
| Cool Turquoise | `#2ABFAD` | Progress fill, button press accent |
| Cold Amber | `#E8B800` | Primary CTAs; also used for Water's "goal reached" highlight state |
| Fog | `#8B9BAD` | Labels, secondary text |
| Cold White | `#E8EDF2` | Primary numbers/text |

---

## Out of scope for this brief

- Water intake history (no chart/trend for water — number resets daily, same as calories)
- Integration with calorie streak / star system
- Custom log amounts (e.g. logging exactly 180ml) — fixed 250ml taps only for MVP
- Subtract/undo affordance for water logging — deferred to later
