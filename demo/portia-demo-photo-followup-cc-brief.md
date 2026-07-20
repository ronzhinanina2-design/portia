# Portia Demo — Photo Follow-up

The demo is live and working (mock data, sessionStorage, Supabase disabled, DEMO label all confirmed working). The one thing left: every item's `imageUrl` is currently an empty string, so no photos are showing — confirmed by checking `sessionStorage` directly on the live page.

## What's needed
The image files are already uploaded to `/demo/assets/` in the repo. Go through the items and recipes in the demo's data (`data.js`/`recipes.js`/`items.js`, wherever `imageUrl` fields live) and fill each one in with the matching filename from `assets/`, e.g.:

```
imageUrl: 'assets/salmon.jpg'
```

Match by name against `portia-demo-mock-library.md` (attached) — that file lists which item/recipe each photo belongs to.

## Important
- If a filename in `assets/` doesn't clearly match anything in the mock library, or an item/recipe in the library doesn't have a matching file in `assets/`, don't guess — leave it empty and list it out so Nina can sort out the mismatch.
- Leave everything else about the build untouched — this is only about filling in `imageUrl` values, no other logic changes.
- Once done, confirm on the live demo page that photos are actually rendering (check for `<img>` tags with the right `src`, not just that the field has a value — the two aren't the same thing, which is what caused this round of confusion).
