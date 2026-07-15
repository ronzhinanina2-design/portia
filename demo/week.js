/* ============ Portia — Week tab ============ */

let GOAL_KCAL_WK = Data.getGoals().calorieTarget;
const SLOT_META_WK = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['snack', 'Snack'],
  ['dinner', 'Dinner'],
];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WD_HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function fmtWk(n) {
  return n.toLocaleString('en-US');
}
function capWk(w) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}
function pad2(n) {
  return String(n).padStart(2, '0');
}
function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const TODAY_KEY_WK = dateKey(startOfToday());

function mondayOf(offset) {
  const t = startOfToday();
  const dow = (t.getDay() + 6) % 7; // 0 = Monday
  const thisMonday = addDays(t, -dow);
  return addDays(thisMonday, offset * 7);
}
function statusOf(k) {
  if (k < TODAY_KEY_WK) return 'past';
  if (k === TODAY_KEY_WK) return 'today';
  return 'future';
}
function mShort(d) {
  return d.toLocaleString('en-US', { month: 'short' });
}

const wkState = {
  view: 'week',
  weekOffset: 0,
  monthOffset: 0,
  modalKey: null,
  modalSlot: null,
  editMode: false,
  originalIds: [],
  removingIds: [],
  step: 1,
  search: '',
  activeTags: [],
  selected: {},
  order: [],
};

function setWkState(patch) {
  const next = typeof patch === 'function' ? patch(wkState) : patch;
  Object.assign(wkState, next);
  renderWeek();
}

function recipeTotalsWk(r) {
  let kcal = 0, protein = 0, grams = 0, broken = false;
  for (const ing of r.ingredients) {
    const it = Data.getItemById(ing.itemId);
    if (!it) { broken = true; continue; }
    kcal += Math.round((it.kcal * ing.grams) / 100);
    protein += Math.round((it.protein * ing.grams) / 100);
    grams += ing.grams;
  }
  return { kcal, protein, grams: grams || 100, broken };
}

function tagNamesWk(ids) {
  return (ids || []).map((tid) => Data.getTagById(tid)).filter(Boolean).map((t) => t.name);
}

function itemByIdWk(id) {
  const it = Data.getItemById(id);
  if (it) return { id: it.id, name: it.name, tagIds: it.tagIds || [], kcal: it.kcal, protein: it.protein, wholeG: it.wholeG || 100, isRecipe: false, favourite: !!it.favourite };
  const r = Data.getRecipeById(id);
  if (!r) return null;
  const t = recipeTotalsWk(r);
  return { id: r.id, name: r.name, tagIds: r.tagIds || [], kcal: (t.kcal / t.grams) * 100, protein: (t.protein / t.grams) * 100, wholeG: t.grams, isRecipe: true, broken: t.broken, favourite: !!r.favourite };
}

function fullLibraryWk() {
  const items = Data.getItems().map((i) => itemByIdWk(i.id));
  const recipes = Data.getRecipes().map((r) => itemByIdWk(r.id)).filter((r) => r && !r.broken);
  return [...items, ...recipes];
}

function recentLibraryIdsWk(limit) {
  const logs = Data.getAllLogs().slice().sort((a, b) => b.date.localeCompare(a.date));
  const seen = [];
  for (const log of logs) {
    for (const entry of log.entries) {
      if (!seen.includes(entry.itemId)) seen.push(entry.itemId);
      if (seen.length >= limit) return seen;
    }
  }
  return seen;
}
function isConfirmedWk(sel) {
  if (!sel || !sel.portion) return false;
  if (sel.portion === 'custom') return Number(sel.customG) > 0;
  return true;
}
function gramsForSelectionWk(it, sel) {
  const wholeG = it.wholeG || 100;
  if (sel.portion === 'whole') return wholeG;
  if (sel.portion === 'half') return wholeG / 2;
  return Number(sel.customG);
}
function calcWk(it, sel) {
  if (!isConfirmedWk(sel)) return null;
  const grams = gramsForSelectionWk(it, sel);
  return { kcal: Math.round((it.kcal * grams) / 100), protein: Math.round((it.protein * grams) / 100) };
}
function wholePortionKcalWk(it) {
  return Math.round((it.kcal * (it.wholeG || 100)) / 100);
}
function wholePortionProteinWk(it) {
  return Math.round((it.protein * (it.wholeG || 100)) / 100);
}

function mealsForDate(k) {
  const out = {};
  SLOT_META_WK.forEach(([sk]) => {
    out[sk] = Data.getLogForSlot(k, sk);
  });
  return out;
}
function summarizeEntries(log) {
  if (!log) return null;
  let kcal = 0, protein = 0;
  const names = [];
  for (const entry of log.entries) {
    const lib = itemByIdWk(entry.itemId);
    if (!lib) continue;
    kcal += entry.kcal;
    protein += entry.protein;
    names.push(lib.name);
  }
  return { names, kcal, protein };
}
function consumedForDate(meals) {
  let c = 0;
  SLOT_META_WK.forEach(([sk]) => {
    const sm = summarizeEntries(meals[sk]);
    if (sm) c += sm.kcal;
  });
  return c;
}

