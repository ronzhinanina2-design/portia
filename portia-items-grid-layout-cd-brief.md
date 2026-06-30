# Portia — Items Grid: Compact Horizontal Cards
## CD Handoff Brief

---

## Overview

The Items sub-tab (Recipes tab → Items) currently uses the same tall, image-forward card style as Recipes — large photo on top, info below. With a growing item library, this is too tall per card and wastes vertical space for what's essentially a quick-reference ingredient list.

**Change:** Restructure Items grid cards into a shorter horizontal layout — photo on the left, info on the right — while keeping the same 4-column grid structure.

**Scope:** This change applies **only** to the Items sub-tab. The Recipes sub-tab keeps its current image-forward vertical card style, unchanged.

---

## Current vs. new card structure

**Current (Items, same as Recipes):**
- Large square-ish photo fills top of card
- Below: name, kcal/protein, tags, heart icon overlaid bottom-right of photo

**New (Items only):**
- Card rotates to horizontal — roughly half the current card height
- **Left side:** photo, rectangular, fills the full height of the card top-to-bottom (not a square thumbnail — stretches to match card height, width proportional)
- **Right side:** all text content, stacked vertically:
  1. Item name — Cold White, same weight/size as current, may need slight size reduction if needed to fit comfortably
  2. Kcal · protein line — Fog, same format as now (`120 kcal · 24g protein`)
  3. Tags row — same truncation logic as currently used (show 1-2 tags + `+N` overflow indicator), just laid out to fit the tighter vertical space
- **Heart/favourite icon:** moves to the right side info area (top-right of the card, near the name) rather than overlaying the photo, since the photo is no longer the dominant visual element. Same icon, same interaction, new position.

Grid stays **4 columns**, same as today — only card height and internal layout change.

---

## Placeholder state (no photo)

Same placeholder icon currently used (image/mountain icon), shown within the left photo slot at its new rectangular proportions — not stretched or distorted, simply centered within the smaller rectangular space.

---

## Spacing & grid

- Column count and grid gutters stay as currently implemented (4 per row)
- Card height roughly halves — exact value to be determined by CD based on how comfortably the 3 lines of text (name, macros, tags) fit next to the photo at the new dimensions
- Maintain consistent card width across the row (unchanged from current grid)

---

## Interaction notes

- Tapping anywhere on the card (photo or text side) opens the item detail/edit view — same as current behavior, no change
- Tapping the photo specifically still triggers the photo upload/replace flow (per the Photos brief) — same tap-to-upload zone, just repositioned to the new rectangular shape
- Heart icon retains its existing tap behavior (toggle favourite), just relocated

---

## Out of scope for this brief

- Any change to the Recipes sub-tab grid or card style
- Changes to filtering, search, or sort behavior on the Items tab
- New tag display logic beyond fitting the existing truncation pattern into less space
