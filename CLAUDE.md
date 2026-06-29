# Portia — project rules for Claude Code

Portia is a personal meal-planning and calorie/protein tracking web app built for a single user. Dark-mode only. No light mode ever.

The design source of truth is the set of `.dc.html` prototype files in this project (Today, Week, Recipes, Progress). Match them exactly — pixel-perfect layout, exact colours, exact transitions, exact interaction states. When in doubt, the prototype wins.

---

## "Done for today" behaviour

### Button states

The "Done for today" button has three states:

| State | Label | When |
|---|---|---|
| Default | "Done for today" | Any time before the day is closed |
| Under/at limit | "Well done!" | Immediately after press, if consumed kcal ≤ goal |
| Over limit | "Keep going" | Immediately after press, if consumed kcal > goal |

The label change is permanent for the rest of that calendar day. On next app open (new date), the button resets to "Done for today".

### Press animations

**Under/at limit — stars burst:**
- Button does its normal scale(0.985) press
- As it springs back, 5–7 amber star elements (★) are spawned absolutely positioned over the button via JS
- Each flies outward in a different direction, fading out as they travel
- Duration ~600ms. Stars are removed from the DOM after animation completes
- Stars are amber `#E8B800`, same as the streak star

**Over limit — ripple pulse:**
- Button does its normal scale(0.985) press
- A single soft amber glow ripple radiates outward from the button (one cycle, fades out)
- Warm and encouraging, not celebratory
- Duration ~500ms

### Day lock

When "Done for today" is pressed:
- All four meal slots become read-only immediately — no hover actions, no edit/trash icons, no clickable empty slots
- The lock state is saved to the data layer (`logs` entry for that date gets a `locked: true` flag)
- Visually, locked slots look the same as logged slots but are not interactive

### Undo window

- Immediately after press, a small "Changed your mind?" text link appears just below the button
- Style: fog colour `#8B9BAD`, font-size 13px, no underline, cursor pointer
- It fades out and is removed after **10 seconds** — this is a hard timeout, no extension
- If clicked within 10 seconds: lock is reversed, button returns to "Done for today", animation does not replay
- After 10 seconds: lock is permanent until tomorrow. The undo link is gone and cannot be brought back

### Next day behaviour

- On app open, check if the current date differs from the last logged date
- If yes: reset to a fresh Today view — all slots empty, button reset to "Done for today", calorie ring at 0
- Yesterday's locked log is preserved in history and visible in Week and Progress tabs

---



Portia is password-gated. It is a single-user private app — not public.

- `login.html` is the entry point when no valid session exists
- On correct password, store a flag in `localStorage` (e.g. `portia_auth: true`)
- Every page (`today.html`, `week.html`, `recipes.html`, `progress.html`) checks for this flag on load. If missing → redirect to `login.html` immediately
- `login.html` is styled to match Portia exactly — same dark background, same fonts, same colours. Not a generic browser prompt
- The password is hardcoded in `login.html` for now. When a real backend is added later, this gets replaced with proper auth
- `index.html` redirects to `login.html` (not `today.html`) so the gate is always the first thing a visitor hits

---

## Hosting & tech stack

- Deployed to `portia.ninahayden.design` via GitHub Pages
- Plain HTML + CSS + vanilla JavaScript — no frameworks, no build step
- Data is local for now (in-memory or localStorage). Architecture should make it easy to swap in a real backend (Supabase or Firebase) later without rewriting the UI layer. Keep all data access in one dedicated module (`data.js`) — do not scatter read/write calls across pages
- Fonts loaded from Google Fonts — keep the same `<link>` tags as in the prototypes
- Icons are inline SVG — copy them exactly from the prototype files, do not substitute icon libraries
- `Instrument Serif` is used for the logo wordmark only. Everything else is `Inter`

---

## Design system

### Colour palette