function escapeHtmlWk(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============ Actions ============ */

function prevWeek() {
  setWkState((s) => ({ weekOffset: s.weekOffset - 1 }));
}
function nextWeek() {
  setWkState((s) => (s.weekOffset < 2 ? { weekOffset: s.weekOffset + 1 } : {}));
}
function prevMonth() {
  setWkState((s) => ({ monthOffset: s.monthOffset - 1 }));
}
function nextMonth() {
  setWkState((s) => ({ monthOffset: s.monthOffset + 1 }));
}
function setView(v) {
  setWkState({ view: v });
}

/* ============ Randomize meals — slot-aware rules ============ */
/* See portia-randomize-rules-cc-brief.md. Slot filter (Rule 1) never relaxes;
   everything else — additions, no-repeat — relaxes in the documented order
   before a slot is left empty. */
const SLOT_TAG_NAMES_WK = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const ANCHOR_TAG_NAMES_WK = ['Meat', 'Fish', 'High protein', 'Dairy'];
const SIDE_TAG_NAMES_WK = ['Garnish', 'Vegetarian'];
const NO_REPEAT_DAYS_WK = 3;

function tagIdByNameWk(name) {
  const t = Data.getTags().find((tg) => tg.name === name);
  return t ? t.id : null;
}
function hasTagWk(entity, name) {
  const id = tagIdByNameWk(name);
  return !!id && (entity.tagIds || []).includes(id);
}
function isRecipeIdWk(id) {
  return !!Data.getRecipeById(id);
}
// A candidate's identity for no-repeat purposes: a recipe id, or the sorted
// set of item ids that made up an item-combo (order-independent).
function signatureForEntriesWk(entries) {
  if (entries.length === 1 && isRecipeIdWk(entries[0].itemId)) return `recipe:${entries[0].itemId}`;
  return `combo:${entries.map((e) => e.itemId).slice().sort().join(',')}`;
}
function recentSignaturesForSlotWk(targetDateKey, slotKey, windowDays) {
  const base = new Date(`${targetDateKey}T00:00:00`);
  const sigs = new Set();
  for (let i = 1; i <= windowDays; i++) {
    const k = dateKey(addDays(base, -i));
    const log = Data.getLogForSlot(k, slotKey);
    if (log && log.entries.length) sigs.add(signatureForEntriesWk(log.entries));
  }
  return sigs;
}
function entryForIdWk(id) {
  const it = itemByIdWk(id);
  return { itemId: id, portion: 'whole', grams: it.wholeG || 100, kcal: wholePortionKcalWk(it), protein: wholePortionProteinWk(it) };
}
function pickRandomWk(list) {
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
function pickByTagWk(items, tagNames, excludeIds) {
  return pickRandomWk(items.filter((it) => !excludeIds.includes(it.id) && tagNames.some((t) => hasTagWk(it, t))));
}
// Rule 3: exactly one anchor (Meat/Fish/High protein/Dairy). No anchor = no combo.
function buildComboWk(items, allowAdditions) {
  const anchor = pickByTagWk(items, ANCHOR_TAG_NAMES_WK, []);
  if (!anchor) return null;
  const combo = [anchor.id];
  // Additions must exclude anything else carrying an anchor tag (Meat/Fish/High
  // protein/Dairy) — otherwise a side that's incidentally also High protein (or
  // similar) would give the combo two anchors instead of exactly one (Rule 3).
  const nonAnchorItems = items.filter((it) => !ANCHOR_TAG_NAMES_WK.some((t) => hasTagWk(it, t)));
  // Rule 4: one optional garnish/vegetarian side and one optional grain, capped at 3 items.
  if (allowAdditions) {
    if (Math.random() < 0.65) {
      const side = pickByTagWk(nonAnchorItems, SIDE_TAG_NAMES_WK, combo);
      if (side) combo.push(side.id);
    }
    if (Math.random() < 0.65) {
      const grain = pickByTagWk(nonAnchorItems, ['Grains'], combo);
      if (grain) combo.push(grain.id);
    }
    // Healthy fats are a condiment layered on top — doesn't count toward the cap.
    if (Math.random() < 0.4) {
      const fat = pickByTagWk(nonAnchorItems, ['Healthy fats'], combo);
      if (fat) combo.push(fat.id);
    }
  }
  return combo;
}
// Rule 7 final fallback: no anchor requirement at all, just anything in the slot pool.
function pickAnyFromSlotWk(items) {
  const it = pickRandomWk(items);
  return it ? [it.id] : null;
}

// Builds one candidate (whole recipe or item-combo) for breakfast/lunch/dinner,
// relaxing Rule 6 (no-repeat) then Rule 4 (additions) then the anchor requirement
// (Rule 7) in order until something is eligible. Rule 1 (slot tag) never relaxes —
// `items`/`recipes` are pre-filtered to the slot and every helper above only
// ever picks from that pre-filtered set.
function buildMainCandidateWk(slotKey, targetDateKey, avoidSig) {
  const slotTagName = SLOT_TAG_NAMES_WK[slotKey];
  const items = Data.getItems().filter((it) => hasTagWk(it, slotTagName));
  const recipes = Data.getRecipes().filter((r) => hasTagWk(r, slotTagName));
  const recent = recentSignaturesForSlotWk(targetDateKey, slotKey, NO_REPEAT_DAYS_WK);
  // Reshuffling an already-randomized slot: avoid handing back the exact same
  // pick it already has, same as the 3-day no-repeat rule (and same fallback).
  if (avoidSig) recent.add(avoidSig);

  const stages = [
    { noRepeat: true, allowAdditions: true, requireAnchor: true },
    { noRepeat: false, allowAdditions: true, requireAnchor: true },
    { noRepeat: false, allowAdditions: false, requireAnchor: true },
    { noRepeat: false, allowAdditions: false, requireAnchor: false },
  ];

  for (const stage of stages) {
    const pool = [];
    recipes.forEach((r) => {
      if (stage.noRepeat && recent.has(`recipe:${r.id}`)) return;
      pool.push({ entries: [entryForIdWk(r.id)] });
    });
    const seenCombos = new Set();
    for (let attempt = 0; attempt < 12; attempt++) {
      const comboIds = stage.requireAnchor ? buildComboWk(items, stage.allowAdditions) : pickAnyFromSlotWk(items);
      if (!comboIds) continue;
      const sig = `combo:${comboIds.slice().sort().join(',')}`;
      if (seenCombos.has(sig)) continue;
      seenCombos.add(sig);
      if (stage.noRepeat && recent.has(sig)) continue;
      pool.push({ entries: comboIds.map((id) => entryForIdWk(id)) });
    }
    if (pool.length) return pickRandomWk(pool);
  }
  return null; // Rule 1's pool is genuinely empty — leave the slot empty.
}

// Rule 5: snacks are always exactly one Snack-tagged item, never a combo or recipe.
function buildSnackCandidateWk(targetDateKey, avoidSig) {
  const items = Data.getItems().filter((it) => hasTagWk(it, 'Snack'));
  if (!items.length) return null;
  const recent = recentSignaturesForSlotWk(targetDateKey, 'snack', NO_REPEAT_DAYS_WK);
  if (avoidSig) recent.add(avoidSig);
  const fresh = items.filter((it) => !recent.has(`combo:${it.id}`));
  const pick = pickRandomWk(fresh.length ? fresh : items);
  return pick ? { entries: [entryForIdWk(pick.id)] } : null;
}

// Slots that "Randomize meals" itself filled (as `date|slot` keys), tracked
// in memory for this page session only. A second press reshuffles these —
// slots the user planned by hand are never in this set, so they're always
// left alone, matching the documented "doesn't overwrite already-planned
// slots" behavior.
const randomizedSlotKeysWk = new Set();

function randomize() {
  if (wkState.weekOffset < 0) return;
  const mon = mondayOf(wkState.weekOffset);
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const k = dateKey(d);
    if (statusOf(k) !== 'future') continue;
    SLOT_META_WK.forEach(([sk]) => {
      const key = `${k}|${sk}`;
      const existing = Data.getLogForSlot(k, sk);
      const isReshuffle = existing && randomizedSlotKeysWk.has(key);
      if (existing && !isReshuffle) return; // planned by hand — leave it
      const avoidSig = isReshuffle ? signatureForEntriesWk(existing.entries) : null;
      const candidate = sk === 'snack' ? buildSnackCandidateWk(k, avoidSig) : buildMainCandidateWk(sk, k, avoidSig);
      if (!candidate) return;
      Data.setLogForSlot(k, sk, candidate.entries);
      randomizedSlotKeysWk.add(key);
    });
  }
  renderWeek();
}

function openPicker(k, slot) {
  const log = Data.getLogForSlot(k, slot);
  if (log) {
    const selected = {};
    const order = [];
    for (const entry of log.entries) {
      selected[entry.itemId] = { portion: entry.portion, customG: entry.portion === 'custom' ? String(entry.grams) : '' };
      order.push(entry.itemId);
    }
    setWkState({ modalKey: k, modalSlot: slot, editMode: true, originalIds: [...order], removingIds: [], step: 1, search: '', activeTags: [], selected, order });
  } else {
    setWkState({ modalKey: k, modalSlot: slot, editMode: false, originalIds: [], removingIds: [], step: 1, search: '', activeTags: [], selected: {}, order: [] });
  }
}
function closeModalWk() {
  setWkState({ modalKey: null, modalSlot: null });
}
function removePlanned(k, sk) {
  randomizedSlotKeysWk.delete(`${k}|${sk}`);
  Data.clearLogForSlot(k, sk);
  renderWeek();
}
function toggleItemWk(id) {
  setWkState((s) => {
    const selected = { ...s.selected };
    let order = [...s.order];
    let originalIds = [...s.originalIds];
    if (selected[id]) {
      delete selected[id];
      order = order.filter((x) => x !== id);
      originalIds = originalIds.filter((x) => x !== id);
    } else {
      selected[id] = { portion: null, customG: '' };
      order = [...order, id];
    }
    return { selected, order, originalIds };
  });
}
function removeOriginalWk(id) {
  setWkState((s) => ({ removingIds: [...s.removingIds, id] }));
  setTimeout(() => {
    setWkState((s) => {
      const selected = { ...s.selected };
      delete selected[id];
      return {
        selected,
        order: s.order.filter((x) => x !== id),
        originalIds: s.originalIds.filter((x) => x !== id),
        removingIds: s.removingIds.filter((x) => x !== id),
      };
    });
  }, 260);
}
function toggleTagWk(t) {
  setWkState((s) => ({ activeTags: s.activeTags.includes(t) ? s.activeTags.filter((x) => x !== t) : [...s.activeTags, t] }));
}
function setPortionWk(id, p) {
  if (p === 'custom') pendingFocusWk = { selector: `.custom-g-input-wk[data-id="${id}"]` };
  setWkState((s) => ({ selected: { ...s.selected, [id]: { ...s.selected[id], portion: p } } }));
}
function setCustomGWk(id, v) {
  const clean = String(v).replace(/[^0-9]/g, '');
  setWkState((s) => ({ selected: { ...s.selected, [id]: { ...s.selected[id], portion: 'custom', customG: clean } } }));
}
function gotoStep2Wk() {
  setWkState({ step: 2 });
}
function gotoStep1Wk() {
  setWkState({ step: 1 });
}
function savePlan() {
  const s = wkState;
  // The user just touched this slot by hand — randomize should never claim
  // it as its own again, whether they cleared it or set new contents.
  randomizedSlotKeysWk.delete(`${s.modalKey}|${s.modalSlot}`);
  if (s.order.length === 0) {
    Data.clearLogForSlot(s.modalKey, s.modalSlot);
  } else {
    const entries = s.order.map((id) => {
      const lib = itemByIdWk(id);
      const sel = s.selected[id];
      const c = calcWk(lib, sel) || { kcal: wholePortionKcalWk(lib), protein: wholePortionProteinWk(lib) };
      const grams = gramsForSelectionWk(lib, sel);
      return { itemId: id, portion: sel.portion, grams, kcal: c.kcal, protein: c.protein };
    });
    Data.setLogForSlot(s.modalKey, s.modalSlot, entries);
  }
  setWkState({ modalKey: null, modalSlot: null });
}

/* ============ Rendering ============ */

function renderNavWk() {
  return `
    <div class="nav-row">
      <div class="nav-left">
        <div class="logo-wrap"><div class="logo">portia</div><span class="demo-badge">DEMO</span></div>
        <div class="nav-pills">
          <a class="nav-tab" href="today.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/></svg>
            Today
          </a>
          <a class="nav-tab active" href="week.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
            Week
          </a>
          <a class="nav-tab" href="recipes.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>
            Recipes
          </a>
          <a class="nav-tab" href="progress.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16"/><path d="M7 15l3.5-4 3 2.5L20 7"/></svg>
            Progress
          </a>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="streak-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#E8B800" stroke="none"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"/></svg>
          <span class="streak-number">${Data.getStreak().currentStreak}</span>
          <span class="streak-label">day streak</span>
        </div>
        <a href="backup.html" title="Backup & sync" style="width:40px; height:40px; border-radius:12px; background:#1C2733; border:1px solid #2A3A4A; display:flex; align-items:center; justify-content:center; color:#8B9BAD; transition:color 150ms ease;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.6 4.6 0 0 1-1-9.1A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1-1 7.9"></path><path d="M12 12v8m0 0-3-3m3 3 3-3"></path></svg>
        </a>
      </div>
    </div>
  `;
}

function renderHeaderWk() {
  const s = wkState;
  const isWeek = s.view === 'week';
  const isMonth = s.view === 'month';
  let headerLabel, headerTag;
  if (isWeek) {
    const mon = mondayOf(s.weekOffset);
    const sun = addDays(mon, 6);
    const sameM = mon.getMonth() === sun.getMonth();
    headerLabel = `${mShort(mon)} ${mon.getDate()} – ${sameM ? '' : mShort(sun) + ' '}${sun.getDate()}`;
    headerTag = s.weekOffset === 0 ? 'This week' : s.weekOffset === -1 ? 'Last week' : s.weekOffset === 1 ? 'Next week' : s.weekOffset < 0 ? `${-s.weekOffset} weeks ago` : `In ${s.weekOffset} weeks`;
  } else {
    const base = new Date(startOfToday().getFullYear(), startOfToday().getMonth() + s.monthOffset, 1);
    headerLabel = base.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    headerTag = s.monthOffset === 0 ? 'This month' : s.monthOffset === -1 ? 'Last month' : s.monthOffset === 1 ? 'Next month' : s.monthOffset < 0 ? `${-s.monthOffset} months ago` : `In ${s.monthOffset} months`;
  }
  const atMax = isWeek && s.weekOffset >= 2;
  const showRandomize = isWeek && s.weekOffset >= 0;

  return `
    <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px; gap:20px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:14px;">
        <div class="page-title">${headerLabel}</div>
        <div style="font-size:12px; font-weight:500; color:#8B9BAD; background:#1C2733; border:1px solid #2A3A4A; padding:5px 11px; border-radius:8px;">${headerTag}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        ${showRandomize ? `
          <button data-action="randomize" style="display:flex; align-items:center; gap:9px; border:none; background:#E8B800; color:#141B24; font-family:Inter,sans-serif; font-size:14px; font-weight:600; padding:12px 20px; border-radius:12px; cursor:pointer; transition:background 150ms ease, transform 80ms ease;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M8 21H3v-5"/><path d="M3 21l7-7"/><path d="M3 8V3h5"/><path d="M16 21h5v-5"/></svg>
            Randomize meals
          </button>
        ` : ''}
        <div style="display:flex; align-items:center; gap:4px; background:#1C2733; border:1px solid #2A3A4A; border-radius:11px; padding:4px;">
          <div class="chevron-btn" data-action="${isWeek ? 'prev-week' : 'prev-month'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </div>
          <div class="chevron-btn${atMax ? ' disabled' : ''}" data-action="${atMax ? '' : (isWeek ? 'next-week' : 'next-month')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
        <div class="segmented">
          <div class="segmented-pill${isWeek ? ' on' : ''}" data-action="set-view" data-view="week">Week</div>
          <div class="segmented-pill${isMonth ? ' on' : ''}" data-action="set-view" data-view="month">Month</div>
        </div>
      </div>
    </div>
  `;
}

function isDateLockedWk(k) {
  const lock = Data.getDayLock(k);
  return !!(lock && lock.locked);
}

function renderDayCard(k, d) {
  const st = statusOf(k);
  const meals = mealsForDate(k);
  const editable = st === 'future';
  const isToday = st === 'today';
  const todayLocked = isToday && isDateLockedWk(k);
  const con = consumedForDate(meals);
  const hasKcal = st === 'past' || st === 'today';
  const star = (st === 'past' || todayLocked) && con <= GOAL_KCAL_WK;

  const cardBg = isToday ? 'background:#2A3A4A; border:1px solid #34465A;' : 'background:#1C2733; border:1px solid #2A3A4A;';
  const numColor = isToday ? '#2ABFAD' : '#E8EDF2';

  const slotsHtml = SLOT_META_WK.map(([sk, label]) => {
    const log = meals[sk];
    const sm = summarizeEntries(log);
    const isLogged = (st === 'past' || st === 'today') && !!sm;
    const isPlanned = st === 'future' && !!sm;
    const isEmpty = !sm;
    const tappable = (editable && (isPlanned || isEmpty)) || (isToday && isEmpty && !todayLocked);

    let iconHtml, iconBg;
    if (isLogged) {
      iconHtml = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2ABFAD" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>`;
      iconBg = 'background:rgba(42,191,173,0.14);';
    } else if (isPlanned) {
      iconHtml = `<svg width="9" height="9" viewBox="0 0 24 24" fill="#6B7E91" stroke="none"><circle cx="12" cy="12" r="6"></circle></svg>`;
      iconBg = 'border:1px solid #3D5166;';
    } else {
      iconHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7E91" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`;
      iconBg = 'border:1px dashed #3A4C5E;';
    }

    let rowBorder;
    if (isLogged) rowBorder = 'border:1px solid transparent;';
    else if (isPlanned) rowBorder = 'border:1px dashed #3A4C5E;';
    else rowBorder = 'border:1px dashed #2A3A4A;';

    const nameColor = (isLogged || isPlanned) ? '#E8EDF2' : '#6B7E91';
    const name = sm ? sm.names.join(', ') : `Add ${label.toLowerCase()}`;

    const tapAttr = tappable ? `data-action="open-picker" data-key="${k}" data-slot="${sk}"` : '';
    const cursorStyle = tappable ? 'cursor:pointer;' : '';

    const actionsHtml = (editable && isPlanned) ? `
      <div class="wk-actions" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:1px; padding-left:14px; border-radius:6px; background:${isToday ? '#2A3A4A' : '#1C2733'}; box-shadow:-10px 0 10px 4px ${isToday ? '#2A3A4A' : '#1C2733'};">
        <div class="meal-icon" data-action="open-picker" data-key="${k}" data-slot="${sk}" style="width:26px; height:26px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
        </div>
        <div class="meal-icon" data-action="remove-planned" data-key="${k}" data-slot="${sk}" style="width:26px; height:26px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
        </div>
      </div>` : '';

    return `
      <div class="wk-meal" style="position:relative;">
        <div ${tapAttr} style="position:relative; display:flex; align-items:center; padding:7px 9px; border-radius:10px; transition:background 150ms ease, border-color 150ms ease; ${rowBorder} ${cursorStyle}">
          <div style="display:flex; align-items:center; gap:9px; flex:1; min-width:0;">
            <div style="width:22px; height:22px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; ${iconBg}">${iconHtml}</div>
            <div style="min-width:0; flex:1;">
              <div style="font-size:9px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#6B7E91; margin-bottom:1px;">${label}</div>
              <div style="font-size:12.5px; font-weight:500; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${nameColor};">${escapeHtmlWk(name)}</div>
            </div>
          </div>
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="border-radius:16px; padding:16px 15px; ${cardBg}">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px;">
        <div style="display:flex; align-items:baseline; gap:7px;">
          <span style="font-size:11px; font-weight:600; letter-spacing:0.07em; color:#8B9BAD;">${DOW[d.getDay()]}</span>
          <span style="font-size:18px; font-weight:600; letter-spacing:-0.01em; color:${numColor};">${d.getDate()}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; min-height:18px;">
          ${star ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="#E8B800" stroke="none"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"></path></svg>' : ''}
          ${isToday ? '<span style="font-size:10px; font-weight:600; letter-spacing:0.04em; color:#2ABFAD; background:rgba(42,191,173,0.13); padding:3px 7px; border-radius:6px;">TODAY</span>' : ''}
        </div>
      </div>
      ${hasKcal ? `<div style="font-size:11px; color:#8B9BAD; margin-top:-6px; margin-bottom:11px;">${fmtWk(con)} / ${fmtWk(GOAL_KCAL_WK)} kcal</div>` : ''}
      <div style="display:flex; flex-direction:column; gap:6px;">${slotsHtml}</div>
    </div>
  `;
}

function renderWeekGrid() {
  const mon = mondayOf(wkState.weekOffset);
  const cards = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(mon, i);
    return renderDayCard(dateKey(d), d);
  }).join('');
  return `<div class="wk-grid">${cards}</div>`;
}

function renderMonthGrid() {
  const today0 = startOfToday();
  const base = new Date(today0.getFullYear(), today0.getMonth() + wkState.monthOffset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  const startDow = (base.getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();

  const heads = WD_HEADS.map((h) => `<div style="font-size:11px; font-weight:600; letter-spacing:0.07em; color:#6B7E91; text-align:center; padding:2px 0;">${h}</div>`).join('');

  let cellsHtml = '';
  for (let i = 0; i < startDow; i++) cellsHtml += `<div style="min-height:82px;"></div>`;
  for (let dn = 1; dn <= dim; dn++) {
    const d = new Date(y, m, dn);
    const k = dateKey(d);
    const st = statusOf(k);
    const isToday = st === 'today';
    const todayLocked = isToday && isDateLockedWk(k);
    let star = false, kcalText = '', hasKcal = false;
    if (st === 'past' || st === 'today') {
      const meals = mealsForDate(k);
      const c = consumedForDate(meals);
      kcalText = `${fmtWk(c)} / ${fmtWk(GOAL_KCAL_WK)}`;
      hasKcal = true;
      star = (st === 'past' || todayLocked) && c <= GOAL_KCAL_WK && c > 0;
    }
    const cellBg = isToday ? 'background:#2A3A4A; border:1px solid #34465A;' : 'background:#1C2733; border:1px solid #2A3A4A;';
    const numColor = isToday ? '#2ABFAD' : (st === 'future' ? '#5C6B7A' : '#E8EDF2');
    cellsHtml += `
      <div style="border-radius:12px; padding:9px 10px; min-height:82px; display:flex; flex-direction:column; justify-content:space-between; ${cellBg}">
        <div style="display:flex; align-items:flex-start; justify-content:space-between;">
          <span style="font-size:14px; font-weight:600; color:${numColor};">${dn}</span>
          ${star ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B800" stroke="none"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"></path></svg>' : ''}
        </div>
        ${hasKcal ? `<div style="font-size:11px; color:#8B9BAD;">${kcalText}</div>` : ''}
      </div>
    `;
  }

  return `<div><div class="mo-grid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:10px;">${heads}</div><div class="mo-grid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:8px;">${cellsHtml}</div></div>`;
}

function renderModalWk() {
  if (!wkState.modalKey) return '';
  const s = wkState;
  const editMode = s.editMode;
  const slotLabel = capWk(s.modalSlot);
  const slotTitle = `${editMode ? 'Edit' : 'Plan'} ${slotLabel}`;
  const step1 = s.step === 1;
  const step2 = s.step === 2;
  const library = fullLibraryWk();
  const recentsIds = recentLibraryIdsWk(6).filter((id) => library.some((x) => x.id === id));
  const favouritesIds = library.filter((x) => x.favourite).map((x) => x.id);

  const counterBase = 'width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;';
  const makeRow = (it) => {
    const selected = !!s.selected[it.id];
    const counterStyle = selected
      ? counterBase + ' background:#2ABFAD; border:1px solid #2ABFAD;'
      : counterBase + ' background:transparent; border:1.5px solid #2ABFAD;';
    const icon = selected
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ABFAD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`;
    const recipeBadge = it.isRecipe
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2ABFAD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; flex-shrink:0;"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>`
      : '';
    return `
      <div data-action="toggle-item" data-id="${it.id}" style="display:flex; align-items:center; gap:14px; padding:12px 8px; margin:0 -6px; border-radius:8px; border-bottom:1px solid rgba(42,58,74,0.5); cursor:pointer; transition:background 150ms ease;" onmouseover="this.style.background='#233040'" onmouseout="this.style.background='transparent'">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; font-size:15px; font-weight:500; color:#E8EDF2;">${recipeBadge}${escapeHtmlWk(it.name)}</div>
          <div style="font-size:12px; color:#8B9BAD; margin-top:2px;">${escapeHtmlWk(tagNamesWk(it.tagIds).join(' · '))}</div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:14px; font-weight:500; color:#E8EDF2;">${wholePortionKcalWk(it)} kcal</div>
          <div style="font-size:12px; color:#8B9BAD;">${wholePortionProteinWk(it)}g protein</div>
        </div>
        <div style="${counterStyle}">${icon}</div>
      </div>
    `;
  };

  const q = s.search.trim().toLowerCase();
  const matches = (it) => (!q || it.name.toLowerCase().includes(q)) && (s.activeTags.length === 0 || it.tagIds.some((tg) => s.activeTags.includes(tg)));
  const showSections = !q && s.activeTags.length === 0;
  const filtered = library.filter(matches);
  const noResults = !showSections && filtered.length === 0;
  const hasResults = !showSections && filtered.length > 0;

  let listHtml = '';
  if (showSections) {
    const recentsHtml = recentsIds.length
      ? `<div class="section-label" style="margin:4px 0 6px;">Recents</div>${recentsIds.map((id) => makeRow(itemByIdWk(id))).join('')}`
      : '';
    const favouritesHtml = favouritesIds.length
      ? `<div class="section-label" style="margin:18px 0 6px;">Favourites</div>${favouritesIds.map((id) => makeRow(itemByIdWk(id))).join('')}`
      : '';
    listHtml = `
      ${recentsHtml}
      ${favouritesHtml}
      <div class="section-label" style="margin:18px 0 6px;">All items</div>
      ${library.map(makeRow).join('')}
    `;
  } else if (hasResults) {
    listHtml = filtered.map(makeRow).join('');
  } else if (noResults) {
    listHtml = `
      <div style="padding:40px 8px; text-align:center;">
        <div style="font-size:15px; color:#8B9BAD; margin-bottom:10px;">Nothing found. Add it to your library instead.</div>
        <div style="display:inline-flex; align-items:center; gap:6px; color:#E8B800; font-size:14px; font-weight:500; cursor:pointer;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
          Add new item
        </div>
      </div>
    `;
  }

  const showZone = editMode && s.originalIds.length > 0;
  const zoneHtml = showZone
    ? `
      <div style="margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid #2A3A4A;">
        <div class="section-label" style="margin:0 0 8px;">Currently planned</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${s.originalIds.map((id) => {
            const it = itemByIdWk(id);
            const sel = s.selected[id] || { portion: 'whole', customG: '' };
            const grams = Math.round(gramsForSelectionWk(it, sel) || it.wholeG || 100);
            const removing = s.removingIds.includes(id);
            const chipStyle = removing
              ? 'opacity:0; transform:scale(0.9); transition:opacity 150ms ease, transform 150ms ease;'
              : 'opacity:1; transform:scale(1); transition:opacity 150ms ease, transform 150ms ease;';
            return `
              <div class="cur-item-chip" style="${chipStyle}">
                <span>${escapeHtmlWk(it.name)}</span>
                <span class="cur-item-chip-g">${grams}g</span>
                <span class="prow-x" data-action="remove-original" data-id="${id}" title="Remove item" style="width:18px; height:18px; border-radius:5px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8B9BAD; flex-shrink:0;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `
    : '';

  const tagsHtml = Data.getTags().map((t) => {
    const active = s.activeTags.includes(t.id);
    return `<div class="chip${active ? ' active' : ''}" data-action="toggle-tag" data-tag="${t.id}">${escapeHtmlWk(t.name)}</div>`;
  }).join('');

  const step1Html = `
    <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <span class="modal-title">${slotTitle}</span>
        <span style="font-size:13px; color:#8B9BAD;">1 / 2</span>
      </div>
      ${zoneHtml}
      <div style="position:relative; margin-bottom:16px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; left:15px; top:50%; transform:translateY(-50%);"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>
        <input id="search-input-wk" class="input" value="${escapeHtmlWk(s.search)}" placeholder="Search meals and ingredients…" style="width:100%; padding:13px 16px 13px 44px;" />
      </div>
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; margin-bottom:18px;">
        ${tagsHtml}
      </div>
      <div class="wk-scroll-body" style="flex:1; min-height:0; overflow-y:auto; margin:0 -6px; padding:0 16px 0 6px;">
        ${listHtml}
      </div>
    </div>
  `;

  const presetBase = 'flex:1; text-align:center; padding:9px 0; border-radius:9px; font-size:13px; font-weight:500; cursor:pointer;';
  const presetOn = presetBase + ' border:1px solid #2ABFAD; color:#2ABFAD; background:rgba(42,191,173,0.10);';
  const presetOff = presetBase + ' border:1px solid #34465A; color:#8B9BAD; background:transparent;';
  const portionRowsHtml = s.order.map((id) => {
    const it = itemByIdWk(id);
    const sel = s.selected[id];
    return `
      <div style="background:#2A3A4A; border:1px solid #34465A; border-radius:14px; padding:16px 18px;">
        <div style="font-size:15px; font-weight:500; color:#E8EDF2; margin-bottom:14px;">${escapeHtmlWk(it.name)}</div>
        <div style="display:flex; gap:8px;">
          <div data-action="set-portion" data-id="${id}" data-portion="whole" style="${sel.portion === 'whole' ? presetOn : presetOff}">Whole</div>
          <div data-action="set-portion" data-id="${id}" data-portion="half" style="${sel.portion === 'half' ? presetOn : presetOff}">Half</div>
          <div data-action="set-portion" data-id="${id}" data-portion="custom" style="${sel.portion === 'custom' ? presetOn : presetOff}">Custom</div>
        </div>
        ${sel.portion === 'custom' ? `
          <div style="margin-top:12px; display:flex; align-items:center; gap:8px;">
            <input class="custom-g-input-wk input-card" data-id="${id}" value="${escapeHtmlWk(sel.customG)}" placeholder="0" style="width:90px; padding:9px 12px; text-align:right;" />
            <span style="font-size:14px; color:#8B9BAD;">grams</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const step2Html = `
    <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div data-action="back-step" class="icon-btn" style="width:32px; height:32px; border-radius:9px; border:1px solid #34465A;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
          </div>
          <span class="modal-title">Confirm portions</span>
        </div>
        <span style="font-size:13px; color:#8B9BAD;">2 / 2</span>
      </div>
      <div class="wk-scroll-body" style="flex:1; min-height:0; overflow-y:auto; margin:0 -6px; padding:0 6px; display:flex; flex-direction:column; gap:12px;">
        ${portionRowsHtml}
      </div>
    </div>
  `;

  let totalK = 0, totalP = 0, allConfirmed = s.order.length > 0;
  const addedItemsHtml = s.order.map((id) => {
    const it = itemByIdWk(id);
    const c = calcWk(it, s.selected[id]);
    if (c) { totalK += c.kcal; totalP += c.protein; } else { allConfirmed = false; }
    const kcalStyle = c ? 'font-size:14px; font-weight:500; color:#E8EDF2;' : 'font-size:14px; font-weight:500; color:#5C6B7A;';
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:11px 0;">
        <span style="font-size:14px; color:#E8EDF2; flex:1; min-width:0;">${escapeHtmlWk(it.name)}</span>
        <div style="text-align:right; flex-shrink:0;">
          <div style="${kcalStyle}">${c ? `${fmtWk(c.kcal)} kcal` : ''}</div>
          <div style="font-size:12px; color:#8B9BAD; margin-top:2px;">${c ? `${c.protein}g protein` : ''}</div>
        </div>
      </div>
    `;
  }).join('');
  const sidebarEmpty = s.order.length === 0;

  let ctaLabel, ctaEnabledFlag;
  if (s.step === 1) {
    if (editMode && s.order.length === 0) {
      ctaLabel = 'Save changes';
      ctaEnabledFlag = true;
    } else {
      ctaLabel = 'Continue';
      ctaEnabledFlag = s.order.length > 0;
    }
  } else {
    ctaLabel = editMode ? 'Save changes' : 'Save to plan';
    ctaEnabledFlag = allConfirmed;
  }
  const ctaAction = s.step === 1
    ? (editMode && s.order.length === 0 ? 'save-plan' : 'goto-step2')
    : 'save-plan';

  return `
    <div class="modal-overlay no-transitions">
      <div style="width:100%; max-width:1000px; height:660px; max-height:88vh; background:#1C2733; border:1px solid #2A3A4A; border-radius:24px; display:flex; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,0.55); font-family:Inter,sans-serif;">
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; padding:28px 30px;">
          ${step1 ? step1Html : ''}
          ${step2 ? step2Html : ''}
        </div>
        <div style="width:320px; flex-shrink:0; border-left:1px solid #2A3A4A; background:#1A242F; display:flex; flex-direction:column; padding:28px 26px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
            <span class="section-label">Added</span>
            <div data-action="close-modal" class="icon-btn" style="width:30px; height:30px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </div>
          </div>
          <div class="wk-scroll-body" style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column;">
            ${sidebarEmpty ? `
              <div style="flex:1; display:flex; align-items:center; justify-content:center; text-align:center; padding:0 10px;">
                <span style="font-size:13px; color:#5C6B7A; line-height:1.5;">Pick items on the left to build this meal.</span>
              </div>
            ` : addedItemsHtml}
          </div>
          <div style="border-top:1px solid #2A3A4A; margin-top:6px; padding-top:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px;">
              <span style="font-size:14px; color:#8B9BAD;">Total</span>
              <div style="text-align:right;">
                <div style="font-size:22px; font-weight:600; color:#E8EDF2; letter-spacing:-0.02em;">${fmtWk(totalK)} kcal</div>
                <div style="font-size:13px; color:#8B9BAD; margin-top:2px;">${totalP}g protein</div>
              </div>
            </div>
            <button class="btn-primary" data-action="${ctaAction}" ${ctaEnabledFlag ? '' : 'disabled'}>${ctaLabel}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderWeek() {
  const app = document.getElementById('app');
  const focusInfo = captureFocusWk();
  const scrollInfo = captureScrollWk();

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-content">
        ${renderNavWk()}
        ${renderHeaderWk()}
        ${wkState.view === 'week' ? renderWeekGrid() : renderMonthGrid()}
      </div>
      ${renderModalWk()}
    </div>
  `;

  restoreScrollWk(scrollInfo);
  restoreFocusWk(focusInfo);
  clearNoTransitionsWk();

  if (pendingFocusWk) {
    const el = document.querySelector(pendingFocusWk.selector);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    pendingFocusWk = null;
  }
}

// Modal templates render with a `no-transitions` class baked in so every full
// re-render (triggered on every keystroke) recreates focused inputs without
// replaying their focus-color transition as a flicker; this lifts it after
// one paint so real transitions (hover, etc.) resume working normally.
function clearNoTransitionsWk() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.no-transitions').forEach((el) => el.classList.remove('no-transitions'));
  }));
}

// Full-page re-renders on every keystroke destroy and recreate the scrollable
// containers below, so their scrollTop resets to 0 unless captured here first —
// without this, typing while scrolled down in the modal visibly jerks back to the top.
function captureScrollWk() {
  return Array.from(document.querySelectorAll('.wk-scroll-body')).map((el) => el.scrollTop);
}
function restoreScrollWk(tops) {
  const els = document.querySelectorAll('.wk-scroll-body');
  els.forEach((el, i) => { if (tops[i] != null) el.scrollTop = tops[i]; });
}

let pendingFocusWk = null;

function captureFocusWk() {
  const el = document.activeElement;
  if (!el || (el.id !== 'search-input-wk' && !el.classList.contains('custom-g-input-wk'))) return null;
  return { id: el.id, cls: el.classList.contains('custom-g-input-wk'), dataId: el.dataset.id, selStart: el.selectionStart, selEnd: el.selectionEnd };
}
function restoreFocusWk(info) {
  if (!info) return;
  let el = null;
  if (info.id === 'search-input-wk') el = document.getElementById('search-input-wk');
  else if (info.cls) el = document.querySelector(`.custom-g-input-wk[data-id="${info.dataId}"]`);
  if (el) {
    el.focus();
    try { el.setSelectionRange(info.selStart, info.selEnd); } catch (e) {}
  }
}

/* ============ Event delegation ============ */

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target || !target.dataset.action) return;
  const action = target.dataset.action;
  const key = target.dataset.key;
  const slot = target.dataset.slot;
  const id = target.dataset.id;

  switch (action) {
    case 'prev-week': prevWeek(); break;
    case 'next-week': nextWeek(); break;
    case 'prev-month': prevMonth(); break;
    case 'next-month': nextMonth(); break;
    case 'set-view': setView(target.dataset.view); break;
    case 'randomize': randomize(); break;
    case 'open-picker': if (!isDateLockedWk(key)) openPicker(key, slot); break;
    case 'remove-planned': removePlanned(key, slot); break;
    case 'close-modal': closeModalWk(); break;
    case 'toggle-item': toggleItemWk(id); break;
    case 'toggle-tag': toggleTagWk(target.dataset.tag); break;
    case 'set-portion': setPortionWk(id, target.dataset.portion); break;
    case 'remove-original': removeOriginalWk(id); break;
    case 'back-step': gotoStep1Wk(); break;
    case 'goto-step2': gotoStep2Wk(); break;
    case 'save-plan': if (!target.disabled) savePlan(); break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search-input-wk') {
    wkState.search = e.target.value;
    renderWeek();
  } else if (e.target.classList.contains('custom-g-input-wk')) {
    setCustomGWk(e.target.dataset.id, e.target.value);
  }
});

renderWeek();
Data.ready().then(() => {
  GOAL_KCAL_WK = Data.getGoals().calorieTarget;
  renderWeek();
});
