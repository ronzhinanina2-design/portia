# Portia Randomize Fix — CC Brief

## Context
Randomize currently mixes recipes and individual items with no real rules, which produces nonsensical results (e.g. dessert getting suggested for dinner). This brief defines the rules that should govern randomize going forward, for both recipes and item-combos.

## The core problem
Randomize isn't filtering by meal slot at all right now. That's the source of the "dessert for dinner" bug — everything is eligible for every slot.

## Tags this depends on
- **Slot tags** (every item/recipe should have at least one): Breakfast, Lunch, Dinner, Snack
- **Category tags** (already in use): High protein, Vegetarian, Grains, Fruit, Dairy, Snack, Meat, Fish, Healthy fats, Garnish

If any existing items/recipes are missing a slot tag, that needs to be backfilled before randomize can work correctly — flag any gaps found rather than guessing a slot.

## Rules

**1. Slot filter — applies first, always, no exceptions**
Only items/recipes tagged with the target slot (Breakfast/Lunch/Dinner/Snack) are eligible for randomize in that slot. This rule never gets relaxed, even in fallback (see Rule 7).

**2. Recipes are picked whole**
A recipe that passes the slot filter can be randomized in as-is — no further combination logic needed, since it's already a designed meal.

**3. Item combos require exactly one anchor**
When building a meal from individual items (not a recipe), the combo must include exactly one item tagged Meat, Fish, High protein, or Dairy. This is the "center" of the meal. No anchor = not a valid combo, full stop.

**4. Optional additions, capped at 3 items total**
Beyond the anchor, a combo can add:
- One item tagged Garnish or Vegetarian (the veg side)
- One item tagged Grains (the carb side)

That's a max of 3 items (anchor + garnish + grain). Healthy fats items (olive oil, nuts, etc.) can be layered in on top and don't count toward this cap — treat them as a condiment, not a component.

**5. Snacks are single-item only**
For the Snack slot, randomize picks exactly one item tagged Snack. No combining, no anchor rule — snacks are standalone by nature.

**6. No-repeat window: 3 days**
Don't reuse the exact same recipe, or the exact same item combo, for the same slot within the last 3 days. Track this per-slot (breakfast history separate from dinner history, etc.).

**7. Fallback order if no valid option is found**
If the rules above produce zero eligible options for a slot, relax in this order:
1. Drop the no-repeat rule (Rule 6) — repeats are allowed if nothing else works
2. Drop the optional additions (Rule 4) — fall back to anchor-only meal
3. Widen to the full slot pool if still nothing

The slot filter (Rule 1) is the one rule that never gets dropped. If truly nothing is tagged for a slot, show an empty state rather than pulling from the wrong slot.

## Testing checklist
- [ ] Randomizing Breakfast never returns anything tagged only Dinner/Lunch (and vice versa)
- [ ] Every item-combo result has exactly one anchor item (Meat/Fish/High protein/Dairy)
- [ ] No item-combo exceeds 3 items (excluding Healthy fats add-ons)
- [ ] Randomizing Snack always returns a single item, never a combo or recipe
- [ ] Randomizing the same slot 4 days in a row doesn't repeat the same recipe/combo in the first 3 of those days
- [ ] If a slot's pool is genuinely too small to satisfy all rules, fallback kicks in in the documented order rather than the feature breaking or silently ignoring the slot filter