| Name | Hex | Usage |
|---|---|---|
| Deep Ink | `#141B24` | Page background |
| Slate Well | `#1C2733` | Card background, modal background |
| Dark Panel | `#1A242F` | Modal sidebar background (log meal) |
| Storm | `#2A3A4A` | Borders, input fills, active nav bg |
| Storm Light | `#233040` | Row hover background |
| Storm Mid | `#34465A` | Secondary borders |
| Storm Dark | `#3D5166` | Input hover border |
| Cool Turquoise | `#2ABFAD` | Primary accent — rings, bars, selected states, active borders |
| Turquoise Dim | `rgba(42,191,173,0.14)` | Teal tinted icon backgrounds |
| Cold Amber | `#E8B800` | CTAs, streak, star badges |
| Amber Hover | `#C9A000` | CTA hover state |
| Amber Disabled | `rgba(232,184,0,0.35)` | CTA disabled background |
| Fog | `#8B9BAD` | Secondary text, inactive icons, inactive nav |
| Fog Dark | `#6B7E91` | Input placeholders |
| Cold White | `#E8EDF2` | Primary text |
| Salmon | `#E07070` | Destructive actions (Delete button hover, Delete item/recipe text) |
| Salmon Fill | `rgba(224,112,112,0.15)` | Delete button hover background tint |

Never introduce colours outside this palette.

### Typography

- **Logo only:** `Instrument Serif`, 30px, weight normal, `line-height: 1`
- **Everything else:** `Inter`, weights 400 / 500 / 600
- Section labels (e.g. "CALORIES", "WEIGHT", "CURRENTLY LOGGED"): 11–12px, `font-weight: 600`, `letter-spacing: 0.06–0.08em`, `text-transform: uppercase`, colour `#8B9BAD`
- Page titles / modal titles: 26px / 20px, `font-weight: 500`
- Large numbers (ring, protein, weight): 46–66px, `font-weight: 600`, `letter-spacing: -0.03em`
- Body / row text: 14–16px, `font-weight: 500`
- Small labels, tags: 11–13px, `font-weight: 500–600`

### Scrollbar

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #2A3A4A; border-radius: 4px; }
```

Apply globally.

---

## Layout

- Page padding: `36px 40px`
- Max content width: `1340px`, centred with `display: flex; justify-content: center`
- Today grid: `grid-template-columns: 478px 1fr; gap: 22px`
- Week grid: 4 columns top row, 3 columns bottom row — use CSS grid with 4 equal columns; the last 3 cards on the second row span naturally and stretch to fill
- Recipes grid: `repeat(4, minmax(0, 1fr)); gap: 16px`
- Progress: two-column flex — left `flex: 2` (Goals & metrics), right `flex: 1` (Achievements)

---

## Global navigation

Same nav bar on every page.

```
[portia logo]  [Today] [Week] [Recipes] [Progress]        [★ 7 day streak]
```

- Logo: `Instrument Serif`, 30px, `padding-right: 6px`
- Nav pill container: `background: #1C2733; border: 1px solid #2A3A4A; border-radius: 14px; padding: 5px`
- Each tab: `display: flex; align-items: center; gap: 9px; padding: 9px 16px; border-radius: 10px; font-size: 14px; font-weight: 500`
- Inactive: `color: #8B9BAD`
- Inactive hover: `background: rgba(42,58,74,0.4)`
- Active: `background: #2A3A4A; color: #E8EDF2`
- Streak badge: `background: #1C2733; border: 1px solid #2A3A4A; border-radius: 12px; padding: 8px 14px`
- Star icon: filled `#E8B800`, no stroke — always filled, never outlined
- Streak number: `font-size: 15px; font-weight: 600; color: #E8B800`
- "day streak" label: `font-size: 13px; color: #8B9BAD`

---

## Button system

All buttons follow these rules consistently across every tab and modal.

### Primary CTA (amber)

Used for: Log meal, Save changes, Save item, Save recipe, Continue, Set weight goal, Save (in modals).

```css
background: #E8B800; color: #141B24; font-size: 15px; font-weight: 600;
padding: 14–15px; border-radius: 12–13px; border: none; width: 100%;
transition: background 150ms ease, transform 80ms ease;
```
- Hover: `background: #C9A000`
- Active: `background: #C9A000; transform: scale(0.985)` — **always scale, never padding change**
- Disabled: `background: rgba(232,184,0,0.35); color: rgba(20,27,36,0.35); cursor: not-allowed`

