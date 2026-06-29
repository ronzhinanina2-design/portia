/* ============ Portia — Today tab ============ */

const TODAY_DATE = new Date().toISOString().slice(0, 10);
const GOAL_KCAL = Data.getGoals().calorieTarget;
const GOAL_PROTEIN = Data.getGoals().proteinTarget;
const SLOT_META = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['snack', 'Snack'],
  ['dinner', 'Dinner'],
];
const ALL_TAGS = ['High protein', 'Vegetarian', 'Grains', 'Fruit', 'Dairy', 'Snack', 'Healthy fats', 'Meat', 'Fish'];

function fmt(n) {
  return n.toLocaleString('en-US');
}
function cap(w) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}

const state = {
  modalSlot: null,
  editMode: false,
  originalIds: [],
  removingIds: [],
  step: 1,
  search: '',
  activeTags: [],
  selected: {},
  order: [],
  showUndo: false,
};

let undoTimeoutId = null;

function isDayLocked() {
  const lock = Data.getDayLock(TODAY_DATE);
  return !!(lock && lock.locked);
}

function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  Object.assign(state, next);
  render();
}

function recipeTotals(r) {
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

// Resolves an id against both items and recipes, returning a normalized
// shape with per-100g kcal/protein + wholeG so existing portion math
// (calc/wholePortionKcal/etc) works unmodified for either source.
function libItemById(id) {
  const it = Data.getItemById(id);
  if (it) return { id: it.id, name: it.name, tags: it.tags, kcal: it.kcal, protein: it.protein, wholeG: it.wholeG || 100, isRecipe: false, favourite: !!it.favourite };
  const r = Data.getRecipeById(id);
  if (!r) return null;
  const t = recipeTotals(r);
  return { id: r.id, name: r.name, tags: r.tags, kcal: (t.kcal / t.grams) * 100, protein: (t.protein / t.grams) * 100, wholeG: t.grams, isRecipe: true, broken: t.broken, favourite: !!r.favourite };
}

function fullLibrary() {
  const items = Data.getItems().map((i) => libItemById(i.id));
  const recipes = Data.getRecipes().map((r) => libItemById(r.id)).filter((r) => r && !r.broken);
  return [...items, ...recipes];
}

function recentLibraryIds(limit) {
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

function isConfirmed(sel) {
  if (!sel || !sel.portion) return false;
  if (sel.portion === 'custom') return Number(sel.customG) > 0;
  return true;
}

function gramsForSelection(it, sel) {
  const wholeG = it.wholeG || 100;
  if (sel.portion === 'whole') return wholeG;
  if (sel.portion === 'half') return wholeG / 2;
  return Number(sel.customG);
}

function calc(it, sel) {
  if (!isConfirmed(sel)) return null;
  const grams = gramsForSelection(it, sel);
  return { kcal: Math.round((it.kcal * grams) / 100), protein: Math.round((it.protein * grams) / 100) };
}

function summarizeSlot(slot) {
  const log = Data.getLogForSlot(TODAY_DATE, slot);
  if (!log) return null;
  let kcal = 0, protein = 0;
  const names = [];
  for (const entry of log.entries) {
    const lib = libItemById(entry.itemId);
    if (!lib) continue;
    kcal += entry.kcal;
    protein += entry.protein;
    names.push(lib.name);
  }
  return { names, kcal, protein };
}

function wholePortionKcal(it) {
  return Math.round((it.kcal * (it.wholeG || 100)) / 100);
}
function wholePortionProtein(it) {
  return Math.round((it.protein * (it.wholeG || 100)) / 100);
}

function openModal(slot) {
  const log = Data.getLogForSlot(TODAY_DATE, slot);
  if (log) {
    const selected = {};
    const order = [];
    for (const entry of log.entries) {
      const lib = libItemById(entry.itemId);
      const wholeG = lib ? lib.wholeG || 100 : 100;
      const portion = entry.portion || (entry.grams === wholeG ? 'whole' : entry.grams === wholeG / 2 ? 'half' : 'custom');
      selected[entry.itemId] = { portion, customG: portion === 'custom' ? String(entry.grams) : '' };
      order.push(entry.itemId);
    }
    setState({ modalSlot: slot, editMode: true, originalIds: [...order], removingIds: [], step: 1, search: '', activeTags: [], selected, order });
  } else {
    setState({ modalSlot: slot, editMode: false, originalIds: [], removingIds: [], step: 1, search: '', activeTags: [], selected: {}, order: [] });
  }
}

function closeModal() {
  setState({ modalSlot: null });
}

function toggleItem(id) {
  setState((s) => {
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

function removeOriginal(id) {
  setState((s) => ({ removingIds: [...s.removingIds, id] }));
  setTimeout(() => {
    setState((s) => {
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

function toggleTag(t) {
  setState((s) => ({ activeTags: s.activeTags.includes(t) ? s.activeTags.filter((x) => x !== t) : [...s.activeTags, t] }));
}

function setPortion(id, p) {
  setState((s) => ({ selected: { ...s.selected, [id]: { ...s.selected[id], portion: p } } }));
}

function setCustomG(id, v) {
  const clean = String(v).replace(/[^0-9]/g, '');
  setState((s) => ({ selected: { ...s.selected, [id]: { ...s.selected[id], portion: 'custom', customG: clean } } }));
}

function gotoStep2() {
  setState({ step: 2 });
}
function gotoStep1() {
  setState({ step: 1 });
}

function deleteMeal(slot) {
  Data.clearLogForSlot(TODAY_DATE, slot);
  render();
}

function saveMeal() {
  const s = state;
  if (s.order.length === 0) {
    Data.clearLogForSlot(TODAY_DATE, s.modalSlot);
  } else {
    const entries = s.order.map((id) => {
      const lib = libItemById(id);
      const sel = s.selected[id];
      const c = calc(lib, sel) || { kcal: wholePortionKcal(lib), protein: wholePortionProtein(lib) };
      const grams = gramsForSelection(lib, sel);
      return { itemId: id, portion: sel.portion, grams, kcal: c.kcal, protein: c.protein };
    });
    Data.setLogForSlot(TODAY_DATE, s.modalSlot, entries);
  }
  setState({ modalSlot: null });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============ Done for today ============ */

function spawnStars(rect) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const count = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.textContent = '★';
    star.style.position = 'fixed';
    star.style.left = `${cx}px`;
    star.style.top = `${cy}px`;
    star.style.color = '#E8B800';
    star.style.fontSize = '15px';
    star.style.pointerEvents = 'none';
    star.style.zIndex = '9999';
    star.style.transform = 'translate(-50%, -50%)';
    star.style.transition = 'transform 600ms ease-out, opacity 600ms ease-out';
    document.body.appendChild(star);
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.6 - 0.3);
    const dist = 46 + Math.random() * 34;
    requestAnimationFrame(() => {
      star.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.4)`;
      star.style.opacity = '0';
    });
    setTimeout(() => star.remove(), 650);
  }
}

function spawnRipple(rect) {
  const ripple = document.createElement('div');
  ripple.style.position = 'fixed';
  ripple.style.left = `${rect.left}px`;
  ripple.style.top = `${rect.top}px`;
  ripple.style.width = `${rect.width}px`;
  ripple.style.height = `${rect.height}px`;
  ripple.style.borderRadius = '13px';
  ripple.style.boxShadow = '0 0 0 0 rgba(232,184,0,0.45)';
  ripple.style.pointerEvents = 'none';
  ripple.style.zIndex = '9999';
  ripple.style.transition = 'box-shadow 500ms ease-out, opacity 500ms ease-out';
  document.body.appendChild(ripple);
  requestAnimationFrame(() => {
    ripple.style.boxShadow = '0 0 0 16px rgba(232,184,0,0)';
    ripple.style.opacity = '0';
  });
  setTimeout(() => ripple.remove(), 520);
}

function scheduleUndoTimeout() {
  clearTimeout(undoTimeoutId);
  undoTimeoutId = setTimeout(() => {
    setState({ showUndo: false });
  }, 10000);
}

function pressDoneForToday(rect) {
  if (isDayLocked()) return;
  let consumedKcal = 0;
  SLOT_META.forEach(([key]) => {
    const sm = summarizeSlot(key);
    if (sm) consumedKcal += sm.kcal;
  });
  const overLimit = consumedKcal > GOAL_KCAL;
  Data.setDayLock(TODAY_DATE, { locked: true, overLimit, lockedAt: Date.now() });
  setState({ showUndo: true });
  if (overLimit) spawnRipple(rect); else spawnStars(rect);
  scheduleUndoTimeout();
}

function undoDoneForToday() {
  clearTimeout(undoTimeoutId);
  Data.clearDayLock(TODAY_DATE);
  setState({ showUndo: false });
}

/* ============ Rendering ============ */

function renderNav() {
  return `
    <div class="nav-row">
      <div class="nav-left">
        <div class="logo">portia</div>
        <div class="nav-pills">
          <a class="nav-tab active" href="today.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/></svg>
            Today
          </a>
          <a class="nav-tab" href="week.html">
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
      <div class="streak-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#E8B800" stroke="none"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"/></svg>
        <span class="streak-number">${Data.getStreak().currentStreak}</span>
        <span class="streak-label">day streak</span>
      </div>
    </div>
  `;
}

function renderGreeting() {
  const d = new Date();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const dateText = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const lock = Data.getDayLock(TODAY_DATE);
  const locked = lock && lock.locked;
  let label = 'Done for today';
  if (locked) label = lock.overLimit ? 'Keep going' : 'Well done!';
  const btnAttrs = locked ? '' : 'data-action="done-today"';
  const undoHtml = locked && state.showUndo
    ? `<div data-action="undo-done" style="font-size:13px; color:#8B9BAD; cursor:pointer; margin-top:8px; text-align:right;">Changed your mind?</div>`
    : '';

  return `
    <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px;">
      <div>
        <div style="font-size:26px; font-weight:500; color:#E8EDF2; letter-spacing:-0.01em;">Good afternoon</div>
        <div style="font-size:15px; color:#8B9BAD; margin-top:4px;">${dayName} · ${dateText}</div>
      </div>
      <div>
        <button id="done-today-btn" class="btn-primary" style="width:auto; padding:14px 26px; ${locked ? 'cursor:default;' : ''}" ${btnAttrs}>${label}</button>
        ${undoHtml}
      </div>
    </div>
  `;
}

function renderHero() {
  let consumedKcal = 0, consumedProtein = 0;
  SLOT_META.forEach(([key]) => {
    const sm = summarizeSlot(key);
    if (sm) { consumedKcal += sm.kcal; consumedProtein += sm.protein; }
  });
  const leftKcal = Math.max(0, GOAL_KCAL - consumedKcal);
  const circ = 439.8;
  const ringOff = Math.max(0, circ * (1 - Math.min(1, consumedKcal / GOAL_KCAL)));
  const proteinPct = Math.round((consumedProtein / GOAL_PROTEIN) * 100);
  const proteinBarW = Math.min(100, proteinPct);

  return `
    <div style="background:#1C2733; border:1px solid #2A3A4A; border-radius:20px; padding:34px 32px 30px; display:flex; flex-direction:column; align-items:center;">
      <div class="section-label" style="align-self:flex-start; margin-bottom:14px;">Calories</div>
      <div style="position:relative; width:248px; height:248px;">
        <svg width="248" height="248" viewBox="0 0 160 160" style="transform:rotate(-90deg);">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#2A3A4A" stroke-width="11"></circle>
          <circle cx="80" cy="80" r="70" fill="none" stroke="#2ABFAD" stroke-width="11" stroke-linecap="round"
            style="stroke-dasharray:439.8; stroke-dashoffset:${ringOff.toFixed(1)}; transition:stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1);"></circle>
        </svg>
        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div style="font-size:66px; font-weight:600; line-height:0.95; color:#E8EDF2; letter-spacing:-0.03em;">${fmt(consumedKcal)}</div>
          <div style="font-size:16px; color:#8B9BAD; margin-top:6px;">/ ${fmt(GOAL_KCAL)} kcal</div>
        </div>
      </div>
      <div style="margin-top:22px; font-size:15px; color:#8B9BAD;"><span style="color:#E8EDF2; font-weight:500;">${fmt(leftKcal)} kcal</span> left today</div>
    </div>

    <div style="background:#1C2733; border:1px solid #2A3A4A; border-radius:20px; padding:26px 28px;">
      <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px;">
        <span class="section-label">Protein</span>
        <span style="font-size:14px; color:#8B9BAD;">${proteinPct}%</span>
      </div>
      <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:16px;">
        <span style="font-size:48px; font-weight:600; line-height:0.9; color:#E8EDF2; letter-spacing:-0.03em;">${consumedProtein}</span>
        <span style="font-size:22px; font-weight:500; color:#E8EDF2;">g</span>
        <span style="font-size:16px; color:#8B9BAD; margin-left:4px;">/ ${GOAL_PROTEIN}g</span>
      </div>
      <div style="height:8px; background:#2A3A4A; border-radius:5px; overflow:hidden;">
        <div style="height:100%; width:${proteinBarW}%; background:#2ABFAD; border-radius:5px; transition:width 1.2s cubic-bezier(0.22,1,0.36,1);"></div>
      </div>
    </div>
  `;
}

function renderMeals() {
  const locked = isDayLocked();
  let loggedCount = 0;
  const slotsHtml = SLOT_META.map(([key, label]) => {
    const sm = summarizeSlot(key);
    if (sm) {
      loggedCount++;
      const actionsHtml = locked ? '' : `
              <div class="meal-actions" style="position:absolute; right:0; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:2px; transition:opacity 0.15s ease;">
                <div class="meal-icon" data-action="edit-slot" data-slot="${key}" title="Edit meal" style="width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
                </div>
                <div class="meal-icon" data-action="delete-slot" data-slot="${key}" title="Remove meal" style="width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
                </div>
              </div>`;
      return `
        <div style="margin-bottom:12px;">
          <div class="${locked ? '' : 'meal-card'}" style="background:#1C2733; border:1px solid #2A3A4A; border-radius:16px; padding:18px 20px; display:flex; align-items:center; gap:16px;">
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(42,191,173,0.14); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ABFAD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div class="section-label" style="margin-bottom:3px;">${label}</div>
              <div style="font-size:16px; font-weight:500; color:#E8EDF2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(sm.names.join(', '))}</div>
            </div>
            <div style="position:relative; flex-shrink:0; min-width:120px; display:flex; justify-content:flex-end; align-items:center; min-height:42px;">
              <div class="meal-stats" style="text-align:right; transition:opacity 0.15s ease;">
                <div style="font-size:22px; font-weight:600; color:#E8EDF2; letter-spacing:-0.02em;">${fmt(sm.kcal)}</div>
                <div style="font-size:12px; color:#8B9BAD;">kcal · ${sm.protein}g protein</div>
              </div>${actionsHtml}
            </div>
          </div>
        </div>
      `;
    }
    if (locked) {
      return `
        <div style="margin-bottom:12px;">
          <div style="background:#1C2733; border:1.5px dashed #2A3A4A; border-radius:16px; padding:18px 20px; display:flex; align-items:center; gap:16px;">
            <div style="width:36px; height:36px; border-radius:10px; border:1.5px dashed #2A3A4A; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
            </div>
            <div style="flex:1;">
              <div class="section-label" style="margin-bottom:3px;">${label}</div>
              <div style="font-size:16px; font-weight:500; color:#8B9BAD;">Log ${label.toLowerCase()}</div>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <div style="margin-bottom:12px;">
        <div data-action="open-modal" data-slot="${key}" style="background:#1C2733; border:1.5px dashed #2A3A4A; border-radius:16px; padding:18px 20px; display:flex; align-items:center; gap:16px; cursor:pointer; transition:border-color 150ms ease;" onmouseover="this.style.borderColor='#2ABFAD'" onmouseout="this.style.borderColor='#2A3A4A'">
          <div style="width:36px; height:36px; border-radius:10px; border:1.5px dashed #2A3A4A; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
          </div>
          <div style="flex:1;">
            <div class="section-label" style="margin-bottom:3px;">${label}</div>
            <div style="font-size:16px; font-weight:500; color:#8B9BAD;">Log ${label.toLowerCase()}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const addMealHtml = locked ? '' : `
    <div data-action="add-meal" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; color:#E8B800; font-size:14px; font-weight:500; cursor:pointer; transition:color 150ms ease;" onmouseover="this.style.color='#C9A000'" onmouseout="this.style.color='#E8B800'">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
      Add meal
    </div>`;

  return `
    <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:14px;">
      <span style="font-size:16px; font-weight:600; color:#E8EDF2;">Meals</span>
      <span style="font-size:13px; color:#8B9BAD;">${loggedCount} logged</span>
    </div>
    ${slotsHtml}
    ${addMealHtml}
  `;
}

function renderModal() {
  if (!state.modalSlot) return '';
  const s = state;
  const editMode = s.editMode;
  const slotTitle = editMode ? `Edit ${cap(s.modalSlot)}` : `Log ${cap(s.modalSlot)}`;
  const step1 = s.step === 1;
  const step2 = s.step === 2;
  const library = fullLibrary();
  const recentsIds = recentLibraryIds(6).filter((id) => library.some((x) => x.id === id));
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
          <div style="display:flex; align-items:center; font-size:15px; font-weight:500; color:#E8EDF2;">${recipeBadge}${escapeHtml(it.name)}</div>
          <div style="font-size:12px; color:#8B9BAD; margin-top:2px;">${escapeHtml(it.tags.join(' · '))}</div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:14px; font-weight:500; color:#E8EDF2;">${wholePortionKcal(it)} kcal</div>
          <div style="font-size:12px; color:#8B9BAD;">${wholePortionProtein(it)}g protein</div>
        </div>
        <div style="${counterStyle}">${icon}</div>
      </div>
    `;
  };

  const q = s.search.trim().toLowerCase();
  const matches = (it) => (!q || it.name.toLowerCase().includes(q)) && (s.activeTags.length === 0 || it.tags.some((tg) => s.activeTags.includes(tg)));
  const showSections = !q && s.activeTags.length === 0;
  const filtered = library.filter(matches);
  const noResults = !showSections && filtered.length === 0;
  const hasResults = !showSections && filtered.length > 0;

  let listHtml = '';
  if (showSections) {
    const recentsHtml = recentsIds.length
      ? `<div class="section-label" style="margin:4px 0 6px;">Recents</div>${recentsIds.map((id) => makeRow(libItemById(id))).join('')}`
      : '';
    const favouritesHtml = favouritesIds.length
      ? `<div class="section-label" style="margin:18px 0 6px;">Favourites</div>${favouritesIds.map((id) => makeRow(libItemById(id))).join('')}`
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
        <div class="section-label" style="margin:0 0 8px;">Currently logged</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${s.originalIds.map((id) => {
            const it = libItemById(id);
            const sel = s.selected[id] || { portion: 'whole', customG: '' };
            const grams = Math.round(gramsForSelection(it, sel) || it.wholeG || 100);
            const removing = s.removingIds.includes(id);
            const chipStyle = removing
              ? 'opacity:0; transform:scale(0.9); transition:opacity 150ms ease, transform 150ms ease;'
              : 'opacity:1; transform:scale(1); transition:opacity 150ms ease, transform 150ms ease;';
            return `
              <div class="cur-item-chip" style="${chipStyle}">
                <span>${escapeHtml(it.name)}</span>
                <span class="cur-item-chip-g">${grams}g</span>
                <span class="row-x" data-action="remove-original" data-id="${id}" title="Remove item" style="width:18px; height:18px; border-radius:5px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8B9BAD; flex-shrink:0;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `
    : '';

  const tagsHtml = ALL_TAGS.map((t) => {
    const active = s.activeTags.includes(t);
    return `<div class="chip${active ? ' active' : ''}" data-action="toggle-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</div>`;
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
        <input id="search-input" class="input" value="${escapeHtml(s.search)}" placeholder="Search meals and ingredients…" style="width:100%; padding:13px 16px 13px 44px;" />
      </div>
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; margin-bottom:18px;">
        ${tagsHtml}
      </div>
      <div style="flex:1; min-height:0; overflow-y:auto; margin:0 -6px; padding:0 16px 0 6px;">
        ${listHtml}
      </div>
    </div>
  `;

  const presetBase = 'flex:1; text-align:center; padding:9px 0; border-radius:9px; font-size:13px; font-weight:500; cursor:pointer;';
  const presetOn = presetBase + ' border:1px solid #2ABFAD; color:#2ABFAD; background:rgba(42,191,173,0.10);';
  const presetOff = presetBase + ' border:1px solid #34465A; color:#8B9BAD; background:transparent;';
  const portionRowsHtml = s.order.map((id) => {
    const it = libItemById(id);
    const sel = s.selected[id];
    return `
      <div style="background:#2A3A4A; border:1px solid #34465A; border-radius:14px; padding:16px 18px;">
        <div style="font-size:15px; font-weight:500; color:#E8EDF2; margin-bottom:14px;">${escapeHtml(it.name)}</div>
        <div style="display:flex; gap:8px;">
          <div data-action="set-portion" data-id="${id}" data-portion="whole" style="${sel.portion === 'whole' ? presetOn : presetOff}">Whole</div>
          <div data-action="set-portion" data-id="${id}" data-portion="half" style="${sel.portion === 'half' ? presetOn : presetOff}">Half</div>
          <div data-action="set-portion" data-id="${id}" data-portion="custom" style="${sel.portion === 'custom' ? presetOn : presetOff}">Custom</div>
        </div>
        ${sel.portion === 'custom' ? `
          <div style="margin-top:12px; display:flex; align-items:center; gap:8px;">
            <input class="custom-g-input input-card" data-id="${id}" value="${escapeHtml(sel.customG)}" placeholder="0" style="width:90px; padding:9px 12px; text-align:right;" />
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
      <div style="flex:1; min-height:0; overflow-y:auto; margin:0 -6px; padding:0 6px; display:flex; flex-direction:column; gap:12px;">
        ${portionRowsHtml}
      </div>
    </div>
  `;

  // sidebar
  let totalK = 0, totalP = 0, allConfirmed = s.order.length > 0;
  const addedItemsHtml = s.order.map((id) => {
    const it = libItemById(id);
    const c = calc(it, s.selected[id]);
    if (c) { totalK += c.kcal; totalP += c.protein; } else { allConfirmed = false; }
    const kcalStyle = c ? 'font-size:14px; font-weight:500; color:#E8EDF2;' : 'font-size:14px; font-weight:500; color:#5C6B7A;';
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:11px 0;">
        <span style="font-size:14px; color:#E8EDF2; flex:1; min-width:0;">${escapeHtml(it.name)}</span>
        <div style="text-align:right; flex-shrink:0;">
          <div style="${kcalStyle}">${c ? `${fmt(c.kcal)} kcal` : ''}</div>
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
    ctaLabel = editMode ? 'Save changes' : 'Log meal';
    ctaEnabledFlag = allConfirmed;
  }
  const ctaAction = s.step === 1
    ? (editMode && s.order.length === 0 ? 'save-meal' : 'goto-step2')
    : 'save-meal';

  return `
    <div class="modal-overlay">
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
          <div style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column;">
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
                <div style="font-size:22px; font-weight:600; color:#E8EDF2; letter-spacing:-0.02em;">${fmt(totalK)} kcal</div>
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

function render() {
  const app = document.getElementById('app');
  const focusInfo = captureFocus();

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-content">
        ${renderNav()}
        ${renderGreeting()}
        <div style="display:grid; grid-template-columns:478px 1fr; gap:22px;">
          <div style="display:flex; flex-direction:column; gap:22px;">
            ${renderHero()}
          </div>
          <div style="display:flex; flex-direction:column;">
            ${renderMeals()}
          </div>
        </div>
      </div>
      ${renderModal()}
    </div>
  `;

  restoreFocus(focusInfo);
}

function captureFocus() {
  const el = document.activeElement;
  if (!el || (el.id !== 'search-input' && !el.classList.contains('custom-g-input'))) return null;
  return { id: el.id, cls: el.classList.contains('custom-g-input'), dataId: el.dataset.id, selStart: el.selectionStart, selEnd: el.selectionEnd };
}

function restoreFocus(info) {
  if (!info) return;
  let el = null;
  if (info.id === 'search-input') el = document.getElementById('search-input');
  else if (info.cls) el = document.querySelector(`.custom-g-input[data-id="${info.dataId}"]`);
  if (el) {
    el.focus();
    try { el.setSelectionRange(info.selStart, info.selEnd); } catch (e) {}
  }
}

/* ============ Event delegation ============ */

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const slot = target.dataset.slot;
  const id = target.dataset.id;

  switch (action) {
    case 'open-modal':
      if (!isDayLocked()) openModal(slot);
      break;
    case 'edit-slot':
      if (!isDayLocked()) openModal(slot);
      break;
    case 'delete-slot':
      if (!isDayLocked()) deleteMeal(slot);
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'toggle-item':
      toggleItem(id);
      break;
    case 'toggle-tag':
      toggleTag(target.dataset.tag);
      break;
    case 'set-portion':
      setPortion(id, target.dataset.portion);
      break;
    case 'remove-original':
      removeOriginal(id);
      break;
    case 'back-step':
      gotoStep1();
      break;
    case 'goto-step2':
      gotoStep2();
      break;
    case 'save-meal':
      if (!target.disabled) saveMeal();
      break;
    case 'add-meal':
      if (!isDayLocked()) openModal('snack');
      break;
    case 'done-today':
      pressDoneForToday(target.getBoundingClientRect());
      break;
    case 'undo-done':
      undoDoneForToday();
      break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search-input') {
    state.search = e.target.value;
    render();
  } else if (e.target.classList.contains('custom-g-input')) {
    setCustomG(e.target.dataset.id, e.target.value);
  }
});

render();
