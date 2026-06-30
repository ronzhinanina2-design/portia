# Portia — Today Tab: "Add Meal" Logic Change
## Handoff Brief

---

## Overview

Currently, "Add meal" at the bottom of the Meals section opens the same modal as tapping an empty slot card (Lunch/Snack/Dinner) — it just fills whichever slot is still empty. This is redundant: every empty slot already has its own dedicated "Log X" entry point above it.

**New behavior:** "Add meal" becomes a way to log an *additional* meal beyond the four standard slots — e.g. a second breakfast, an extra snack, a late-night dinner addition. It opens the same logging modal, but with meal-type tabs added at the top so the user picks which category the extra meal belongs to.

This does not replace or change the four existing slot cards (Breakfast/Lunch/Snack/Dinner) — those keep working exactly as they do now. This only changes what "Add meal" does.

---

## Modal changes

**Tabs added to top of modal:** `Breakfast / Lunch / Snack / Dinner`

- Same tab component style used elsewhere in Portia (e.g. Items/Recipes tabs in the Recipes screen)
- No tab is pre-selected by default — user must actively choose one before proceeding (confirmed: no smart-default based on time of day)
- Below the tabs, the modal is otherwise identical to the existing log-meal flow (search/select items, portions, etc.)

---

## Naming logic for extra entries

This is the core logic change and needs to be precise:

- If the selected tab already has **one** logged entry (e.g. one Breakfast already logged), this new one is saved and displayed as **`2nd Breakfast`**
- If a **third** entry is added to the same category, it becomes **`3rd Breakfast`**, and so on
- This naming pattern applies independently per meal type — having a "2nd Snack" does not affect Breakfast's numbering, and vice versa
- The original/first entry in each category keeps its plain label (`BREAKFAST`, `LUNCH`, `SNACK`, `DINNER`) — only the second and later entries get the ordinal prefix (`2nd`, `3rd`, `4th`...)

**Example sequence:**
1. User logs Breakfast normally → shown as `BREAKFAST`
2. User taps "Add meal," picks Snack tab, logs something → shown as `SNACK` (this is the first snack, no number needed)
3. User taps "Add meal" again, picks Snack tab again → shown as `2ND SNACK`
4. User taps "Add meal" again, picks Breakfast tab → shown as `2ND BREAKFAST`

---

## Display in the Meals list

Each extra entry gets its own full row in the Meals list, stacked below the related slot — same row component as the existing Breakfast row shown in the reference screenshot (checkmark, label, food description, kcal/protein on the right).

So the list order becomes (using the example above):
1. BREAKFAST
2. 2ND BREAKFAST
3. LUNCH (still showing "Log lunch" if untouched)
4. SNACK
5. 2ND SNACK
6. DINNER (still showing "Log dinner" if untouched)

Extra entries always appear directly below their base category, keeping same-type meals grouped together rather than sorted strictly by time logged.

---

## Calorie & logging counts

Confirmed: extra meals count exactly like any other logged meal.

- They add to the day's total kcal/macros the same way
- They count toward the "X logged" counter at the top of the Meals section (e.g. logging 2nd Snack would move the counter from "1 logged" to "2 logged")
- No special accounting, no separate bucket — it's just food, logged

---

## "Add meal" CTA behavior

The "+ Add meal" link/button at the bottom stays in the same place and same style. It always opens this tabbed modal — it no longer auto-picks an empty slot for the user.

---

## Out of scope for this brief

- Editing or deleting individual extra entries (assume same edit/delete interaction as any other logged meal row — no new pattern needed)
- Changing how the four base slot cards work
- Any cap on how many extra entries per category (no limit specified — assume unlimited for now)
- Smart tab pre-selection based on time of day