### Cancel button (ghost)

See Component patterns section. Always side by side with the primary action, never stacked full width.

### Detail modal footer — Edit button

Used in item/recipe detail modal. Takes `flex: 1`.

```css
background: transparent; border: 1.5px solid #2ABFAD; color: #E8EDF2;
padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 500;
display: flex; align-items: center; justify-content: center; gap: 8px;
```
- Hover: border stays teal, slight background tint `rgba(42,191,173,0.07)`

### Detail modal footer — Delete button

Fixed width, sits beside Edit button.

```css
background: transparent; border: none; color: #8B9BAD;
padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 500;
display: flex; align-items: center; gap: 8px;
```
- Hover: `background: rgba(224,112,112,0.15); color: #E07070`

### Destructive secondary button — "Delete item" / "Delete recipe"

Used inside edit forms, below the primary CTA. Full width.

```css
background: transparent; border: 1.5px solid rgba(224,112,112,0.4);
color: #E07070; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 500;
width: 100%;
```
- Hover: `border-color: #E07070; background: rgba(224,112,112,0.08)`

### Confirm delete modal buttons

Always side by side (never stacked). Cancel left, Delete right.

- Cancel: ghost style (see above)
- Delete: `background: #E07070; color: #141B24; font-weight: 700; border: none; padding: 14px 24px; border-radius: 12px`
- Hover on Delete: `background: #C85A5A`

---

## Interaction & animation rules

### Transitions — timing

| Element | Property | Duration | Easing |
|---|---|---|---|
| All colour/opacity changes | background, color, border-color, opacity | `150ms` | `ease` |
| Icon micro-interactions | transform (scale) | `80ms` | `ease` |
| CTA press | transform (scale) | `80ms` | `ease` |
| Calorie ring | stroke-dashoffset | `1.2s` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Recipes card hover | transform (translateY) | `120ms` | `ease` |
| Recipes detail modal | opacity + scale + translateY | keyframe `rcModalIn` | — |
| Progress metric card flip | rotateY | `760ms` | `cubic-bezier(0.45, 0.05, 0.2, 1)` |
| Progress badge pop | scale + opacity | keyframe `popIn` | — |
| Progress new badge pulse | box-shadow | keyframe `newpulse` | — |
| Logged item removal (modal sidebar) | max-height + opacity + padding | `150ms` | `ease` |

### CTA press state

**Always `transform: scale(0.985)` on `:active`. Never use padding changes.**

### Meal card hover — Today (logged slots)

Stats (kcal number + "kcal · Xg protein") fade out, edit + trash icons fade in.

```css
.meal-actions { opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
.meal-card:hover .meal-actions { opacity: 1; pointer-events: auto; }
.meal-card:hover .meal-stats { opacity: 0; pointer-events: none; }
.meal-stats { transition: opacity 0.15s ease; }
```

### Week slot row hover

Same fade-in pattern for edit + trash icons on planned/logged slot rows.

```css
.wk-meal .wk-actions { opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
.wk-meal:hover .wk-actions { opacity: 1; pointer-events: auto; }
```

### Progress small cards — hover pencil

```css
.small-card .card-pencil { opacity: 0; transition: opacity 0.15s ease; }
.small-card:hover .card-pencil { opacity: 1; }
```

### Progress metric card — goal reached flip

Card flips 180° horizontally (`rotateY`) when goal is reached. Uses `transform-style: preserve-3d` and `perspective(1500px)`. Front = metric. Back = success state with star + "Goal reached!" + "Set new goal" CTA. Duration `760ms cubic-bezier(0.45, 0.05, 0.2, 1)`.

### Recipes detail modal entrance

```css
@keyframes rcModalIn {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
```

### Progress badge — new unlock

```css
@keyframes popIn {
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes newpulse {
  0%, 100% { box-shadow: 0 0 0 0   rgba(232,184,0,0.0);  }
  50%       { box-shadow: 0 0 0 3px rgba(232,184,0,0.18); }
}
```

Newly unlocked badge: plays `popIn` on mount, then loops `newpulse`. Has a "NEW" amber pill badge top-left of card.

