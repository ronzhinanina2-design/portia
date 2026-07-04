/* ============ Portia — Today tab ============ */

const TODAY_DATE = new Date().toISOString().slice(0, 10);
let GOAL_KCAL = Data.getGoals().calorieTarget;
let GOAL_PROTEIN = Data.getGoals().proteinTarget;
let GOAL_WATER = Data.getGoals().waterTarget;
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
  modalLogId: null,
  isAddFlow: false,
  editMode: false,
  originalIds: [],
  removingIds: [],
  step: 1,
  search: '',
  activeTags: [],
  selected: {},
  order: [],
  showUndo: false,
  waterRipples: [],
  waterModal: null,
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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

function summarizeLog(log) {
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
  return { id: log.id, names, kcal, protein };
}

function dailyTotals() {
  let kcal = 0, protein = 0;
  SLOT_META.forEach(([key]) => {
    Data.getLogsForSlot(TODAY_DATE, key).forEach((log) => {
      for (const entry of log.entries) { kcal += entry.kcal; protein += entry.protein; }
    });
  });
  return { kcal, protein };
}

function wholePortionKcal(it) {
  return Math.round((it.kcal * (it.wholeG || 100)) / 100);
}
function wholePortionProtein(it) {
  return Math.round((it.protein * (it.wholeG || 100)) / 100);
}

function openModal(slot, logId) {
  const log = logId ? Data.getLogById(logId) : Data.getLogForSlot(TODAY_DATE, slot);
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
    setState({ modalSlot: slot, modalLogId: logId || null, isAddFlow: false, editMode: true, originalIds: [...order], removingIds: [], step: 1, search: '', activeTags: [], selected, order });
  } else {
    setState({ modalSlot: slot, modalLogId: null, isAddFlow: false, editMode: false, originalIds: [], removingIds: [], step: 1, search: '', activeTags: [], selected: {}, order: [] });
  }
}

function openModalByLogId(logId) {
  const log = Data.getLogById(logId);
  if (!log) return;
  openModal(log.slot, logId);
}

function openAddMealModal() {
  setState({ modalSlot: null, modalLogId: null, isAddFlow: true, editMode: false, originalIds: [], removingIds: [], step: 1, search: '', activeTags: [], selected: {}, order: [] });
}

function chooseAddMealSlot(slot) {
  setState({ modalSlot: slot });
}

