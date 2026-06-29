# Portia Mobile — CC Build Brief

Build `mobile.html` — a single mobile-optimised screen for Portia. It's a stripped-down companion to the desktop app for logging meals and adding items on the go. The prototype is `Portia_Mobile_dc.html` — match it exactly.

---

## File

- `mobile.html` — single self-contained file, all CSS and JS inline
- Uses the same `data.js` as desktop for shared data (items, logs, goals)
- Same Google Fonts link as desktop (`Inter`)
- Same `login.html` auth check — on load, verify `portia_auth: true` in localStorage, redirect to `login.html` if missing

---

## Global styles

```css
body { margin: 0; background: #141B24; }
* { box-sizing: border-box; }
::-webkit-scrollbar { width: 0; height: 0; }
input::placeholder { color: #6B7E91; }
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

Viewport:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```
Use `min-height: 100dvh` (not `vh`) — critical for iOS Safari.

---

## Home screen

```css
position: relative;
height: 100dvh;
background: #141B24;
font-family: Inter, sans-serif;
color: #E8EDF2;
overflow: hidden;
display: flex;
flex-direction: column;
padding: 66px 20px 34px;
```

### Calories ring card

```css
flex: 1;
min-height: 0;
background: #1C2733;
border: 1px solid #2A3A4A;
border-radius: 20px;
padding: 30px 28px;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
```

- "CALORIES" label: `align-self: flex-start; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #8B9BAD; margin-bottom: 18px`

Ring container: `position: relative; width: 216px; height: 216px`

SVG: `width="216" height="216" viewBox="0 0 160 160" style="transform: rotate(-90deg)"`
- Track: `cx="80" cy="80" r="70" fill="none" stroke="#2A3A4A" stroke-width="11"`
- Fill: `cx="80" cy="80" r="70" fill="none" stroke="#2ABFAD" stroke-width="11" stroke-linecap="round"`
- Progress: `stroke-dasharray: 439.8; stroke-dashoffset: {439.8 * (1 - Math.min(1, consumed/goal))}`
- Animate on load: `transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)`

Centre text (absolutely positioned over ring):
- Consumed kcal: `font-size: 58px; font-weight: 600; line-height: 0.95; color: #E8EDF2; letter-spacing: -0.03em`
- "/ 1,300 kcal": `font-size: 15px; color: #8B9BAD; margin-top: 6px`

Below ring: `margin-top: 24px; font-size: 15px; color: #8B9BAD`
- Number span: `color: #E8EDF2; font-weight: 600`
- " kcal left today" in fog

### CTA buttons

```css
display: flex;
flex-direction: column;
gap: 12px;
margin-top: 24px;
```

**Log meal (primary amber):**
```css
border: none;
width: 100%;
background: #E8B800;
color: #141B24;
font-family: Inter, sans-serif;
font-size: 16px;
font-weight: 600;
padding: 16px;
border-radius: 13px;
cursor: pointer;
transition: background 150ms ease, transform 80ms ease;
```
- Hover: `background: #C9A000`
- Active: `transform: scale(0.985)` — always scale, never padding change

**Add item (secondary):**
```css
width: 100%;
background: #1C2733;
border: 1px solid #2A3A4A;
color: #E8EDF2;
font-family: Inter, sans-serif;
font-size: 16px;
font-weight: 600;
padding: 16px;
border-radius: 13px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
gap: 8px;
transition: border-color 150ms ease, transform 80ms ease;
```
- Plus icon: inline SVG `width="17" height="17"`, `stroke-width: 1.8`
- Hover: `border-color: #3D5166`
- Active: `transform: scale(0.985)`

---

## Log meal modal

Slides up over the full screen:
```css
position: absolute; inset: 0; z-index: 60;
background: #141B24;
display: flex; flex-direction: column;
animation: sheetUp 300ms cubic-bezier(0.22, 1, 0.36, 1);
```

### Step 1 — Pick items

**Header:** `display: flex; align-items: center; justify-content: space-between; padding: 62px 20px 14px`
- Title "Log meal": `font-size: 21px; font-weight: 600; color: #E8EDF2`
- Close ✕ button: `width: 34px; height: 34px; border-radius: 9px; background: #1C2733; border: 1px solid #2A3A4A; color: #8B9BAD; cursor: pointer`
  - Active: `transform: scale(0.9)`