---

## Input fields

All inputs share this pattern:

```css
background: #2A3A4A; border: 1.5px solid #2A3A4A; border-radius: 12px;
padding: 12–13px 14–16px; font-size: 14–15px; color: #E8EDF2; outline: none;
transition: border-color 150ms ease;
```
- Hover: `border-color: #3D5166`
- **Focus: `border-color: #2ABFAD`** — always teal on focus, no exceptions
- Placeholder: `color: #6B7E91`

Unit labels inside inputs (kg, g, kcal, cm) are right-aligned fog text, not interactive.

---

## Today tab

### Layout

Two-column grid: left column (478px) = calorie ring card + protein bar card. Right column (flex:1) = meals.

### Calorie ring card

- SVG circle `r="70"`, `stroke-width="11"`, rotated `-90deg`
- Track: `stroke="#2A3A4A"`; Fill: `stroke="#2ABFAD"`, `stroke-linecap="round"`
- Progress via `stroke-dasharray="439.8"` + `stroke-dashoffset` (computed from consumed/goal)
- Animates on load: `transition: stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)`
- Centre: large kcal number (66px) + "/ 1,300 kcal" label below in fog
- Below ring: "X kcal left today" — number in `#E8EDF2 font-weight:500`, rest in fog

### Protein bar card

- Labels: "PROTEIN" uppercase fog left, percentage fog right
- Large number: 48px + "g" 22px + "/ 90g" 16px fog
- Progress bar: `height: 8px; background: #2A3A4A; border-radius: 5px; overflow: hidden`
- Fill: `background: #2ABFAD; border-radius: 5px`

### Greeting + Done button

- Left: "Good afternoon" (26px, 500) + "Monday · June 22" (15px, fog) below
- Right: "Done for today" amber CTA button — same row as greeting, aligned to bottom

### Meal slots

Four slots: Breakfast, Lunch, Snack, Dinner.

**Empty slot:**
```css
background: #1C2733; border: 1.5px solid #2A3A4A; border-radius: 16px;
padding: 18px 20px; display: flex; align-items: center; gap: 16px; cursor: pointer;
transition: border-color 0.15s;
```
- Left icon: 36×36 rounded square with dashed border `#2A3A4A`, small `+` SVG inside in fog
- Label uppercase fog + "Log breakfast" fog below
- Hover: `border-color: #2ABFAD`

**Logged slot:**
```css
background: #1C2733; border: 1px solid #2A3A4A; border-radius: 16px; padding: 18px 20px;
```
- Left icon: 36×36, `background: rgba(42,191,173,0.14)`, teal checkmark SVG
- Meal name: 16px, 500, white, truncated with ellipsis
- Right side: kcal number (large, ~20px, white) on its own line, "kcal · Xg protein" (12px, fog) below — right aligned
- Hover: stats fade out, edit + trash icons fade in (see interaction rules)

**"Add meal" row** — below the 4 slots: amber `+` icon + "Add meal" text, hover `color: #C9A000`.

### Log meal modal

Two-panel: left panel (flex:1, search + list) + right sidebar (320px, `background: #1A242F`).

**Two-step flow:**
- **Step 1:** Title "Log [Slot]" or "Edit [Slot]". Step indicator "1 / 2" top-right. Search + tag chips + item list
- **Step 2:** Title "Confirm portions". Step indicator "2 / 2". Back button (small chevron circle) top-left. Portion cards per item
- Edit mode: shows "CURRENTLY LOGGED" section above search with chips for each logged item (name + gram count + ✕). Label is "CURRENTLY LOGGED" on Today, "CURRENTLY PLANNED" on Week

**Search input:** full-width, `background: #2A3A4A`, teal focus border, search icon left

**Tag chips (filter):** see global Component patterns section.

**Item rows (step 1):**
- Row: `padding: 12px 8px; border-bottom: 1px solid rgba(42,58,74,0.5); border-radius: 8px`
- Hover: `background: #233040`
- Left: counter badge (32×32, teal border unselected → teal fill + checkmark when selected)
- Centre: item name (500, white) + tags fog small below
- Right: kcal bold + protein fog (right-aligned)
- Sections shown when no active search/filter: "RECENTS" and "FAVOURITES" headers above respective groups

