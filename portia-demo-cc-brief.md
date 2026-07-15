# Portia Demo Build — CC Brief

## Context
Portia is getting a portfolio case study, and we want a live, clickable demo employers can explore — without touching Nina's real data, and without leaving anything behind after the visitor closes the tab.

## Goal
A `/demo` version of the site at `portia.ninahayden.design/demo/`, pre-seeded with realistic mock data, completely disconnected from the real Supabase backend, running on sessionStorage only.

---

## Task 1 — Duplicate the site into `/demo`

Copy the entire current site (every `.html`, `.js`, `.css` file — `data.js`, `recipes.js`, `items.js`, `auth.js`, `styles.css`, all page HTML files, etc.) into a new `/demo` subfolder.

The real site at the root stays completely untouched — don't edit anything outside `/demo`. From this point on, all changes described below apply only to the files inside `/demo`.

## Task 2 — Cut the Supabase connection in the demo's copy

In `/demo/data.js`, find where `supabaseClient` gets created (the line that calls `supabase.createClient(...)`). In the demo copy, force this to always resolve to `null` — regardless of the URL/key it's normally given.

Why: right now the app syncs everything (items, recipes, logs, weight, photos-as-base64) to a single shared Supabase row (`app_data`, id `'main'`). If the demo ever connected to that same row, a visitor would see Nina's real data, and anything they added would get merged back into it. Setting `supabaseClient` to `null` makes `syncFromRemote()` and `pushToRemote()` silently do nothing — the demo just never talks to Supabase at all.

## Task 3 — Switch storage from localStorage to sessionStorage

Still in `/demo/data.js`, find every place that reads or writes using `localStorage`. Replace those calls with the equivalent `sessionStorage` calls (same API — `getItem`, `setItem`, `removeItem` all work identically).

Why: `sessionStorage` behaves exactly like `localStorage` except the browser automatically clears it the moment the tab closes. No cleanup code needed — this alone gives us "nothing persists after the visitor leaves."

## Task 4 — Seed mock data on first load

In `/demo/data.js`, add a check: if sessionStorage is empty (first visit in this tab), populate it with the mock dataset below before the app renders anything. This replaces whatever `seedData()` or empty-state logic currently runs.

Full item + recipe list, with macros, tags, and photo picks: see `portia-demo-mock-library.md` (attached separately). That file has everything — don't re-derive numbers, just transcribe them into the data structures `data.js` already expects for items and recipes.

**Photos:** leave `imageUrl` empty for now — the app already falls back to its placeholder icon for items/recipes without a photo, so this shouldn't block finishing the rest of the build. Nina will check the demo first, then send over the actual image files as a quick follow-up. At that point, copy them into `/demo/assets/` and fill in the matching `imageUrl` fields by filename (e.g. `imageUrl: 'assets/salmon.jpg'`) — match filenames to the item/recipe names in `portia-demo-mock-library.md`, and flag anything ambiguous or missing rather than guessing.

**Progress tab seed data:**
- Weight: 4 dated entries over ~3 weeks, gentle downward trend
- Waist / Hips: 2–3 dated entries each
- Streak: 4-day current streak
- One unlocked milestone: "Protein Pro"
- Water: partially filled for today only, no history

## Task 5 — "DEMO" label next to the logo

Add a small tag immediately to the right of the "portia" wordmark, in every page header inside `/demo` (wherever the logo currently renders).

- Text: `DEMO`, uppercase
- Color: Fog `#8B9BAD` text on Storm `#2A3A4A` background
- Small pill/badge shape, tiny horizontal padding (~6-8px)
- Letter-spacing: 1-2px (per our standing rule — no uppercase text without letter-spacing)
- Position: baseline-aligned with the wordmark, sitting slightly above the baseline (like a trademark symbol), not overlapping or covering any part of the logo
- Font: Inter, same as rest of UI

---

## What NOT to touch
- Nothing outside `/demo` — the real site, real `data.js`, real Supabase table stay exactly as they are
- Don't add authentication/login to the demo — it should be open, no password gate (that's only for the real product)
- Don't wire up any "save permanently" option — everything in the demo is disposable by design

## Testing checklist before calling this done
- [ ] Opening `/demo/` in a fresh/incognito tab shows the seeded mock data immediately, no login
- [ ] Adding/editing a meal or item in the demo works normally within the session
- [ ] Closing the tab and reopening `/demo/` gives a completely fresh seeded state (nothing carried over)
- [ ] No network calls to Supabase happen anywhere in `/demo` (check the browser's Network tab — should see zero requests to the Supabase project URL)
- [ ] The real `portia.ninahayden.design` (outside `/demo`) still works exactly as before, real data intact
- [ ] "DEMO" label shows correctly on every page, doesn't overlap the logo, looks right on mobile widths too
- [ ] Items/recipes without a photo show the normal placeholder icon cleanly (photos are a separate follow-up, not required for this build to be considered done)
