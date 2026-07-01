# Portia — Phase 2: Notes Field on Recipes
## CC Handoff Brief

---

## What it is
A freeform text field on the Create/Edit Recipe modal for tips ("swap for low-fat yogurt"), separate from structured ingredient data so ingredients stay clean for future shopping-list generation.

## Problem it solves
Right now there's nowhere to jot down a quick variation or reminder on a recipe. Ingredients are structured (name/amount/unit/kcal) and need to stay that way — Notes gives a place for anything that doesn't belong in that structure.

## Where it lives
Create Recipe modal (and Edit Recipe, same component), positioned:
**Photo → Name → Ingredients → Recipe Totals → Notes → Tags → Save recipe**

---

## Behavior spec

### Default state
- Collapsed, single-line height (matches other input fields in the modal — same border/background/radius as the Name or Ingredients search field)
- Placeholder text, e.g. "Add a tip..."
- Label above: "Notes"

### Focus state (on click/tap)
- Expands into a multi-line textarea (taller — enough for ~3-4 lines, auto-grow not required, fixed expanded height is fine)
- Focus ring: Cool Turquoise `#2ABFAD`, 1px border or outline, matching focus state used elsewhere in Portia
- No character limit

### Save / Cancel
- Two buttons appear below the textarea while expanded: **Save** and **Cancel**
- **Save**: commits the text as the recipe's saved note, exits edit mode
- **Cancel**: reverts the textarea content to the last saved value (discards unsaved edits)

### Collapse logic
- If the saved note is **empty**: field collapses back to the single-line default state after Save or Cancel
- If the saved note **has content**: field stays in its expanded state (showing the saved text) after Save or Cancel — it does not shrink back down. Clicking into it again re-opens the same Save/Cancel edit behavior

---

## Data model
- New field on the recipe object: `notes` (string, freeform, no length cap)
- Stored separately from `ingredients` (unchanged structure: name/amount/unit/kcal per item) — do not merge these. Ingredients stay structured for future shopping-list parsing; Notes is never parsed programmatically.
- Persists via existing `data.js` localStorage layer, same as other recipe fields.

## Reminder before starting
CTA press states (including Save/Cancel here) must use `transform: scale()` on `:active` — not a padding change.

---

## Tech considerations (plain English)

- **Complexity: Low.** This is a UI state toggle (collapsed vs. expanded) plus one new field saved with the recipe. No new libraries, no external data, nothing that touches the ingredient/shopping-list logic yet.
- **What Claude Code needs to build:**
  1. Add `notes` field to the recipe data structure in `data.js`
  2. Build the collapsed/expanded textarea component with the two states above
  3. Wire Save/Cancel to update/revert the `notes` value
  4. Style: reuse existing input field styling for collapsed state, existing focus-ring pattern (`#2ABFAD`) for expanded state
- **Nothing here requires a developer beyond Claude Code** — it's contained to the existing vanilla JS/HTML/CSS setup, no backend involved.

## Out of scope (this brief)
- Shopping list generation from ingredients — separate, future feature, but this brief protects that path by keeping Notes and Ingredients separate now.
- Any character limit or truncation on Notes.
- Auto-save on blur — explicitly using Save/Cancel instead.