**Portion card (step 2):**

Each selected item gets its own card (`background: #2A3A4A; border-radius: 12px; padding: 16px`):
- Item name top
- Three equal-width buttons: Whole / Half / Custom
  - Off: `border: 1px solid #34465A; color: #8B9BAD; background: transparent`
  - On: `border-color: #2ABFAD; color: #2ABFAD; background: rgba(42,191,173,0.10)` — **Whole selected = teal border + teal text, NOT filled**
- Custom selected: reveals gram input below — `[100] grams` inline, input left, "grams" label right

**Sidebar:**
- "ADDED" header + close button
- Empty state: "Pick items on the left to build this meal." fog centred text
- Added items: name left, kcal + protein right, per row
- Animated removal: max-height + opacity collapse, `150ms ease`
- Footer: "Total" fog label + kcal number (22px) + protein (13px fog)
- CTA: amber enabled / amber-disabled disabled. Label: "Continue" (step 1), "Log meal" (step 2), "Save changes" (edit mode)

**Modal overlay:** `background: rgba(10,14,20,0.72)`
**Modal box:** `max-width: 1000px; height: 660px; max-height: 88vh; border-radius: 24px; box-shadow: 0 30px 80px rgba(0,0,0,0.55)`

---

## Week tab

### Header

- Date range: "Jun 22 – 28" (26px, 500) + context pill ("This week", "Last week", "2 weeks ago", "Next week" etc.)
- Controls right: Randomize meals button (amber, shuffle icon) — only shown for current week and future / prev+next chevrons / Week–Month segmented toggle
- Forward navigation max: 2 weeks ahead. Next chevron disabled at limit

### Week view — day cards

7 cards. Top row: 4 equal columns. Bottom row: 3 cards that stretch across the same 4-column grid.

**Card header:**
- Day abbreviation (small fog, uppercase) + date number (large white) on same line
- Below: `X,XXX / 1,300 kcal` in small fog
- Today badge: small "TODAY" pill top-right of card header
- Goal met: amber star icon top-right of card (replaces or sits beside TODAY badge)

**Card states:**
| State | Visual |
|---|---|
| Past (all logged) | Teal checkmark on each slot, solid rows, read-only (not clickable) |
| Today | Same as past for logged slots; empty slots are interactive |
| Planned (future, has meals) | Dashed border rows, small dot icon left, meal name shown, hover reveals edit+trash |
| Empty (future, no meals) | Dashed border rows, `+` icon left, "Add breakfast/lunch/etc" fog text, hover teal border |

**Planned slot row:**
```css
border: 1px dashed #3A4C5E; border-radius: 10px; padding: 10px 12px;
```
- Left: small filled dot icon (not checkmark, not plus)
- Hover: `border-color: #2ABFAD; background: #1A2430`
- On hover: edit (pencil) + trash icons fade in on the right

**Empty slot row:**
```css
border: 1px dashed #2A3A4A; border-radius: 10px; padding: 10px 12px; cursor: pointer;
```
- Left: `+` icon, fog
- Text: "Add breakfast" etc in fog
- Hover: `border-color: #2ABFAD; background: #1A2430`

**Logged slot row (past days):**
- Teal checkmark left
- Meal name right — no hover actions, read-only

### Week edit modal

Same layout as Today log meal modal. Differences:
- Title: "Edit Breakfast" / "Plan Lunch" etc
- "CURRENTLY PLANNED" label (not "CURRENTLY LOGGED") in the pre-filled section
- Pre-filled items shown as a **borderless table** (name left, kcal+protein right, trash icon far right) — NOT chips

### Randomize meals

Fills all empty slots in the visible week (current + future) from the item/recipe pool. Does not overwrite already-planned slots.

### Month view

- 7-column calendar grid, Mon–Sun headers
- Day cell: date number top-left (large) + `X,XXX / 1,300 kcal` small fog below
- Goal-met days: amber star top-right of cell
- Today: slightly highlighted cell background (`#1C2733` tinted)
- Future empty days: blank cells
- Month label: "June 2026" (includes year). Context pill: "This month" etc

