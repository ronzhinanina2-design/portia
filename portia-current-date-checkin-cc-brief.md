# Portia — Current + Date Check-in (CC Brief)

## What this is
Add a **date** field to the existing "current value" edit modal on the Waist, Hips, and Weight goal cards. This is groundwork for Phase 3+ progress graphs — we need dated history now, even though the graphs themselves come later.

## Current state (before this change)
Each goal card (Waist, Hips, Weight) shows:
- Current value / goal value
- A progress bar
- A pencil icon that opens an edit modal to update the current value

Right now, updating "current" just overwrites a single number with no date attached — so there's no history, just the latest value.

## What changes

### 1. Data model
Each goal card's current value becomes a **dated entry**, not just a raw number. Store it as an array/list of `{ date, value }` entries per card (Waist, Hips, Weight), even though for now we'll only ever show/use the *latest* one on the card itself.

- `date`: ISO date string (e.g. `"2026-07-04"`)
- `value`: number (cm or kg depending on card)

This is the important part for CC to get right — even though the UI only shows one "current" value today, storing it as a list from day one means the graph feature later doesn't need a data migration.

### 2. Modal changes (reuse existing pencil modal)
Add a date field to the existing edit modal, next to/above the value input.

- **Default:** today's date (in the user's local time, respecting the existing GMT+3 midnight rollover convention already used elsewhere in Portia)
- **Editable:** yes, user can change it to a past date if they forgot to log same-day
- **Field type:** native date input is fine — no need for a custom date picker component

### 3. Save behavior
- On save, check if an entry already exists for that exact date (per card).
  - **If yes:** overwrite that entry's value.
  - **If no:** add a new entry to the list.
- The card's displayed "current" value and progress bar should always reflect the entry with the **most recent date** — not necessarily the last one saved (in case someone backfills an older date after already logging today).

### 4. Scope
Applies to **all three cards**: Waist, Hips, Weight. Same modal component, same logic — just parameterized per card like the existing pencil modal already is.

### 5. Out of scope (for this brief)
- No graph/chart rendering yet — that's Phase 3+.
- No editing/deleting of past individual entries via UI yet (just today's overwrite-by-date logic above).
- No validation UI for "future date" edge case unless it's trivial to add — flag it if it's not.

## Reminder before coding
CTA button press/click state must use `transform: scale()` on `:active` — **not** a padding change. Applies to Save/Cancel buttons in this modal too.

Also existing conventions to keep consistent:
- Focus ring on inputs: Cool Turquoise `#2ABFAD`
- Modal title font: Inter only (Instrument Serif is logo-only)
- Dark mode palette only (Deep Ink `#141B24`, Slate Well `#1C2733`, Storm `#2A3A4A`, Cool Turquoise `#2ABFAD`, Cold Amber `#E8B800`, Fog `#8B9BAD`, Cold White `#E8EDF2`)

## Acceptance criteria
- [ ] Pencil modal on Waist/Hips/Weight cards includes a date field, defaulting to today, editable
- [ ] Saving with an existing date overwrites that day's entry
- [ ] Saving with a new date adds a new entry
- [ ] Card displays the value from the most recent date, regardless of save order
- [ ] Data is stored as a list of dated entries per card (not a single overwritten number)
- [ ] Save/Cancel buttons use `transform: scale()` on `:active`