**Slot selector:** `display: flex; gap: 4px; margin: 0 20px 16px; background: #1C2733; border: 1px solid #2A3A4A; border-radius: 13px; padding: 5px`

Each pill: `flex: 1; text-align: center; padding: 9px 0; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 150ms ease, color 150ms ease`
- Active: `background: #2A3A4A; color: #E8EDF2`
- Inactive: `background: transparent; color: #8B9BAD`

**Search:** `position: relative; margin: 0 20px 14px`
```css
input {
  width: 100%;
  background: #2A3A4A;
  border: 1.5px solid #2A3A4A;
  border-radius: 12px;
  padding: 13px 16px 13px 44px;
  font-size: 15px;
  color: #E8EDF2;
  outline: none;
  transition: border-color 150ms ease;
}
input:focus { border-color: #2ABFAD; }
```
Search icon: `position: absolute; left: 15px; top: 50%; transform: translateY(-50%); stroke: #8B9BAD`

**Filter chips:** `display: flex; gap: 8px; overflow-x: auto; padding: 0 20px 14px`
- Default chip: `display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; background: #2A3A4A; border: 1.5px solid #2A3A4A; color: #8B9BAD`
- Active chip: `border-color: #2ABFAD; color: #2ABFAD`

**Item list:** `flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px`

Section headers (RECENTS, FAVOURITES, ALL ITEMS):
`font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8B9BAD; margin: 4px 0`
- FAVOURITES header has `margin-top: 18px`

Item row: `display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid rgba(42,58,74,0.5); cursor: pointer`
- The **entire row** is clickable (toggles selection) — not just the badge
- Left: item info — name `font-size: 15px; font-weight: 500; color: #E8EDF2` + tags `font-size: 12px; color: #8B9BAD; margin-top: 2px` (joined with " · ")
- Right: kcal `font-size: 14px; font-weight: 500; color: #E8EDF2` + protein `font-size: 12px; color: #8B9BAD` (right-aligned, `flex-shrink: 0`)
- Counter badge: `width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0`
  - Unselected: `background: transparent; border: 1.5px solid #2ABFAD` + teal `+` icon inside
  - Selected: `background: #2ABFAD; border: 1px solid #2ABFAD` + white checkmark icon inside

No results state: `padding: 48px 8px; text-align: center; font-size: 15px; color: #8B9BAD` — "Nothing found. Try Add item instead."

**Footer:** `background: #141B24; border-top: 1px solid #2A3A4A; padding: 16px 20px 28px`
- Top row: item count (14px, fog, left) + running kcal total (16px, 600, white, right). `margin-bottom: 14px`
- "Continue" CTA: full width amber when ≥1 item selected, disabled (`rgba(232,184,0,0.32)` bg, muted text) otherwise

### Step 2 — Confirm portions

**Header:** `display: flex; align-items: center; gap: 12px; padding: 62px 20px 16px`
- Back button (left): `width: 34px; height: 34px; border-radius: 9px; border: 1px solid #34465A; color: #8B9BAD; cursor: pointer` — note: this one has a plain border, NOT the `#1C2733` background of the close button
  - Active: `transform: scale(0.9)`
- Title "Confirm portions": `font-size: 21px; font-weight: 600; color: #E8EDF2; flex: 1`
- Close ✕ button (right): same style as step 1 close

**Scrollable content:** `flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px`

Portion card per item:
```css
background: #1C2733;
border: 1px solid #2A3A4A;
border-radius: 14px;
padding: 16px 18px;
```
- Item name: `font-size: 15px; font-weight: 500; color: #E8EDF2; margin-bottom: 14px`
- Three buttons row: `display: flex; gap: 8px`
  - Each: `flex: 1; text-align: center; padding: 10px 0; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer`
  - Off: `border: 1px solid #34465A; color: #8B9BAD; background: transparent`
  - On: `border: 1px solid #2ABFAD; color: #2ABFAD; background: rgba(42,191,173,0.10)`
- Custom gram input (shown when Custom selected): `margin-top: 12px; display: flex; align-items: center; gap: 8px`
  - Input: `width: 96px; background: #2A3A4A; border: 1.5px solid #34465A; border-radius: 10px; padding: 10px 12px; font-size: 14px; color: #E8EDF2; outline: none; text-align: right`
  - Focus: `border-color: #2ABFAD`
  - Only accepts numeric input — strip non-digits
  - "grams" label: `font-size: 14px; color: #8B9BAD`

