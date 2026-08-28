# Portia — Optional Ingredients on Items (Shopping List Fix)

## The problem
Shopping list generation (already shipped) only pulls structured ingredients from **recipes**. Meals logged via the flexible/quick add-meal entry are **items** — a name + macros, with no ingredient breakdown. So a quick-logged dish like "Scrambled eggs and tomatoes" or "Chicken breast (oven baked)" shows up on the shopping list as its own single line, as if it were a purchasable product, instead of breaking down into its real ingredients (eggs, tomatoes, chicken breast, etc).

## The fix
Add an **optional ingredients field to items**, using the exact same structured format already used for recipe ingredients (name + amount + unit). When present, the shopping list generator pulls from an item's ingredients the same way it already does for recipes. When absent, that item is simply skipped from the generated list — no placeholder, no wrong data, nothing forcing Nina to fill it in before shopping.

---

## Scope decisions (confirmed)

- **Where this applies:** Optional on every item, not just flexible/quick-logged ones. Nina adds ingredients to whichever items she wants broken down properly; no requirement to backfill old items.
- **Format:** Identical structured format to recipe ingredients (name, amount, unit) — reused as-is, no new data shape needed.
- **Macros:** Completely unaffected. An item's calorie/protein/carb/fat numbers stay exactly as entered (via barcode, manual entry, or the AI label scan). Ingredients are purely metadata for shopping list purposes — there is no attempt to derive or cross-check macros from them.
- **Missing ingredients behavior:** If an item has no ingredients defined, the shopping list generator simply skips it — no error, no visible flag, no partial/placeholder entry. Nina's own workflow: add ingredients to an item before relying on it in a shopping list.
- **UI placement:** Lives in the item's edit screen, as an "Ingredients (optional)" section — mirroring how recipes already present their ingredients section.

---

## Full task list

### Data (CC)
- [ ] Add an optional `ingredients` array field to the item data structure, matching the existing recipe ingredient shape (name, amount, unit)
- [ ] Ensure this field is fully optional at the data layer — items without it continue to work exactly as before everywhere else in the app

### UI (CC)
- [ ] Add an "Ingredients (optional)" section to the item edit screen, visually consistent with the recipe ingredients section
- [ ] Allow adding/editing/removing ingredient rows on an item, same interaction pattern as recipes

### Shopping list logic (CC)
- [ ] Update the shopping list generator to also pull structured ingredients from items (in addition to recipes) when compiling the week's list
- [ ] Items with no ingredients defined are silently skipped — confirm no other part of the shopping list (categories, totals) treats a skipped item as an error or partial entry

---

## Open questions / risks
- None outstanding — this is a straightforward extension of an existing data shape (recipe ingredients) to a second entity (items). Main implementation risk is just making sure the "ingredients" field stays fully decoupled from the macro fields already on items, per the confirmed scope above.
