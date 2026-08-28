# Portia — Shopping List Generation

## What it is
An 8th card in the Week view, sitting after Sunday, that automatically compiles a shopping list from everything planned across that week's meals — grouped by category, with checkboxes to tick off as Nina shops.

## The problem it solves
Right now, turning a week of planned meals into an actual shopping list means manually reading through every recipe and writing it out by hand. This automates that step entirely.

## Target user
Nina, doing her weekly shop based on that week's meal plan in Portia.

## Success looks like
- After planning a week, one look at the 8th card shows everything needed to buy
- Duplicate ingredients across recipes are combined into one line with a summed total
- Nina can tick items off while at the store and the list remembers her progress

---

## Scope decisions (confirmed)

- **Source:** Generated from the full week's planned meals (all days, all meal slots) — not per-recipe.
- **Placement:** Lives as an 8th card in the Week grid, positioned after Sunday. Visually distinct from the day cards using a Cool Turquoise `#2ABFAD` accent (border/background) so it doesn't get confused with a day.
- **Duplicate handling:** If multiple recipes call for the same ingredient, amounts are summed into one line (e.g. two recipes needing 200g and 300g of flour → one line: "Flour — 500g"). This applies when units match; see open question below for what happens when they don't.
- **Pantry exclusion:** None. Every ingredient from every planned recipe is included, even staple pantry items Nina always has on hand. (She can just skip buying what she doesn't need — no smart filtering for v1.)
- **Manual additions:** Nina can add her own extra items to the list (e.g. household goods, snacks) on top of what's auto-generated.
- **Organization:** Items are grouped by category — produce, dairy, meat, etc. — rather than a flat list or grouped by recipe.
- **Checkboxes:** Each item has a checkbox. Checking it off marks it as bought. The list persists across sessions until Nina clears it or regenerates it — it's not a one-time throwaway view.
- **Regeneration behavior:** If Nina changes the week's meal plan after already generating a list, regenerating it **replaces the list entirely** — any checked-off progress is lost. This is a deliberate simplification for v1 (no attempt to merge/preserve state across a plan change).

---

## How it works (plain-language flow)

1. Portia looks at everything planned for the current week (Mon–Sun, all meal slots).
2. It pulls the structured ingredients from each recipe (the same structured ingredient data already used for recipes — separate from the Notes field, which stays free text).
3. It merges duplicate ingredients, summing quantities where units match.
4. It sorts everything into categories (produce, dairy, meat, pantry, etc.).
5. It renders as the 8th card, with checkboxes per item, plus an "add item" option for manual extras.
6. Checked state is saved (likely in localStorage via `data.js`, consistent with Portia's current data layer) so it survives a page reload.
7. If Nina hits "regenerate" (e.g. after changing the week's plan), the list is rebuilt from scratch and any checked state is cleared.

---

## Full task list

### Data/logic (CC)
- [ ] Build the aggregation logic: walk the week's planned meals → collect recipe ingredients → merge duplicates by name + matching unit, summing quantities
- [ ] Assign a category to each ingredient. This likely needs either: (a) a category field added to each ingredient's structured data, or (b) a simple keyword-based categorizer (e.g. "chicken," "beef" → Meat). CC's call on which is more practical given current data shape — flagged as a decision point below.
- [ ] Store the generated list's checked/unchecked state (per item) so it persists across reloads

### UI (CC, possibly CD if the visual treatment needs new patterns)
- [ ] Add the 8th card to the Week grid, styled with Cool Turquoise accent to visually separate it from day cards
- [ ] Render grouped-by-category list with checkboxes
- [ ] Add "add item" input for manual extras
- [ ] Add a "regenerate" action that rebuilds the list from the current week's plan and clears checked state (with a confirmation, since this is destructive to progress)
- [ ] Handle empty state (no meals planned yet for the week — list is empty or hidden)

---

## Open questions / decisions for CC to flag if relevant

- **Mismatched units:** If one recipe needs "2 onions" and another needs "300g onions," these can't be summed automatically. CC should decide a sensible fallback — likely listing them as two separate lines under the same ingredient name rather than forcing a merge Nina would have to double check.
- **Ingredient categorization approach:** Since Portia doesn't currently store a "category" per ingredient, CC needs to decide whether to add that field to ingredient data going forward, or infer it automatically from the ingredient name. The first is more reliable long-term but requires a small data model addition; the second is faster to ship but may occasionally miscategorize.
- **Manual items and categories:** When Nina manually adds an extra item (e.g. "dish soap"), does it need a category too, or does it sit in an "Other" bucket by default?