**Footer:** `background: #141B24; border-top: 1px solid #2A3A4A; padding: 16px 20px 28px`
- Top row: "Total" (14px, fog, left) + kcal (18px, 600, white) + " · " + protein (13px, fog) right-aligned. `margin-bottom: 14px`
- "Log meal" CTA: full width amber when all portions valid, disabled otherwise

---

## Add item modal

Same slide-up animation as log meal modal.

**Header:** `display: flex; align-items: center; justify-content: space-between; padding: 62px 20px 16px`
- "Add item" title: `font-size: 21px; font-weight: 600`
- Close ✕ button: same style as log meal close

**Scrollable content:** `flex: 1; min-height: 0; overflow-y: auto; padding: 6px 20px 20px`

Photo area: `display: flex; align-items: center; gap: 14px; margin-bottom: 22px`
- Square: `width: 64px; height: 64px; border-radius: 14px; background: #1C2733; border: 1.5px dashed #2A3A4A; color: #8B9BAD` + image placeholder icon inside
- Text: `font-size: 13px; color: #8B9BAD` — "Photo upload coming soon"

"NAME" section label: `font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #8B9BAD; margin-bottom: 8px`

Name input: `width: 100%; background: #2A3A4A; border: 1.5px solid #2A3A4A; border-radius: 12px; padding: 14px 16px; font-size: 15px; color: #E8EDF2; outline: none; margin-bottom: 24px`
- Focus: `border-color: #2ABFAD`

"MACROS PER 100G" section label: same style, `margin-bottom: 10px`

Macro grid: `display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px`

Each macro cell:
```css
background: #1C2733;
border: 1px solid #2A3A4A;
border-radius: 12px;
padding: 12px 14px;
```
- Label: `font-size: 12px; color: #8B9BAD; margin-bottom: 6px` (Calories / Protein / Fat / Carbs)
- Input inside: `width: 100%; background: transparent; border: none; font-size: 20px; font-weight: 600; color: #E8EDF2; outline: none; padding: 0`
  - Placeholder: "0"
  - Only numeric input — strip non-digits

"TAGS" section label: same style, `margin-bottom: 10px`

Tags: `display: flex; flex-wrap: wrap; gap: 8px`
- Same toggle chip style as filter chips above
- "New tag" chip at end: `border: 1.5px dashed #34465A; color: #8B9BAD` (fog dashed, not teal) + small `+` icon

**Footer:** `background: #141B24; border-top: 1px solid #2A3A4A; padding: 16px 20px 28px`
- "Save item" CTA: full width amber when name field has content, disabled otherwise

---

## Toast

Absolutely positioned, appears over everything:
```css
position: absolute;
left: 20px; right: 20px; bottom: 48px;
z-index: 80;
display: flex; align-items: center; justify-content: center; gap: 9px;
background: #1C2733;
border: 1px solid #2ABFAD;
color: #E8EDF2;
border-radius: 12px;
padding: 14px 20px;
box-shadow: 0 12px 30px rgba(0,0,0,0.4);
transition: opacity 280ms ease, transform 280ms ease;
```
- Visible: `opacity: 1; transform: translateY(0)`
- Hidden: `opacity: 0; transform: translateY(14px)`
- Left: teal checkmark SVG icon
- Text: `font-size: 14px; font-weight: 500` — "[Slot] logged ✓" or "Item added ✓"

**Toast timing:**
1. Set toast text, keep hidden (`toastVis: false`)
2. After 20ms → show (`toastVis: true`) — delay ensures CSS transition fires
3. After 2000ms → hide (`toastVis: false`)
4. After 2350ms → remove from DOM

---

## Portion calculation

```js
// Whole = full wholeG amount
// Half = wholeG * 0.5
// Custom = customG entered by user
const factor = portion === 'whole' ? 1
             : portion === 'half'  ? 0.5
             : Number(customG) / item.wholeG;
const kcal    = Math.round(item.kcal    * factor);
const protein = Math.round(item.protein * factor);
```

`allOk` = every selected item has a valid portion (custom inputs with 0 or empty = not ok).

---

## Data

Uses `data.js`. On load:
- Read `goals.calorieTarget` for ring goal
- Sum today's `logs` entries for consumed kcal
- After logging: write to `logs`, update ring live without page reload
- After saving item: write to `items`

Each item in the library has a `wholeG` property (the "one serving" gram weight) used for portion calculation.