function closeModal() {
  setState({ modalSlot: null, modalLogId: null, isAddFlow: false });
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
  if (p === 'custom') pendingFocus = { selector: `.custom-g-input[data-id="${id}"]` };
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

function deleteLog(logId) {
  Data.deleteLogById(logId);
  render();
}

function buildEntries(s) {
  return s.order.map((id) => {
    const lib = libItemById(id);
    const sel = s.selected[id];
    const c = calc(lib, sel) || { kcal: wholePortionKcal(lib), protein: wholePortionProtein(lib) };
    const grams = gramsForSelection(lib, sel);
    return { itemId: id, portion: sel.portion, grams, kcal: c.kcal, protein: c.protein };
  });
}

function saveMeal() {
  const s = state;
  if (s.isAddFlow) {
    if (s.modalSlot && s.order.length > 0) {
      Data.addLogForSlot(TODAY_DATE, s.modalSlot, buildEntries(s));
    }
    setState({ modalSlot: null, modalLogId: null, isAddFlow: false });
    return;
  }
  if (s.modalLogId) {
    if (s.order.length === 0) Data.deleteLogById(s.modalLogId);
    else Data.updateLogById(s.modalLogId, buildEntries(s));
    setState({ modalSlot: null, modalLogId: null });
    return;
  }
  if (s.order.length === 0) {
    Data.clearLogForSlot(TODAY_DATE, s.modalSlot);
  } else {
    Data.setLogForSlot(TODAY_DATE, s.modalSlot, buildEntries(s));
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

let preStreakSnapshot = null;

function yesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function pressDoneForToday(rect) {
  if (isDayLocked()) return;
  const consumedKcal = dailyTotals().kcal;
  const overLimit = consumedKcal > GOAL_KCAL;
  Data.setDayLock(TODAY_DATE, { locked: true, overLimit, lockedAt: Date.now() });

  preStreakSnapshot = Data.getStreak();
  // Going over the calorie limit breaks the streak for today, same as a day
  // with no star in Week/Progress — logging still counts toward totalDaysTracked
  // below, it just doesn't extend or start a streak.
  const nextStreak = overLimit
    ? 0
    : (preStreakSnapshot.lastLoggedDate === yesterdayDateStr() ? preStreakSnapshot.currentStreak + 1 : 1);
  Data.updateStreak({
    currentStreak: nextStreak,
    bestStreak: Math.max(preStreakSnapshot.bestStreak, nextStreak),
    lastLoggedDate: TODAY_DATE,
    totalDaysTracked: preStreakSnapshot.totalDaysTracked + 1,
  });

  setState({ showUndo: true });
  if (overLimit) spawnRipple(rect); else spawnStars(rect);
  scheduleUndoTimeout();
}

function undoDoneForToday() {
  clearTimeout(undoTimeoutId);
  Data.clearDayLock(TODAY_DATE);
  if (preStreakSnapshot) {
    Data.updateStreak(preStreakSnapshot);
    preStreakSnapshot = null;
  }
  setState({ showUndo: false });
}

/* ============ Water ============ */

function addWaterTap() {
  Data.addWater(TODAY_DATE, 250);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  setState((s) => ({ waterRipples: [...s.waterRipples, id] }));
  setTimeout(() => {
    setState((s) => ({ waterRipples: s.waterRipples.filter((x) => x !== id) }));
  }, 650);
}

function openWaterModal() {
  setState({ waterModal: { target: String(GOAL_WATER), error: '', phase: 'idle' } });
}
function closeWaterModal() {
  setState({ waterModal: null });
}
function setWaterTarget(v) {
  const clean = String(v).replace(/[^0-9]/g, '');
  setState((s) => ({ waterModal: { ...s.waterModal, target: clean, error: '' } }));
}
function saveWaterModal() {
  const wm = state.waterModal;
  if (!wm || wm.phase !== 'idle') return;
  if (!(Number(wm.target) > 0)) {
    setState((s) => ({ waterModal: { ...s.waterModal, error: 'Enter a valid daily goal in ml.' } }));
    return;
  }
  setState((s) => ({ waterModal: { ...s.waterModal, phase: 'loading', error: '' } }));
  setTimeout(() => {
    if (!state.waterModal) return;
    setState((s) => ({ waterModal: { ...s.waterModal, phase: 'success' } }));
    setTimeout(() => {
      const wm2 = state.waterModal;
      if (!wm2) return;
      Data.setWaterGoal(Number(wm2.target));
      GOAL_WATER = Data.getGoals().waterTarget;
      setState({ waterModal: null });
    }, 820);
  }, 760);
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
  const totals = dailyTotals();
  const consumedKcal = totals.kcal, consumedProtein = totals.protein;
  const leftKcal = Math.max(0, GOAL_KCAL - consumedKcal);
  const circ = 439.8;
  const ringOff = Math.max(0, circ * (1 - Math.min(1, consumedKcal / GOAL_KCAL)));
  const proteinPct = Math.round((consumedProtein / GOAL_PROTEIN) * 100);
  const proteinBarW = Math.min(100, proteinPct);

  const waterMl = Data.getWaterForDate(TODAY_DATE);
  const waterReached = waterMl >= GOAL_WATER;
  const waterPct = Math.min(100, Math.round((waterMl / GOAL_WATER) * 100));
  const waterFillColor = waterReached ? '#E8B800' : '#2ABFAD';
  const ripplesHtml = state.waterRipples.map(() => `
    <span style="position:absolute; inset:0; border-radius:11px; border:2px solid #2ABFAD; pointer-events:none; animation:waterRipple 0.65s ease-out forwards;"></span>
  `).join('');
  const waterReachedOverlay = waterReached
    ? `<div style="position:absolute; inset:0; border-radius:20px; border:1px solid rgba(232,184,0,0.55); background:rgba(232,184,0,0.10); pointer-events:none;"></div>`
    : '';

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

    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px;">
      <div style="background:#1C2733; border:1px solid #2A3A4A; border-radius:20px; padding:22px 22px;">
        <div style="display:flex; align-items:center; justify-content:space-between; min-height:36px; margin-bottom:16px;">
          <span class="section-label">Protein</span>
          <span style="font-size:13px; color:#8B9BAD;">${proteinPct}%</span>
        </div>
        <div style="display:flex; align-items:baseline; gap:5px; margin-bottom:14px;">
          <span style="font-size:38px; font-weight:600; line-height:0.9; color:#E8EDF2; letter-spacing:-0.03em;">${consumedProtein}</span>
          <span style="font-size:18px; font-weight:500; color:#E8EDF2;">g</span>
          <span style="font-size:13px; color:#8B9BAD; margin-left:2px;">/ ${GOAL_PROTEIN}g</span>
        </div>
        <div style="height:8px; background:#2A3A4A; border-radius:5px; overflow:hidden;">
          <div style="height:100%; width:${proteinBarW}%; background:#2ABFAD; border-radius:5px; transition:width 1.2s cubic-bezier(0.22,1,0.36,1);"></div>
        </div>
      </div>

      <div data-action="edit-water-goal" title="Edit water goal" style="position:relative; background:#1C2733; border:1px solid #2A3A4A; border-radius:20px; padding:22px 22px; cursor:pointer; transition:border-color 150ms ease;" onmouseover="this.style.borderColor='#3D5166'" onmouseout="this.style.borderColor='#2A3A4A'">
        <div style="position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; min-height:36px; margin-bottom:16px;">
          <span class="section-label">Water</span>
          <button data-action="add-water" title="Add 250ml" style="position:relative; width:36px; height:36px; border:none; border-radius:11px; background:rgba(42,191,173,0.14); color:#2ABFAD; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:background 150ms ease, transform 80ms ease;" onmouseover="this.style.background='rgba(42,191,173,0.24)'" onmouseout="this.style.background='rgba(42,191,173,0.14)'">
            ${ripplesHtml}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.104l-1.626 16.256a1 1 0 0 1-.995.901H7.737a1 1 0 0 1-.995-.901z"></path><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"></path></svg>
          </button>
        </div>
        <div style="position:relative; z-index:1; display:flex; align-items:baseline; gap:5px; margin-bottom:14px;">
          <span style="font-size:38px; font-weight:600; line-height:0.9; color:#E8EDF2; letter-spacing:-0.03em;">${fmt(waterMl)}</span>
          <span style="font-size:18px; font-weight:500; color:#E8EDF2;">ml</span>
          <span style="font-size:13px; color:#8B9BAD; margin-left:2px;">/ ${fmt(GOAL_WATER)}ml</span>
        </div>
        <div style="position:relative; z-index:1; height:8px; background:#2A3A4A; border-radius:5px; overflow:hidden;">
          <div style="height:100%; width:${waterPct}%; background:${waterFillColor}; border-radius:5px; transition:width 0.6s cubic-bezier(0.22,1,0.36,1), background 0.3s ease;"></div>
        </div>
        ${waterReachedOverlay}
      </div>
    </div>
  `;
}

function renderWaterModal() {
  const wm = state.waterModal;
  if (!wm) return '';
  const phase = wm.phase;
  const busy = phase === 'loading' || phase === 'success';
  const invalid = wm.error;
  const errBorder = invalid ? 'border-color: rgba(224,116,106,0.7) !important;' : '';

  const errorHtml = wm.error ? `
    <div style="display:flex; align-items:center; gap:8px; background:rgba(224,90,90,0.10); border:1px solid rgba(224,90,90,0.35); border-radius:10px; padding:10px 12px; margin-bottom:16px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E0746A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path></svg>
      <span style="font-size:13px; color:#E0746A;">${wm.error}</span>
    </div>
  ` : '';

  let saveBtnContent;
  if (phase === 'loading') {
    saveBtnContent = `<span style="display:inline-flex; align-items:center; gap:9px;"><span style="width:16px; height:16px; border:2px solid rgba(20,27,36,0.35); border-top-color:#141B24; border-radius:50%; display:inline-block; animation:spin 0.7s linear infinite;"></span>Saving…</span>`;
  } else if (phase === 'success') {
    saveBtnContent = `<span style="display:inline-flex; align-items:center; gap:8px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#141B24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Saved</span>`;
  } else {
    saveBtnContent = 'Save';
  }

  return `
    <div class="modal-overlay no-transitions" style="z-index:60;">
      <div style="position:relative; width:100%; max-width:440px; background:#1C2733; border:1px solid #2A3A4A; border-radius:22px; padding:26px 28px 24px; box-shadow:0 30px 80px rgba(0,0,0,0.55); font-family:Inter,sans-serif;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:22px;">
          <span class="modal-title">Water goal</span>
          <div data-action="close-water-modal" class="icon-btn" style="width:30px; height:30px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <div style="font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#8B9BAD; margin-bottom:8px;">Daily goal</div>
          <div style="display:flex; align-items:center; gap:10px; background:#2A3A4A; border:1.5px solid #2A3A4A; border-radius:12px; padding:12px 14px; ${errBorder}">
            <input id="water-target-input" value="${escapeHtml(wm.target)}" placeholder="0" style="flex:1; min-width:0; background:transparent; border:none; outline:none; font-family:Inter,sans-serif; font-size:18px; font-weight:500; color:#E8EDF2;" />
            <span style="font-size:14px; color:#8B9BAD;">ml</span>
          </div>
        </div>
        ${errorHtml}
        <div style="display:flex; gap:10px; margin-top:4px;">
          <button data-action="close-water-modal" class="btn-ghost" style="flex:0 0 auto; padding:14px 22px;">Cancel</button>
          <button data-action="save-water-modal" class="btn-primary" style="flex:1; ${busy ? 'cursor:default;' : ''}">${saveBtnContent}</button>
        </div>
      </div>
    </div>
  `;
}

function renderMeals() {
  const locked = isDayLocked();
  let loggedCount = 0;
  const slotsHtml = SLOT_META.map(([key, label]) => {
    const logs = Data.getLogsForSlot(TODAY_DATE, key);
    if (logs.length > 0) {
      loggedCount += logs.length;
      return logs.map((log, i) => {
        const sm = summarizeLog(log);
        const isBase = i === 0;
        const rowLabel = isBase ? label : `${ordinal(i + 1)} ${label}`;
        const actionsHtml = locked ? '' : `
              <div class="meal-actions" style="position:absolute; right:0; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:2px; transition:opacity 0.15s ease;">
                <div class="meal-icon" data-action="${isBase ? 'edit-slot' : 'edit-log'}" data-slot="${key}" data-logid="${log.id || ''}" title="Edit meal" style="width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
                </div>
                <div class="meal-icon" data-action="${isBase ? 'delete-slot' : 'delete-log'}" data-slot="${key}" data-logid="${log.id || ''}" title="Remove meal" style="width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
                </div>
              </div>`;
        return `
          <div style="margin-bottom:12px;">
            <div class="${locked ? '' : 'meal-card'}" style="background:#1C2733; border:1px solid #2A3A4A; border-radius:16px; padding:18px 20px; display:flex; align-items:flex-start; gap:16px; min-height:78px;">
              <div style="width:36px; height:36px; border-radius:10px; background:rgba(42,191,173,0.14); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ABFAD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
              </div>
              <div style="flex:1; min-width:0;">
                <div class="section-label" style="margin-bottom:3px;">${rowLabel}</div>
                <div style="font-size:16px; font-weight:500; color:#E8EDF2; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden;">${escapeHtml(sm.names.join(', '))}</div>
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
      }).join('');
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
  if (!state.modalSlot && !state.isAddFlow) return '';
  const s = state;
  const editMode = s.editMode;
  const slotChosen = !!s.modalSlot;
  const slotTitle = s.isAddFlow ? 'Add meal' : (editMode ? `Edit ${cap(s.modalSlot)}` : `Log ${cap(s.modalSlot)}`);
  const tabsHtml = s.isAddFlow ? `
    <div class="segmented" style="margin-bottom:18px; align-self:flex-start;">
      ${SLOT_META.map(([key, label]) => `<div class="segmented-pill${s.modalSlot === key ? ' on' : ''}" data-action="choose-add-slot" data-slot="${key}">${label}</div>`).join('')}
    </div>
  ` : '';
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

  const addFlowNeedsSlot = s.isAddFlow && !slotChosen;
  const step1Html = `
    <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <span class="modal-title">${slotTitle}</span>
        <span style="font-size:13px; color:#8B9BAD;">1 / 2</span>
      </div>
      ${tabsHtml}
      ${addFlowNeedsSlot ? `
        <div style="flex:1; display:flex; align-items:center; justify-content:center; text-align:center;">
          <span style="font-size:14px; color:#8B9BAD;">Choose a meal type to continue.</span>
        </div>
      ` : `
        ${zoneHtml}
        <div style="position:relative; margin-bottom:16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; left:15px; top:50%; transform:translateY(-50%);"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>
          <input id="search-input" class="input" value="${escapeHtml(s.search)}" placeholder="Search meals and ingredients…" style="width:100%; padding:13px 16px 13px 44px;" />
        </div>
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; margin-bottom:18px;">
          ${tagsHtml}
        </div>
        <div class="td-scroll-body" style="flex:1; min-height:0; overflow-y:auto; margin:0 -6px; padding:0 16px 0 6px;">
          ${listHtml}
        </div>
      `}
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
      <div class="td-scroll-body" style="flex:1; min-height:0; overflow-y:auto; margin:0 -6px; padding:0 6px; display:flex; flex-direction:column; gap:12px;">
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
    if (s.isAddFlow) {
      ctaLabel = 'Continue';
      ctaEnabledFlag = slotChosen && s.order.length > 0;
    } else if (editMode && s.order.length === 0) {
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
    ? (!s.isAddFlow && editMode && s.order.length === 0 ? 'save-meal' : 'goto-step2')
    : 'save-meal';

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
          <div class="td-scroll-body" style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column;">
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
  const scrollInfo = captureScrollTd();

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-content">
        ${renderNav()}
        ${renderGreeting()}
        <div style="display:grid; grid-template-columns:478px 1fr; gap:22px;">
          <div style="display:flex; flex-direction:column; gap:22px;">
            ${renderHero()}
          </div>
          <div style="display:flex; flex-direction:column; min-width:0;">
            ${renderMeals()}
          </div>
        </div>
      </div>
      ${renderModal()}
      ${renderWaterModal()}
    </div>
  `;

  restoreScrollTd(scrollInfo);
  restoreFocus(focusInfo);
  clearNoTransitions();

  if (pendingFocus) {
    const el = document.querySelector(pendingFocus.selector);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    pendingFocus = null;
  }
}

// Modal templates render with a `no-transitions` class baked in so every full
// re-render (triggered on every keystroke) recreates focused inputs without
// replaying their focus-color transition as a flicker; this lifts it after
// one paint so real transitions (hover, etc.) resume working normally.
function clearNoTransitions() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.no-transitions').forEach((el) => el.classList.remove('no-transitions'));
  }));
}

// Full-page re-renders on every keystroke destroy and recreate the scrollable
// containers below, so their scrollTop resets to 0 unless captured here first —
// without this, typing while scrolled down in the modal visibly jerks back to the top.
function captureScrollTd() {
  return Array.from(document.querySelectorAll('.td-scroll-body')).map((el) => el.scrollTop);
}
function restoreScrollTd(tops) {
  const els = document.querySelectorAll('.td-scroll-body');
  els.forEach((el, i) => { if (tops[i] != null) el.scrollTop = tops[i]; });
}

let pendingFocus = null;

function captureFocus() {
  const el = document.activeElement;
  if (!el || (el.id !== 'search-input' && el.id !== 'water-target-input' && !el.classList.contains('custom-g-input'))) return null;
  return { id: el.id, cls: el.classList.contains('custom-g-input'), dataId: el.dataset.id, selStart: el.selectionStart, selEnd: el.selectionEnd };
}

function restoreFocus(info) {
  if (!info) return;
  let el = null;
  if (info.id === 'search-input' || info.id === 'water-target-input') el = document.getElementById(info.id);
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
  const logId = target.dataset.logid;

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
    case 'edit-log':
      if (!isDayLocked()) openModalByLogId(logId);
      break;
    case 'delete-log':
      if (!isDayLocked()) deleteLog(logId);
      break;
    case 'choose-add-slot':
      chooseAddMealSlot(slot);
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
      if (!isDayLocked()) openAddMealModal();
      break;
    case 'done-today':
      pressDoneForToday(target.getBoundingClientRect());
      break;
    case 'undo-done':
      undoDoneForToday();
      break;
    case 'add-water':
      addWaterTap();
      break;
    case 'edit-water-goal':
      openWaterModal();
      break;
    case 'close-water-modal':
      closeWaterModal();
      break;
    case 'save-water-modal':
      if (!target.disabled) saveWaterModal();
      break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search-input') {
    state.search = e.target.value;
    render();
  } else if (e.target.classList.contains('custom-g-input')) {
    setCustomG(e.target.dataset.id, e.target.value);
  } else if (e.target.id === 'water-target-input') {
    setWaterTarget(e.target.value);
  }
});

render();
Data.ready().then(() => {
  GOAL_KCAL = Data.getGoals().calorieTarget;
  GOAL_PROTEIN = Data.getGoals().proteinTarget;
  GOAL_WATER = Data.getGoals().waterTarget;
  render();
});
