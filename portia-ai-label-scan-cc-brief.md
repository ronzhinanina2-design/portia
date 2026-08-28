# Portia — AI Label Scan (Photo-to-Macros)

## What it is
A "Scan label" option in the add-item flow that lets Nina upload a photo of a nutrition label and have Claude's AI vision read the macros off it automatically, instead of typing them in by hand.

## The problem it solves
Nina is adding new dietary options to her life, which means a lot more new items to log into Portia. Typing kcal/protein/carbs/fat off every new label by hand is slow and repetitive. The barcode scanner already speeds this up for items that exist in the Open Food Facts database — but that database is free/community-run and doesn't have everything. AI label scan fills that gap for anything the barcode scanner can't find.

## Target user
Nina, logging new packaged food items into her personal item library on desktop.

## Success looks like
- Adding a new packaged item takes one photo upload instead of manual typing
- Works for items barcode scan can't find (not in Open Food Facts, or item has no barcode)
- Extracted macros are accurate enough that review/edit is quick, not a full re-do

---

## Scope decisions (confirmed)

- **What it captures:** Macros only — kcal, protein, carbs, fat. No serving size, name, or brand extraction. Keeps the first version simple and the AI's job narrow (which also makes it more accurate).
- **Where it plugs in:** New items only, same as barcode scanner. Not recipes. If a recipe card photo is uploaded, treat it the same as a packaged label — just pull the macros, not a multi-ingredient breakdown.
- **Platform:** Desktop only for now. The barcode scanner is mobile-only (needs a live camera); this feature is upload-only (no live camera), which technically works everywhere, but since mobile Portia has other unresolved issues right now, this ships desktop-only until that's sorted.
- **Input method:** Upload only. No live camera capture, no crop/retake step.
- **Entry point:** A second button next to "Scan barcode" in the add-item screen, e.g. "Scan label."
- **Review flow:** Reuses the exact same result/review screen as the barcode flow — same layout, same portion step, same editable fields. AI results are prefilled but not auto-saved; Nina reviews and confirms before it's added to the library.
- **Item photo:** The uploaded label photo is NOT automatically set as the item's photo. If Nina wants a photo on the item, that's still a separate manual step via the existing photos feature.
- **Error handling:** If the AI can't confidently read the label (blurry, cropped, not actually a nutrition label), show an error state. Nina can retry with a different photo or fall back to manual entry — no in-app crop/retake tool.

---

## Tech considerations

### How the AI reading works
Nina's app will send the uploaded photo to Claude's API (Anthropic's AI) and ask it to read the macros off the label and return them as structured data (a simple list: kcal, protein, carbs, fat). This is the same idea as asking a very literal assistant to look at a photo and fill in four boxes. Cost is fractions of a cent per photo — for personal use, a few cents a month at most.

**Complexity: Low-Medium.** The AI call itself is simple. The main complexity is in the API key handling below.

### The API key problem (needs a decision before CC builds this)

Portia is a static site — it's just files hosted on GitHub Pages, with no server of its own. To call Claude's API, the app needs an API key (think of it like a password that lets the app use the AI on Nina's account and bill her for usage).

The problem: if the key lives directly in Portia's code, anyone who opens the browser's dev tools (or views the page source) can find it and use it — running up Nina's bill or misusing it. This is different from Open Food Facts, which needs no key at all.

There are two ways to handle this:

**Option A — Serverless function as a middleman (recommended)**
Instead of Portia's code talking to Claude's API directly, it talks to a small function hosted on a free service (like Vercel or Netlify). That function holds the API key privately (never sent to the browser) and forwards the photo to Claude, then sends the result back to Portia. Think of it like a mailroom: Portia hands the photo to the mailroom, the mailroom (which has the only key) sends it off and hands back the reply — nobody outside ever sees the key.
- **Complexity: Low-Medium.** This is a one-time setup (CC builds one small function, a few dozen lines of code, and Nina deploys it for free on Vercel or Netlify — no ongoing cost for personal-use volume). After that, it's invisible — Nina never touches it again.
- **This is the standard, safe way to do this for a static site.**

**Option B — Key lives client-side (simple but risky)**
The key goes straight into Portia's code. Faster to build, but exposed to anyone who looks. For a genuinely personal, unlisted app this risk is lower than for a public product — but it's still a real risk if the URL is ever shared, indexed, or the repo is public.
- **Complexity: Low.** No extra setup.
- **Not recommended**, but listed since it's the "keep it simple" option if Nina decides the risk is acceptable.

**Decision: Option A confirmed.** Nina is going with the serverless function approach — the API key stays private, Portia never talks to Claude directly.

---

## Full task list

### Decisions before CC starts
- [ ] Nina creates a free Vercel or Netlify account (CC can guide setup)

### Build (CC)
- [ ] Add "Scan label" button next to "Scan barcode" in add-item screen (desktop only — hide/disable on mobile viewport)
- [ ] Build upload input (file picker, image only)
- [ ] Build the small serverless function that receives the photo and calls Claude's API, holding the key server-side (never exposed to the browser)
- [ ] Wire Portia's upload flow to call that function and receive back kcal/protein/carbs/fat
- [ ] Prefill the existing barcode result/review screen with the returned macros
- [ ] Error state: if AI can't extract clear values, show error message with "Try again" (re-upload) or "Enter manually" fallback
- [ ] Confirm the label photo itself is discarded after use, not attached to the item (per scope decision)

---

## Open questions / risks
- Accuracy on messy/angled photos hasn't been tested yet — worth trying a handful of real labels from Nina's kitchen before considering this done
- Nina will need to keep the free hosting account (Vercel/Netlify) active — low risk, but worth knowing it's a small piece of new infrastructure outside GitHub Pages
