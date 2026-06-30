# Portia — Phase 2: Photos on Items & Recipes
## CD Handoff Brief

---

## Overview

Items and Recipes currently show a placeholder image icon on each card (see reference grid: Greek yoghurt, Granola Bionova chocolate, Strawberries, etc. — all showing the same generic image placeholder). This feature lets the user upload a real photo for any item or recipe, replacing the placeholder.

Goal is mostly aesthetic — making the dashboard feel more personal and "cozy" rather than a strict utility tracker. No nutritional or functional logic changes.

---

## Where this lives

Applies identically to both:
- **Items** grid (Recipes tab → Items sub-tab)
- **Recipes** grid (Recipes tab → Recipes sub-tab)

Same interaction pattern, same visual treatment, on both card types.

---

## Upload interaction

**Trigger:** Tapping the existing placeholder image area on the card itself — no separate button, no icon overlay needed. The whole placeholder zone is the tap target.

This applies in two places:
1. **On the card** in the grid view (Items/Recipes list)
2. **In the add/edit form** for an item or recipe — same placeholder, same tap-to-upload behavior, just inside the form layout instead of the grid card

**Source:** Standard device file picker — user can choose a photo from their camera roll or take a new photo directly, whichever the OS-level picker offers. No custom camera UI needed for this feature (that's specific to barcode scanning elsewhere).

**On tap (no photo set yet):**
- Opens native file/photo picker
- Once a photo is selected, it uploads and replaces the placeholder
- No loading state needed beyond whatever is instant/native — if upload has any perceptible delay, a simple spinner overlay on the placeholder is enough

**On tap (photo already set):**
- Same tap zone — tapping an existing photo reopens the picker to let the user choose a replacement
- A small "Remove photo" option should also be reachable from this same interaction — recommend a long-press or small secondary control (e.g. a small `×` in the corner of the photo, consistent with how other dismissible elements look in Portia) so users aren't forced to pick a new photo just to remove the old one

---

## Image treatment

**Cropping:** Automatic center-crop to fit the existing card shape (object-fit: cover behavior) — no manual crop or reposition step for this phase. If the uploaded photo's aspect ratio doesn't match the card, it's simply cropped from the center automatically.

**Card shape:** Unchanged — same square-ish image area already established in the grid (see reference screenshot). Photo fills this exact same space the placeholder currently occupies.

**Placeholder icon:** Stays exactly as-is for any item/recipe that has no photo. No behavior change there — this feature only adds the option, it doesn't require a photo.

---

## Visual details

- No filter, overlay, or color treatment needed on uploaded photos — show them as-is
- Heart/favourite icon (bottom-right corner of card, per reference screenshot) stays in its current position, overlaid on top of the photo same as it currently overlays the placeholder
- No new badge or indicator needed to show "this item has a custom photo" — the photo itself is the indicator

---

## Out of scope for this brief

- Manual crop/reposition step (flagged for a later phase)
- Multiple photos per item/recipe (one photo per item, one per recipe — no gallery)
- Filters, editing tools, or color adjustments
- Compression/file size limits (assume standard reasonable handling, no specific cap requested)
- Any change to placeholder icon or its styling for items without a photo
