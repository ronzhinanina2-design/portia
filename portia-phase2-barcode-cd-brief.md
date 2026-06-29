# Portia — Phase 2: Barcode Scanner
## CD Handoff Brief

---

## Overview

A barcode scanning flow for the mobile screen only. The user taps a small icon button in the top-right corner of the mobile home screen, the camera opens fullscreen, scans a product barcode, fetches nutrition data from Open Food Facts, and presents a result screen. The user then chooses to log the item immediately (with a portion step) or save it to their library for future use.

This is a mobile-only feature. No desktop equivalent needed.

---

## Entry point

**Location:** Mobile home screen, top-right corner  
**Button style:** Small square icon button — same component as the "favourite recipe" button in the Recipes tab (dark rounded square background, icon centered). Use the barcode scan icon (corner-bracket style, as per reference image provided).  
**Icon colour:** `#8B9BAD` (Fog) at rest. `#2ABFAD` (Cool Turquoise) on press / active state.  
**Position:** Top-right of the mobile screen header area, consistent with how icon buttons sit in the existing mobile layout.

---

## Screens & states

### 1. Camera / scanning screen

Full-screen camera view. Darkened overlay with a centered transparent scan window (rectangular, wider than tall — standard barcode shape). Corner bracket markers in `#2ABFAD` (Cool Turquoise) outline the scan zone.

- A subtle animated horizontal line sweeps up and down inside the scan window to indicate active scanning (teal, low opacity)
- Label below the scan window: `"Point at a barcode"` — Fog `#8B9BAD`, small caps or caption size
- Close button: top-left, `×` icon, Fog colour — returns to home screen

No manual entry option on this screen. Keep it focused.

---

### 2a. Result screen — single match

Slides up as a bottom sheet (same behaviour as other mobile modals in Portia) after a successful scan.

**Header**
- Small eyebrow label: `"SCANNED ITEM"` — Fog, all caps, caption size
- Product name: large, Cold White `#E8EDF2`, Inter
- Macros row: `120 kcal · 24g protein` — Fog, same pattern as item rows in the library

**Macro fields (pre-filled, editable)**
Four fields in a 2×2 grid:
- Calories (kcal)
- Protein (g)
- Carbs (g)
- Fat (g)

All pre-filled from Open Food Facts. Editable in case the data is wrong. Input focus state: `#2ABFAD` stroke, same as all other inputs in Portia.

Values shown are **per 100g** — consistent with how the library stores all items.

**Tags field**
Empty by default. Same tag chip UI as existing item add/edit form. User can add tags before saving.

**CTAs — stacked, full width**
1. `Log and save to library` — primary amber button (`#E8B800`)
2. `Save to library` — ghost/secondary button (Cold White outline)

---

### 2b. Result screen — multiple matches

Same bottom sheet layout as 2a, but before showing the pre-filled form, show a picker list first.

**Header:** `"Multiple results found"` — Cold White, Inter  
**Subtext:** `"Choose the closest match"` — Fog

List of matches, each row showing:
- Product name — Cold White
- Brand (if available) — Fog, smaller
- Kcal per 100g — Fog, right-aligned

Tapping a row dismisses the list and opens the single-match result screen (2a) pre-filled with that product's data.

If none match: `"None of these"` row at the bottom — Fog text, no icon. Tapping opens a blank add item form (same as manual entry) with just the product name pre-filled if available.

---

### 2c. Not found state

Triggered when the barcode returns no results from Open Food Facts.

Same bottom sheet. Content:

- Icon: image placeholder / broken image icon, Fog colour, centered
- Heading: `"Product not found"` — Cold White
- Body: `"This item isn't in the database yet. You can add it manually."` — Fog
- CTA: `"Add manually"` — primary amber button. Opens the standard Add Item form, blank.
- Secondary: `"Scan again"` — ghost button. Dismisses the sheet and reopens the camera.

---

### 3. Portion step (Log and save to library only)

Triggered after tapping `"Log and save to library"` on the result screen.

Replaces the result sheet content (same modal, scrolls/transitions to next step — do not open a new modal on top).

**Header:** `"How much did you have?"` — Cold White  
**Item name echo:** shown smaller below, Fog

Three portion options as large tappable cards in a row:
- `Whole` — shows calculated total kcal for 100g serving (the default unit)
- `Half` — shows kcal for 50g
- `Custom` — shows a gram input field inline, same as existing portion step in the log meal modal

Selected card: teal border + teal text, no fill (consistent with existing portion card interaction states).

**CTA:** `"Log meal"` — primary amber, full width. Disabled until a portion is selected.

On confirm:
- Item saved to library
- Item logged to today's meal log
- Sheet dismisses
- Success toast appears: `"Logged and saved to library"` — same toast component as existing mobile success states

---

### 4. Save to library only (no portion step)

No additional step needed. On tap:
- Sheet dismisses immediately
- Success toast: `"Saved to library"` — same toast component

---

## Interaction & animation notes

- Bottom sheet entrance: slide up from bottom, same timing/easing as existing mobile modals
- Camera screen entrance: full-screen push transition (not a sheet)
- Scan line animation: slow, looping vertical sweep, `#2ABFAD` at ~30% opacity
- Corner brackets on scan window: static, `#2ABFAD` full opacity
- Sheet transitions between steps (result → portion): content cross-fades or slides left within the same sheet — do not stack modals
- CTA press state: `transform: scale()` on `:active` — never a padding change

---

## Colour reference

| Token | Hex | Usage |
|---|---|---|
| Deep Ink | `#141B24` | Page background |
| Slate Well | `#1C2733` | Card / sheet background |
| Storm | `#2A3A4A` | Input background, picker rows |
| Cool Turquoise | `#2ABFAD` | Focus states, scan brackets, selected state |
| Cold Amber | `#E8B800` | Primary CTA |
| Fog | `#8B9BAD` | Secondary text, labels, inactive icon |
| Cold White | `#E8EDF2` | Primary text |

---

## Out of scope for this brief

- Desktop barcode scanner
- Manual barcode number entry (type it in instead of scanning)
- Editing past logs after barcode entry
- Nutritional data beyond kcal, protein, carbs, fat
