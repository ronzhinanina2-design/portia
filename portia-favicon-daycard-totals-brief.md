# Portia — Favicon + Day Card Totals Fix

## Item 1: Favicon

Portia currently has no favicon (the little icon shown in browser tabs/bookmarks).

**Task for CC:**
- [ ] Add a favicon to Portia, referenced from the site's HTML `<head>`
- [ ] Needs a square icon asset (commonly 32×32 and/or 512×512 px) — if one doesn't already exist, this likely needs a quick pass from CD, since Portia's wordmark ("portia" in Instrument Serif) won't shrink legibly to favicon size. A simple icon-only mark (possibly using Cool Turquoise `#2ABFAD`) would work better than the full logo.

**Complexity: Very low**, assuming an icon asset exists or CD produces one quickly.

---

## Item 2: Day card totals — bug + enhancement

### The problem
Day cards in the Week view show a kcal total in the header (e.g. "917 / 1,400 kcal") — but only when meals for that day have been checked off/logged. Days that are planned ahead but not yet checked (e.g. planning the upcoming weekend) show **no total at all**. This means Nina can't tell whether a day she's planning is balanced (over/under her calorie or protein target) until after she's already committed to it and checked it off.

### What's changing

1. **Bug fix:** The kcal total should calculate from all planned meals for that day, regardless of checked/unchecked status. Checking items off is about tracking completion, not about whether the day's plan "counts" toward the total.
2. **Enhancement:** Add protein to the same header line, alongside kcal. Format: `917 / 1,400 kcal • 62 / 100g protein` (exact separator/format at CC's discretion to match existing style).

### Scope decisions (confirmed)
- Applies to **every day card** in the Week view, whether past, present, or future/empty.
- Totals are calculated from all planned meals, checked or not.
- Display: number + limit for both metrics, same style as the existing kcal display (e.g. `X / Y kcal`, `X / Yg protein`).
- This is a header-level display only — no changes to the individual meal-slot rows or their existing checkmark/dot icons.

---

## Full task list

### Build (CC)
- [ ] Fix the day card total calculation to include all planned meals, not just checked ones
- [ ] Add protein total to the same header line, using Nina's existing protein target as the denominator
- [ ] Verify this doesn't change behavior on the Today tab or Progress tab, which may have their own separate calculation logic tied to checked/logged meals specifically (flag if these need to stay checked-only, since "today's actual intake" vs "week's planned intake" may be intentionally different concepts)

---

## Confirmed: scope boundary
Today tab and Progress tab should **not** change — they intentionally track checked-off/logged meals only, representing "what I've actually eaten." This fix is specific to the Week view's day card headers, which represent "what I'm planning to eat" and should reflect the full plan regardless of checked status. Do not apply this calculation change anywhere outside the Week grid day cards.