---

## Recipes tab

### Sub-tabs

Items | Recipes toggle (segmented, top-right). Items = individual ingredients per 100g. Recipes = multi-ingredient dishes.

### Top bar

- Search input (stretches to fill available space, left side)
- Sort dropdown (right): "Recently added" / "Name A–Z" / "Name Z–A"
- Primary CTA (far right): "Add item" or "Create recipe" depending on sub-tab

### Filter chips

Horizontally scrollable row of tag chips below top bar. Same chip style as modal tags. Includes "All" chip first. Active chip: teal border + teal text.

### Card grid

`repeat(4, minmax(0, 1fr)); gap: 16px`

**Item cards:**
- Image area top (placeholder: dark bg + image icon)
- Name (16px, 500)
- `X kcal · Yg protein` (13px, fog)
- Tag chips below (small pills, no border, fog bg)
- Hover: `transform: translateY(-2px); border-color: #3D5166`

**Recipe cards:**
- Same structure as item cards
- "Recipe" badge: **top-left** of image area, teal tinted bg + bookmark icon + "Recipe" text
- "Broken" badge: top-left, amber tinted, warning triangle + "Broken" — shown when an ingredient was deleted

### Item detail modal

Centred modal, `animation: rcModalIn`.

- Large image area (placeholder)
- Item name (large, 500)
- Tag chips
- "PER 100G" section label
- Borderless data table: Calories / Protein / Fat / Carbs — label left, bold value right, thin separator between rows
- Footer: Edit button (teal border, flex:1) + Delete button (fog, fixed width) — side by side
- Delete hover: salmon bg tint + red text
- Close button top-right

### Recipe detail modal

Same modal structure. Differences:
- "INGREDIENTS" section: table rows — ingredient name | grams | kcal
- "TOTAL MACROS" section: only Calories + Protein (not Fat/Carbs)
- Same Edit + Delete footer

### Add / Edit item form modal

Single-column scrollable modal.

- Title: "Add item" / "Edit item" + close ✕ top-right
- Photo area: small square placeholder (`#1C2733`, rounded 12px) + "Photo upload coming soon" text beside it
- **Name** field: full width, placeholder "e.g. Banana"
- **Macros per 100g** section: 2×2 grid of inputs — Calories (kcal) | Protein (g) / Fat (g) | Carbs (g). Each has its own label above
- **Tags** section: all available tags as toggle chips (see Component patterns). Active = teal border + teal text. "New tag" chip has dashed teal border — clicking reveals inline text input + checkmark confirm button
- CTA: "Save item" / "Save changes" — full width amber, disabled until name is filled
- Edit mode only: "Delete item" — full width, salmon border + salmon text, below CTA

### Add / Edit recipe form modal

Same modal structure. Differences:
- **Ingredients** section replaces macros grid: search input ("Search your items...") with teal focus border. Results appear below as a flat list (item name left, `X kcal / 100g` right, separator rows). Clicking a result adds it
- Added ingredient rows: card per ingredient — name left, gram input (dark pill, editable, teal border on focus) + "g" + calculated kcal + ✕ button right
- **RECIPE TOTALS** box below ingredients: dark card, uppercase section label, 2×2 grid — Calories (bold kcal) | Protein (bold g) / Fat (bold g) | Carbs (bold g), updates live
- **Tags** section: same toggle chips as item form (see Component patterns). "New tag" dashed chip works the same way
- CTA: "Save recipe" / "Save changes"
- Edit mode: "Delete recipe" — salmon border + salmon text, below CTA

### Confirm delete modal

Small centred modal overlaid on the form.

- Title: `Inter`, 500 — "Delete [Name]?"
- Body: fog text explaining consequence (different for items vs recipes)
- Two buttons side by side: Cancel (ghost) + Delete (salmon fill, white bold text)
- Delete hover: `background: #C85A5A`

---

## Progress tab

### Layout

Two-column flex. Left (flex:2): Goals & metrics. Right (flex:1): Achievements.

### Page header

- "Progress" (26px, 500)
- "Your goals, trends, and the milestones you've earned" (15px, fog)

