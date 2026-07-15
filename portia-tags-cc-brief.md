# Portia — Tag Management System (CC Handoff Brief)

## Context / problem being fixed

Tags on items and recipes are currently stored as free text per-record — each item/recipe holds its own array of tag strings with no shared source of truth. This causes two problems:

1. **Drift** — the same conceptual tag ends up as slightly different strings across records (e.g. `"Veg"` vs `"Vegetarian"`), so filtering and the tag list on cards disagree with each other.
2. **The filter chip row near the search bar is currently a separate, hardcoded/curated set** that doesn't reflect what's actually on the cards.

This brief replaces free-text tags with a single master tag list that all items/recipes reference, plus a settings modal to manage that list directly.

---

## Data model changes

**New table: `tags`**

| field | type | notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text, unique | the tag label, e.g. "Vegetarian" |
| `created_at` | timestamp | |

**Join tables** (or equivalent relation, depending on how items/recipes are currently structured):

- `item_tags` — `item_id`, `tag_id`
- `recipe_tags` — `recipe_id`, `tag_id`

If items and recipes currently store tags as a text array column (e.g. `tags: string[]`) directly on the item/recipe row, that column should be deprecated in favor of the join table approach above — this is what makes rename/merge/delete cascade correctly instead of requiring a find-and-replace across every record.

**Usage count** is derived, not stored — compute via count of join-table rows per `tag_id` when displaying the settings modal or building the "most used" filter chips. Don't cache/store a count column; it'll drift out of sync.

---

## Migration (one-time, run before UI ships)

1. Scan all existing tag strings across items and recipes.
2. Normalize for comparison: trim whitespace, lowercase, compare.
3. Where two or more existing tag strings are **exact matches after normalization** (e.g. `"veg"` and `"Veg"`), collapse them into a single `tags` row. Preserve whichever original casing is more common across records; if tied, preserve the casing used most recently.
4. Do **not** attempt fuzzy/semantic matching (e.g. don't try to detect that "Meat" and "High protein" might be related) — only exact-normalized-text duplicates are auto-merged. Anything not an exact match becomes its own separate `tags` row, even if it looks similar to a human.
5. Populate `item_tags` / `recipe_tags` from the now-deduplicated set.
6. Log a summary of what was merged (which strings collapsed into which final tag) somewhere Nina can review after the fact — doesn't need to be UI, a console log or a markdown file written during migration is enough.
7. Once migration is confirmed complete and data looks correct, the old free-text tag column (if one exists) can be dropped.

---

## UI changes

### 1. Settings cog (new)

- **Placement**: to the left of the "All" filter chip, on both the Items and Recipes sub-tabs. The chip row shifts right to accommodate it — same row, same vertical alignment as the chips.
- Icon: gear/cog, consistent sizing with other icon buttons already in the app (match the icon-button style used elsewhere, e.g. the sync icon in the top-right nav bar).
- Opens the **Tag Settings modal** on click.

### 2. Tag Settings modal (new)

- Lists every tag in the master `tags` table, each row showing: tag name, usage count (e.g. "used 12x").
- Sort by usage count descending by default (most-used tags at top).
- Each row has three actions: **Rename**, **Merge**, **Delete**.
  - **Rename**: inline edit of the `name` field on that tag. Saves immediately, no separate confirm step needed beyond the edit itself. Cascades automatically since all references point to the same `tag_id` — no additional update logic needed beyond the `UPDATE tags SET name = ... WHERE id = ...`.
  - **Merge**: user selects a second tag to merge into the current one. Prompt for which name survives (default to the one being acted on, but let them pick either). On confirm: repoint all `item_tags`/`recipe_tags` rows from the losing tag's `id` to the surviving tag's `id`, then delete the losing tag row. One-click confirm, no typed confirmation needed.
  - **Delete**: removes the tag row and cascades — delete all matching rows in `item_tags`/`recipe_tags` (standard `ON DELETE CASCADE` on the foreign key, or manual cascade delete if the join tables don't have that constraint set up). One-click confirm, no typed confirmation needed.
- **Add new tag**: simple text input + add button at the top or bottom of the modal, for creating a tag that isn't yet used on anything.

### 3. Item/recipe tag picker (existing — update source)

The tag picker inside the add/edit item/recipe modal (the chip-toggle UI with "+ New tag") should now:
- Pull its list of toggleable tags from the master `tags` table instead of a locally-scoped list.
- "+ New tag" still allows creating a new tag inline, but it now inserts a new row into `tags` (visible immediately in the Settings modal and available for other items/recipes) rather than being scoped to just that one record.

### 4. Filter chip row near search (behavior change)

- Replace the current hardcoded/curated chip set with a **computed** list: top 8 tags by usage count across the current tab's records (items or recipes — counts are scoped per sub-tab, matching current behavior where "only the tags that exist on recipes show" on the Recipes sub-tab).
- "All" chip always present first, unaffected by the top-8 logic.
- This list re-computes whenever tag usage changes (a tag is added/removed from records, or a tag is renamed/merged/deleted in settings) — no manual curation.

---

## Edge cases to handle

- **Renaming a tag to a name that already exists** — should behave as a merge (offer the merge flow, or block the rename and prompt the user to use merge instead — CC's choice, either is fine, just don't allow two tags with identical names to exist).
- **Deleting the last tag on a record** — item/recipe should be left with zero tags, no error. Untagged items/recipes should still display fine on cards (no tag chips shown, or however the empty state currently renders).
- **A tag with 0 usage** — fully valid state (e.g. right after creation, or after all records using it were deleted). Should still show in the settings modal with "used 0x", just won't appear in the top-8 filter row.

---

## Out of scope for this pass

- Tag colors/categories
- Fuzzy-match merge suggestions in the settings modal
- Per-tag icons