### Weight card (large, left column)

**Empty state:**
- Dashed teal horizontal line across card centre with clock/circle icon
- "Track your weight" (bold, centred) + "Log your current and target weight to see your progress" (fog, centred)
- "＋ Set weight goal" amber CTA button centred

**Filled state:**
- Top-left: "WEIGHT" label + current weight large number (46px) + "kg" + delta pill (e.g. "−4 kg" teal tinted)
- Top-right: range pills (1M / 3M / All) + pencil edit icon button (38×38, border, hover lightens)
- SVG line chart:
  - Teal gradient area fill
  - Teal line with glow filter
  - Data point dots: `fill: #141B24; stroke: #2ABFAD; stroke-width: 2`
  - Dashed reference lines: "Start 76" fog dashed + "Target 68" teal dashed, labelled right side
  - Hover tooltip: nearest point, weight + date

### Small metric cards (left column, below weight)

Four cards in a row: Protein goal / Calorie limit / Waist / Hips.

- Card header: uppercase label (e.g. "PROTEIN GOAL", "CALORIE LIMIT")
- Filled: large number + unit + subtext (e.g. "Daily target" with small teal dot)
- Waist/Hips filled: number + unit + `/ X cm goal` + teal progress bar
- Hips empty: `+ Add goal` amber text button

**Goal reached state (Waist example in Image 8):**
Card flips horizontally (rotateY 180°) to show back face:
- Amber star icon
- "Goal reached!" (amber, bold)
- "Waist hit 65 cm" (fog)
- "Set new goal" — small amber outlined CTA button

### Achievements (right column)

**Streak summary card (top):**
- Amber star icon (58×58, amber tinted bg) + "7" large number (amber) + "day streak" + status text
- Below: two stats side by side — "23 BEST STREAK" + "42 DAYS TRACKED"

**Milestones grid:**
2-column grid of milestone cards. Each card:
- Icon (teal tinted circle bg when unlocked, dimmed when locked)
- Milestone name (e.g. "First log", "7-day streak")
- "Unlocked [date]" (fog small) or "Locked" (fog small, with lock icon)
- Newly unlocked: "NEW" amber pill badge top-left, `popIn` animation on mount, `newpulse` glow stroke loop

### Progress modals (Weight / Calorie limit / Protein goal / Waist / Hips)

All follow the same pattern — small centred modal, no overlay animation needed.

- Title: metric name (e.g. "Weight", "Calorie limit")
- Section labels uppercase fog
- Input fields: full width, unit label right-aligned inside input (kg, kcal, g, cm)
- **Focus state: teal border `#2ABFAD`** — this must be correct
- Date logged field (where applicable): calendar icon left + date text, same input style
- Footer: Cancel (ghost, left) + Save (amber, right, flex:1) — side by side

---

## Component patterns

### Tag chips (filter + toggle)

Used in: log meal modal filters, Recipes page filter row, add/edit item and recipe forms.

```css
/* base: */
display: inline-flex; align-items: center; padding: 8px 14px;
border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer;
white-space: nowrap; transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
background: #2A3A4A; border: 1.5px solid #2A3A4A; color: #8B9BAD;

/* hover: */ background: #233040;

/* active/selected: */ border-color: #2ABFAD; color: #2ABFAD;
```

"New tag" chip — special variant with dashed border:
```css
border: 1.5px dashed #2ABFAD; color: #2ABFAD; background: transparent;
```
Clicking it replaces the chip with a text input (teal focus border) + a small teal checkmark confirm button inline.

### Input fields — two variants

**Standard input** (used everywhere except macro grid):
```css
background: #2A3A4A; border: 1.5px solid #2A3A4A; border-radius: 12px;
padding: 12px 14px; font-size: 15px; color: #E8EDF2; outline: none;
transition: border-color 150ms ease;
/* hover: */ border-color: #3D5166;
/* focus: */ border-color: #2ABFAD;
/* placeholder: */ color: #6B7E91;
```

**Card-style input** (used in macro grid in add/edit item form, and in ingredient gram inputs):
```css
background: #1C2733; border: 1.5px solid #2A3A4A; border-radius: 12px;
padding: 12px 14px; font-size: 15px; color: #E8EDF2; outline: none;
transition: border-color 150ms ease;
/* hover: */ border-color: #3D5166;
/* focus: */ border-color: #2ABFAD;
```

Unit labels inside inputs (kg, g, kcal, cm) are right-aligned fog text (`#8B9BAD`), not interactive.

**Focus state is always teal `#2ABFAD` — no exceptions.**

### Icon buttons (close, back, edit, trash, pencil)

Small icon-only interactive buttons used throughout.

```css
display: flex; align-items: center; justify-content: center;
border-radius: 8px; cursor: pointer;
color: #8B9BAD; transition: color 150ms ease, transform 80ms ease;
/* hover: */ color: #E8EDF2;
/* active: */ transform: scale(0.9);
```

Sizes vary by context: close button 30×30, back button 32×32, meal icon 34×34. All use `border-radius: 8–9px`.

### Cancel button (ghost)

Used alongside Save or Delete in all modals — always side by side, never full width stacked.

```css
background: transparent; border: 1px solid #34465A; color: #E8EDF2;
padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 500;
transition: border-color 150ms ease, background 150ms ease;
/* hover: */ border-color: #3D5166; background: rgba(255,255,255,0.04);
```

### "Set new goal" button (goal-reached flip card back)

Small outlined amber button, used only on the back face of a flipped metric card.

```css
background: transparent; border: 1.5px solid #E8B800; color: #E8B800;
padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
transition: background 150ms ease;
/* hover: */ background: rgba(232,184,0,0.12);
```

### Segmented toggles (Week/Month, 1M/3M/All, Items/Recipes)

```css
/* container: */ background: #1C2733; border: 1px solid #2A3A4A; border-radius: 11px; padding: 4px;
/* pill off:  */ color: #8B9BAD; border-radius: 8px; padding: 7px 16px; font-size: 13px; font-weight: 500;
/* pill on:   */ background: #2A3A4A; color: #E8EDF2;
transition: background 150ms ease, color 150ms ease;
```

### Chevron nav buttons

```css
width: 32px; height: 32px; border-radius: 8px; color: #E8EDF2;
transition: background 150ms ease;
/* hover: */ background: #2A3A4A;
/* disabled: */ color: #3D5166; cursor: not-allowed; pointer-events: none;
```

### Modal overlay

```css
position: fixed; inset: 0; background: rgba(10,14,20,0.72);
display: flex; align-items: center; justify-content: center;
padding: 40px; z-index: 50;
```

### Cards

```css
background: #1C2733; border: 1px solid #2A3A4A;
```
Border-radius varies by context: 16px meal slots, 18px streak card, 20px metric cards, 24px log meal modal, 12–16px form modals.

---

## Data model (local, future-ready)

All data access lives in `data.js`. No reads or writes anywhere else.

Entities:
- `items` — ingredient library (id, name, kcal/100g, protein/100g, fat/100g, carbs/100g, tags[], imageUrl?, createdAt)
- `recipes` — recipe library (id, name, ingredients[{itemId, grams}], tags[], imageUrl?, createdAt)
- `logs` — daily logs (date, slot: breakfast|lunch|snack|dinner, entries[{itemId|recipeId, portion, grams, kcal, protein}])
- `weight` — weight entries (date, value kg)
- `goals` — (calorieTarget, proteinTarget, weightTarget, weightStart, waistCurrent, waistTarget, hipsCurrent, hipsTarget)
- `streak` — (currentStreak, bestStreak, lastLoggedDate, totalDaysTracked)

Defaults: `calorieTarget: 1300`, `proteinTarget: 90`.

---

## File structure

```
/
├── index.html          → redirects to or is today.html
├── today.html
├── week.html
├── recipes.html
├── progress.html
├── styles.css          → shared global styles (palette, typography, scrollbar, nav, shared components)
├── data.js             → all data access — only file that reads/writes storage
├── today.js
├── week.js
├── recipes.js
└── progress.js
```

Shared CSS and JS in separate files. No page-specific styles or logic inlined into HTML.
