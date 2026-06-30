/* ============ Portia — Recipes tab ============ */

let ALL_TAGS_RC = ['High protein', 'Vegetarian', 'Grains', 'Fruit', 'Dairy', 'Snack', 'Meat', 'Fish', 'Healthy fats'];

const rcState = {
  tab: 'items',
  search: '',
  sort: 'recent',
  activeTag: 'All',
  panel: null, // { mode: 'detail'|'form', type: 'item'|'recipe', id, draft }
  confirmDelete: null, // { type, id, name }
};

function setRcState(patch) {
  const next = typeof patch === 'function' ? patch(rcState) : patch;
  Object.assign(rcState, next);
  renderRecipes();
}

function escapeHtmlRc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function roundRc(n) {
  return Math.round(n);
}
function fmtRc(n) {
  return Math.round(n).toLocaleString('en-US');
}
function cleanNumRc(v) {
  return String(v).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
}

function itemByIdRc(id) {
  return Data.getItems().find((i) => i.id === id);
}
function recipeByIdRc(id) {
  return Data.getRecipes().find((r) => r.id === id);
}
function recipeMacros(rec) {
  let kcal = 0, protein = 0, fat = 0, carbs = 0, broken = false;
  for (const ing of rec.ingredients) {
    const it = itemByIdRc(ing.itemId);
    if (!it) { broken = true; continue; }
    const f = ing.grams / 100;
    kcal += it.kcal * f; protein += it.protein * f; fat += it.fat * f; carbs += it.carbs * f;
  }
  return { kcal: roundRc(kcal), protein: roundRc(protein), fat: roundRc(fat), carbs: roundRc(carbs), broken };
}
function recipeBroken(rec) {
  return rec.ingredients.some((ing) => !itemByIdRc(ing.itemId));
}

function sortList(arr) {
  const s = rcState.sort;
  const a = [...arr];
  if (s === 'az') a.sort((x, y) => x.name.localeCompare(y.name));
  else if (s === 'za') a.sort((x, y) => y.name.localeCompare(x.name));
  else a.sort((x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0));
  return a;
}

/* ============ Navigation / panel actions ============ */

function setTabRc(t) {
  setRcState({ tab: t, search: '', activeTag: 'All', panel: null });
}
function openDetail(type, id) {
  setRcState({ panel: { mode: 'detail', type, id } });
}
function closePanelRc() {
  setRcState({ panel: null });
}

function blankItemDraft() {
  return { name: '', kcal: '', protein: '', fat: '', carbs: '', tags: [], addingTag: false, newTag: '', imageUrl: null };
}
function blankRecipeDraft() {
  return { name: '', ingredients: [], tags: [], ingSearch: '', addingTag: false, newTag: '', replacing: null, imageUrl: null };
}
function openForm(type, id) {
  let draft;
  if (type === 'item') {
    if (id) {
      const it = itemByIdRc(id);
      draft = { name: it.name, kcal: String(it.kcal), protein: String(it.protein), fat: String(it.fat), carbs: String(it.carbs), tags: [...it.tags], addingTag: false, newTag: '', imageUrl: it.imageUrl || null };
    } else draft = blankItemDraft();
  } else {
    if (id) {
      const r = recipeByIdRc(id);
      draft = { name: r.name, ingredients: r.ingredients.map((i) => ({ ...i })), tags: [...r.tags], ingSearch: '', addingTag: false, newTag: '', replacing: null, imageUrl: r.imageUrl || null };
    } else draft = blankRecipeDraft();
  }
  setRcState({ panel: { mode: 'form', type, id, draft } });
}
function patchDraft(patch) {
  setRcState((s) => ({ panel: { ...s.panel, draft: { ...s.panel.draft, ...patch } } }));
}
function toggleDraftTag(t) {
  setRcState((s) => {
    const d = s.panel.draft;
    const tags = d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t];
    return { panel: { ...s.panel, draft: { ...d, tags } } };
  });
}
function commitNewTag() {
  const s = rcState;
  const d = s.panel.draft;
  const t = d.newTag.trim();
  if (!t) {
    patchDraft({ addingTag: false, newTag: '' });
    return;
  }
  const tags = d.tags.includes(t) ? d.tags : [...d.tags, t];
  if (!ALL_TAGS_RC.includes(t)) ALL_TAGS_RC.push(t);
  patchDraft({ tags, addingTag: false, newTag: '' });
}

function addIngredient(id) {
  setRcState((s) => {
    const d = s.panel.draft;
    if (d.ingredients.some((i) => i.itemId === id)) return {};
    return { panel: { ...s.panel, draft: { ...d, ingredients: [...d.ingredients, { itemId: id, grams: 100 }], ingSearch: '' } } };
  });
}
function removeIngredient(idx) {
  setRcState((s) => {
    const d = s.panel.draft;
    return { panel: { ...s.panel, draft: { ...d, ingredients: d.ingredients.filter((_, i) => i !== idx), replacing: d.replacing === idx ? null : d.replacing } } };
  });
}
function setIngGrams(idx, v) {
  const g = cleanNumRc(v);
  setRcState((s) => {
    const d = s.panel.draft;
    const ingredients = d.ingredients.map((ing, i) => (i === idx ? { ...ing, grams: g } : ing));
    return { panel: { ...s.panel, draft: { ...d, ingredients } } };
  });
}
function startReplace(idx) {
  setRcState((s) => ({ panel: { ...s.panel, draft: { ...s.panel.draft, replacing: idx, ingSearch: '' } } }));
}
function doReplace(idx, newId) {
  setRcState((s) => {
    const d = s.panel.draft;
    const ingredients = d.ingredients.map((ing, i) => (i === idx ? { ...ing, itemId: newId } : ing));
    return { panel: { ...s.panel, draft: { ...d, ingredients, replacing: null, ingSearch: '' } } };
  });
}

function saveItem() {
  const s = rcState;
  const d = s.panel.draft, id = s.panel.id;
  const rec = { name: d.name.trim() || 'Untitled item', kcal: Number(d.kcal) || 0, protein: Number(d.protein) || 0, fat: Number(d.fat) || 0, carbs: Number(d.carbs) || 0, tags: [...d.tags], imageUrl: d.imageUrl || null };
  if (id) Data.updateItem(id, rec);
  else Data.addItem(rec);
  setRcState({ panel: null });
}
function saveRecipe() {
  const s = rcState;
  const d = s.panel.draft, id = s.panel.id;
  const ingredients = d.ingredients.map((ing) => ({ itemId: ing.itemId, grams: Number(ing.grams) || 0 }));
  const rec = { name: d.name.trim() || 'Untitled recipe', ingredients, tags: [...d.tags], imageUrl: d.imageUrl || null };
  if (id) Data.updateRecipe(id, rec);
  else Data.addRecipe(rec);
  setRcState({ panel: null });
}

/* ============ Photo upload ============ */

let pendingPhotoTarget = null;

function triggerPhotoUpload(target) {
  pendingPhotoTarget = target;
  const input = document.getElementById('rc-photo-input');
  if (input) { input.value = ''; input.click(); }
}

const PHOTO_MAX_DIMENSION = 800;
const PHOTO_JPEG_QUALITY = 0.82;
const PHOTO_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// Downscales to PHOTO_MAX_DIMENSION on the longest edge and re-encodes as
// JPEG so a multi-MB phone photo doesn't bloat the single JSON blob that
// holds all of Portia's data (localStorage + the Supabase row both round-trip
// the whole blob on every save, not just the photo).
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > PHOTO_MAX_DIMENSION || height > PHOTO_MAX_DIMENSION) {
          if (width >= height) {
            height = Math.round((height / width) * PHOTO_MAX_DIMENSION);
            width = PHOTO_MAX_DIMENSION;
          } else {
            width = Math.round((width / height) * PHOTO_MAX_DIMENSION);
            height = PHOTO_MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function applyPhotoFile(file) {
  const target = pendingPhotoTarget;
  pendingPhotoTarget = null;
  if (!file || !target) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file (JPEG, PNG, HEIC, etc).');
    return;
  }
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    alert('That photo is too large. Please choose a file under 20MB.');
    return;
  }
  compressImageFile(file).then((dataUrl) => {
    if (target.kind === 'form') {
      patchDraft({ imageUrl: dataUrl });
    } else {
      if (target.type === 'item') Data.updateItem(target.id, { imageUrl: dataUrl });
      else Data.updateRecipe(target.id, { imageUrl: dataUrl });
      renderRecipes();
    }
  }).catch(() => {
    alert('Could not process that photo. Please try a different file.');
  });
}

function removeCardPhoto(type, id) {
  if (type === 'item') Data.updateItem(id, { imageUrl: null });
  else Data.updateRecipe(id, { imageUrl: null });
  renderRecipes();
}

function askDelete(type, id, name) {
  setRcState({ confirmDelete: { type, id, name } });
}
function cancelDelete() {
  setRcState({ confirmDelete: null });
}
function doDelete() {
  const c = rcState.confirmDelete;
  if (!c) { setRcState({ confirmDelete: null }); return; }
  if (c.type === 'item') Data.deleteItem(c.id);
  else Data.deleteRecipe(c.id);
  setRcState({ confirmDelete: null, panel: null });
}

/* ============ Rendering ============ */

function renderNavRc() {
  return `
    <div class="nav-row">
      <div class="nav-left">
        <div class="logo">portia</div>
        <div class="nav-pills">
          <a class="nav-tab" href="today.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/></svg>
            Today
          </a>
          <a class="nav-tab" href="week.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
            Week
          </a>
          <a class="nav-tab active" href="recipes.html">
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

function renderTopBar(isItems) {
  const s = rcState;
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; gap:20px; flex-wrap:wrap;">
      <div class="page-title">Recipes</div>
      <div class="segmented">
        <div class="segmented-pill${isItems ? ' on' : ''}" data-action="set-tab" data-tab="items">Items</div>
        <div class="segmented-pill${!isItems ? ' on' : ''}" data-action="set-tab" data-tab="recipes">Recipes</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
      <div style="position:relative; flex:1; max-width:340px;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; left:14px; top:50%; transform:translateY(-50%);"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>
        <input id="rc-search" class="input" value="${escapeHtmlRc(s.search)}" placeholder="${isItems ? 'Search items…' : 'Search recipes…'}" style="width:100%; padding:11px 14px 11px 40px;" />
      </div>
      <div style="flex:1;"></div>
      <div style="position:relative;">
        <select id="rc-sort" class="input" style="appearance:none; padding:11px 38px 11px 14px; cursor:pointer;">
          <option value="recent" ${s.sort === 'recent' ? 'selected' : ''}>Recently added</option>
          <option value="az" ${s.sort === 'az' ? 'selected' : ''}>Name A–Z</option>
          <option value="za" ${s.sort === 'za' ? 'selected' : ''}>Name Z–A</option>
        </select>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; right:13px; top:50%; transform:translateY(-50%); pointer-events:none;"><path d="M6 9l6 6 6-6"></path></svg>
      </div>
      <button data-action="add-primary" style="display:flex; align-items:center; gap:8px; border:none; background:#E8B800; color:#141B24; font-family:Inter,sans-serif; font-size:14px; font-weight:600; padding:12px 18px; border-radius:11px; cursor:pointer; white-space:nowrap; transition:background 150ms ease, transform 80ms ease;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
        ${isItems ? 'Add item' : 'Create recipe'}
      </button>
    </div>
  `;
}

function renderGridAndEmpty(isItems) {
  const s = rcState;
  const base = isItems ? Data.getItems() : Data.getRecipes();

  const tagSet = new Set();
  base.forEach((x) => x.tags.forEach((t) => tagSet.add(t)));
  const chipLabels = ['All', ...ALL_TAGS_RC.filter((t) => tagSet.has(t))];
  const chipsHtml = chipLabels.map((t) => {
    const active = s.activeTag === t;
    return `<div class="chip${active ? ' active' : ''}" data-action="set-tag" data-tag="${escapeHtmlRc(t)}" style="flex-shrink:0;">${escapeHtmlRc(t)}</div>`;
  }).join('');

  const q = s.search.trim().toLowerCase();
  let filtered = base.filter((x) => (!q || x.name.toLowerCase().includes(q)) && (s.activeTag === 'All' || x.tags.includes(s.activeTag)));
  filtered = sortList(filtered);

  const cardsHtml = filtered.map((x) => {
    let macroText, broken = false;
    if (isItems) {
      macroText = `${roundRc(x.kcal)} kcal · ${roundRc(x.protein)}g protein`;
    } else {
      const m = recipeMacros(x);
      broken = m.broken;
      macroText = broken ? 'Missing ingredient' : `${m.kcal} kcal · ${m.protein}g protein`;
    }
    const shownTags = x.tags.slice(0, 2);
    const extra = x.tags.length > 2 ? `<span style="font-size:11px; font-weight:500; color:#8B9BAD; background:#2A3A4A; padding:3px 9px; border-radius:6px;">+${x.tags.length - 2}</span>` : '';
    const tagChipsHtml = shownTags.map((t) => `<span style="font-size:11px; font-weight:500; color:#8B9BAD; background:#2A3A4A; padding:3px 9px; border-radius:6px;">${escapeHtmlRc(t)}</span>`).join('') + extra;

    const borderStyle = broken ? 'border:1px solid rgba(232,184,0,0.4);' : 'border:1px solid #2A3A4A;';
    const fav = !!x.favourite;
    const favHeartSvg = fav
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="#2ABFAD" stroke="#2ABFAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8EDF2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;

    const photoTopOffset = broken ? '42px' : '10px';
    return `
      <div class="rc-card" data-action="open-detail" data-type="${isItems ? 'item' : 'recipe'}" data-id="${x.id}" style="position:relative; background:#1C2733; ${borderStyle} border-radius:16px; overflow:hidden; cursor:pointer; transition:transform 0.12s ease, border-color 0.15s ease;">
        <div data-action="upload-photo" data-type="${isItems ? 'item' : 'recipe'}" data-id="${x.id}" title="${x.imageUrl ? 'Tap to replace photo' : 'Tap to add a photo'}" style="position:relative; width:100%; aspect-ratio:16/9; background:#2A3A4A; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          ${x.imageUrl ? `<img src="${x.imageUrl}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" alt="">` : ''}
          ${x.imageUrl ? `<div class="rc-photo-scrim" style="position:absolute; inset:0; background:rgba(10,14,20,0.45);"></div>` : ''}
          ${broken ? `
            <div style="position:absolute; top:10px; left:10px; display:flex; align-items:center; gap:5px; background:rgba(232,184,0,0.16); border:1px solid rgba(232,184,0,0.4); color:#E8B800; font-size:11px; font-weight:600; padding:4px 9px; border-radius:7px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path></svg>
              Broken
            </div>
          ` : ''}
          ${!isItems ? `
            <div style="position:absolute; top:10px; right:10px; display:flex; align-items:center; gap:5px; background:rgba(42,191,173,0.14); border:1px solid rgba(42,191,173,0.35); color:#2ABFAD; font-size:11px; font-weight:600; padding:4px 9px; border-radius:7px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>
              Recipe
            </div>
          ` : ''}
          ${x.imageUrl ? `
            <div class="rc-photo-actions" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:8px;">
              <div style="display:flex; align-items:center; gap:6px; background:rgba(20,27,36,0.7); border:1px solid rgba(255,255,255,0.12); color:#E8EDF2; font-size:12px; font-weight:600; padding:7px 13px; border-radius:9px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
                Replace
              </div>
              <div data-action="remove-photo" data-type="${isItems ? 'item' : 'recipe'}" data-id="${x.id}" title="Remove photo" style="width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:rgba(20,27,36,0.7); border:1px solid rgba(255,255,255,0.12); cursor:pointer; color:#E8EDF2; transition:border-color 150ms ease, transform 80ms ease;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
              </div>
            </div>
          ` : ''}
          <div class="rc-fav-btn" data-action="toggle-fav" data-type="${isItems ? 'item' : 'recipe'}" data-id="${x.id}" title="${fav ? 'Remove from favourites' : 'Add to favourites'}" style="position:absolute; bottom:10px; right:10px; width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:rgba(20,27,36,0.55); border:1px solid rgba(255,255,255,0.1); cursor:pointer; transition:border-color 150ms ease, transform 80ms ease;">
            ${favHeartSvg}
          </div>
          ${!x.imageUrl ? `
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"></rect><circle cx="8.5" cy="8.5" r="1.6"></circle><path d="M21 15l-5-5L5 21"></path></svg>
            <div class="rc-photo-scrim" style="position:absolute; inset:0; background:rgba(10,14,20,0.55);"></div>
            <div class="rc-photo-actions" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
              <div style="display:flex; align-items:center; gap:6px; background:rgba(20,27,36,0.7); border:1px solid rgba(255,255,255,0.12); color:#E8EDF2; font-size:12px; font-weight:600; padding:7px 13px; border-radius:9px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"></path><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path></svg>
                Upload photo
              </div>
            </div>
          ` : ''}
        </div>
        <div style="padding:13px 14px 15px;">
          <div style="font-size:15px; font-weight:600; color:#E8EDF2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtmlRc(x.name)}</div>
          <div style="font-size:12px; color:#8B9BAD; margin-top:4px;">${macroText}</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:11px; min-height:22px;">${tagChipsHtml}</div>
        </div>
      </div>
    `;
  }).join('');

  const hasCards = filtered.length > 0;
  const showEmpty = base.length === 0;

  let bodyHtml;
  if (showEmpty) {
    const emptyIcon = isItems
      ? `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"></path><path d="M3 7v10l9 4 9-4V7"></path><path d="M12 11v10"></path></svg>`
      : `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>`;
    const heading = isItems ? 'Your library is empty' : 'No recipes yet';
    const subtext = isItems
      ? 'Add your first item to get started — things like banana, chicken breast, or Greek yogurt.'
      : 'Create your first recipe by combining items from your library — like a salad or a smoothie bowl.';
    const needsItems = !isItems && Data.getItems().length === 0;
    bodyHtml = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:90px 20px 100px;">
        <div style="width:84px; height:84px; border-radius:22px; background:#1C2733; border:1px solid #2A3A4A; display:flex; align-items:center; justify-content:center; margin-bottom:24px; color:#2ABFAD;">${emptyIcon}</div>
        <div style="font-size:21px; font-weight:600; color:#E8EDF2; margin-bottom:9px;">${heading}</div>
        <div style="font-size:14px; color:#8B9BAD; line-height:1.55; max-width:380px; margin-bottom:8px;">${subtext}</div>
        ${needsItems ? `<div data-action="set-tab" data-tab="items" style="font-size:13px; color:#2ABFAD; cursor:pointer; margin-bottom:8px;">You'll need at least one item in your library first →</div>` : ''}
        <button data-action="add-primary" style="display:flex; align-items:center; gap:8px; border:none; background:#E8B800; color:#141B24; font-family:Inter,sans-serif; font-size:15px; font-weight:600; padding:13px 22px; border-radius:12px; cursor:pointer; margin-top:18px; transition:background 150ms ease, transform 80ms ease;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
          ${isItems ? 'Add item' : 'Create recipe'}
        </button>
      </div>
    `;
  } else {
    bodyHtml = `<div class="rc-grid">${cardsHtml}</div>`;
    if (!hasCards) {
      bodyHtml = `<div style="padding:60px 20px; text-align:center; color:#8B9BAD; font-size:14px;">Nothing matches your search or filter.</div>`;
    }
  }

  return `
    <div class="rc-chiprow" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; margin-bottom:22px;">${chipsHtml}</div>
    ${bodyHtml}
  `;
}

function renderDetailPanel(panel) {
  if (panel.type === 'item') {
    const it = itemByIdRc(panel.id);
    if (!it) return '';
    const tagsHtml = it.tags.map((t) => `<span style="font-size:12px; font-weight:500; color:#8B9BAD; background:#2A3A4A; padding:5px 11px; border-radius:7px;">${escapeHtmlRc(t)}</span>`).join('');
    const rows = [
      ['Calories', `${fmtRc(it.kcal)} kcal`],
      ['Protein', `${roundRc(it.protein)} g`],
      ['Fat', `${roundRc(it.fat)} g`],
      ['Carbs', `${roundRc(it.carbs)} g`],
    ];
    const rowsHtml = rows.map(([label, val]) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 0; border-bottom:1px solid #2A3A4A;">
        <span style="font-size:14px; color:#8B9BAD;">${label}</span>
        <span style="font-size:15px; font-weight:600; color:#E8EDF2;">${val}</span>
      </div>
    `).join('');
    return `
      <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
        <div style="display:flex; justify-content:flex-end; padding:18px 18px 0;">
          <div data-action="close-panel" class="icon-btn" style="width:34px; height:34px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </div>
        </div>
        <div style="flex:1; min-height:0; overflow-y:auto; padding:6px 34px 30px;">
          <div style="position:relative; width:100%; aspect-ratio:16/9; background:#2A3A4A; border-radius:14px; display:flex; align-items:center; justify-content:center; margin-bottom:24px; overflow:hidden;">
            ${it.imageUrl ? `<img src="${it.imageUrl}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" alt="">` : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"></rect><circle cx="8.5" cy="8.5" r="1.6"></circle><path d="M21 15l-5-5L5 21"></path></svg>`}
          </div>
          <div style="font-size:22px; font-weight:500; color:#E8EDF2; margin-bottom:14px;">${escapeHtmlRc(it.name)}</div>
          <div style="display:flex; flex-wrap:wrap; gap:7px; margin-bottom:26px;">${tagsHtml}</div>
          <div class="section-label" style="margin-bottom:6px;">Per 100g</div>
          <div>${rowsHtml}</div>
        </div>
        <div style="display:flex; gap:10px; padding:18px 34px; border-top:1px solid #2A3A4A;">
          <button data-action="edit-from-detail" data-type="item" data-id="${it.id}" class="btn-edit-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
            Edit
          </button>
          <button data-action="ask-delete" data-type="item" data-id="${it.id}" data-name="${escapeHtmlRc(it.name)}" class="btn-delete-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
            Delete
          </button>
        </div>
      </div>
    `;
  }

  const r = recipeByIdRc(panel.id);
  if (!r) return '';
  const m = recipeMacros(r);
  const tagsHtml = r.tags.map((t) => `<span style="font-size:12px; font-weight:500; color:#8B9BAD; background:#2A3A4A; padding:5px 11px; border-radius:7px;">${escapeHtmlRc(t)}</span>`).join('');
  const ingRowsHtml = r.ingredients.map((ing) => {
    const it = itemByIdRc(ing.itemId);
    if (!it) {
      return `
        <div style="display:flex; align-items:center; gap:12px; background:#1A2430; border-radius:10px; padding:11px 14px;">
          <span style="font-size:14px; color:#E8B800; text-decoration:line-through; flex:1; min-width:0;">Missing item</span>
          <span style="font-size:13px; color:#8B9BAD;">${ing.grams} g</span>
          <span style="font-size:13px; font-weight:500; color:#E8EDF2; min-width:70px; text-align:right;">—</span>
        </div>
      `;
    }
    return `
      <div style="display:flex; align-items:center; gap:12px; background:#1A2430; border-radius:10px; padding:11px 14px;">
        <span style="font-size:14px; color:#E8EDF2; flex:1; min-width:0;">${escapeHtmlRc(it.name)}</span>
        <span style="font-size:13px; color:#8B9BAD;">${ing.grams} g</span>
        <span style="font-size:13px; font-weight:500; color:#E8EDF2; min-width:70px; text-align:right;">${fmtRc((it.kcal * ing.grams) / 100)} kcal</span>
      </div>
    `;
  }).join('');
  const macroRows = [
    ['Calories', `${fmtRc(m.kcal)} kcal`],
    ['Protein', `${m.protein} g`],
  ];
  const macroRowsHtml = macroRows.map(([label, val]) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 0; border-bottom:1px solid #2A3A4A;">
      <span style="font-size:14px; color:#8B9BAD;">${label}</span>
      <span style="font-size:15px; font-weight:600; color:#E8EDF2;">${val}</span>
    </div>
  `).join('');

  return `
    <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
      <div style="display:flex; justify-content:flex-end; padding:18px 18px 0;">
        <div data-action="close-panel" class="icon-btn" style="width:34px; height:34px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </div>
      </div>
      <div style="flex:1; min-height:0; overflow-y:auto; padding:6px 34px 30px;">
        <div style="position:relative; width:100%; aspect-ratio:16/9; background:#2A3A4A; border-radius:14px; display:flex; align-items:center; justify-content:center; margin-bottom:24px; overflow:hidden;">
          ${r.imageUrl ? `<img src="${r.imageUrl}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" alt="">` : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"></rect><circle cx="8.5" cy="8.5" r="1.6"></circle><path d="M21 15l-5-5L5 21"></path></svg>`}
        </div>
        <div style="font-size:22px; font-weight:500; color:#E8EDF2; margin-bottom:14px;">${escapeHtmlRc(r.name)}</div>
        ${m.broken ? `
          <div style="display:flex; align-items:center; gap:9px; background:rgba(232,184,0,0.10); border:1px solid rgba(232,184,0,0.4); border-radius:11px; padding:11px 14px; margin-bottom:18px;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E8B800" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path></svg>
            <span style="font-size:13px; color:#E8B800;">An ingredient was deleted. Edit to replace or remove it.</span>
          </div>
        ` : ''}
        <div style="display:flex; flex-wrap:wrap; gap:7px; margin-bottom:26px;">${tagsHtml}</div>
        <div class="section-label" style="margin-bottom:10px;">Ingredients</div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:28px;">${ingRowsHtml}</div>
        <div class="section-label" style="margin-bottom:6px;">Total macros</div>
        <div>${macroRowsHtml}</div>
      </div>
      <div style="display:flex; gap:10px; padding:18px 34px; border-top:1px solid #2A3A4A;">
        <button data-action="edit-from-detail" data-type="recipe" data-id="${r.id}" class="btn-edit-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
          Edit
        </button>
        <button data-action="ask-delete" data-type="recipe" data-id="${r.id}" data-name="${escapeHtmlRc(r.name)}" class="btn-delete-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
          Delete
        </button>
      </div>
    </div>
  `;
}

function renderTagChipsEditor(draft) {
  const tagChip = 'display:inline-flex; align-items:center; padding:7px 13px; border-radius:9px; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; transition:background 150ms ease, border-color 150ms ease, color 150ms ease;';
  const chipsHtml = ALL_TAGS_RC.map((t) => {
    const active = draft.tags.includes(t);
    const style = active
      ? tagChip + ' background:#2A3A4A; border:1.5px solid #2ABFAD; color:#2ABFAD;'
      : tagChip + ' background:#2A3A4A; border:1.5px solid #2A3A4A; color:#8B9BAD;';
    return `<div data-action="toggle-draft-tag" data-tag="${escapeHtmlRc(t)}" style="${style}">${escapeHtmlRc(t)}</div>`;
  }).join('');

  const addingTagHtml = draft.addingTag
    ? `
      <div style="display:inline-flex; align-items:center; gap:6px; background:#2A3A4A; border:1.5px solid #2ABFAD; border-radius:9px; padding:4px 6px 4px 12px;">
        <input id="rc-new-tag" value="${escapeHtmlRc(draft.newTag)}" placeholder="New tag" style="width:90px; background:transparent; border:none; font-family:Inter,sans-serif; font-size:13px; color:#E8EDF2; outline:none;" />
        <div data-action="commit-tag" style="width:24px; height:24px; border-radius:6px; background:#2ABFAD; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#141B24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
        </div>
      </div>
    `
    : `
      <div data-action="start-tag" style="display:inline-flex; align-items:center; gap:6px; background:transparent; border:1.5px dashed #2ABFAD; color:#2ABFAD; border-radius:9px; padding:7px 12px; font-size:13px; font-weight:500; cursor:pointer;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
        New tag
      </div>
    `;

  return `
    <div class="section-label" style="margin-bottom:8px; text-transform:none; letter-spacing:0; font-weight:600; font-size:12px;">Tags</div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">${chipsHtml}${addingTagHtml}</div>
  `;
}

function renderFormPanel(panel) {
  const d = panel.draft;
  const isEdit = !!panel.id;
  const isItem = panel.type === 'item';

  const ctaEnabled = isItem ? d.name.trim().length > 0 : (d.name.trim().length > 0 && d.ingredients.length > 0);
  const ctaLabel = isItem ? (isEdit ? 'Save changes' : 'Save item') : (isEdit ? 'Save changes' : 'Save recipe');

  const photoHtml = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:24px;">
      <div data-action="upload-photo" data-target="form" title="${d.imageUrl ? 'Tap to replace photo' : 'Tap to add a photo'}" style="position:relative; width:88px; height:88px; flex-shrink:0; background:#2A3A4A; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden;">
        ${d.imageUrl ? `
          <img src="${d.imageUrl}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" alt="">
          <div data-action="remove-form-photo" title="Remove photo" style="position:absolute; top:4px; right:4px; width:20px; height:20px; border-radius:6px; background:rgba(20,27,36,0.7); border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; color:#E8EDF2;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </div>
        ` : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"></rect><circle cx="8.5" cy="8.5" r="1.6"></circle><path d="M21 15l-5-5L5 21"></path></svg>`}
      </div>
      <div style="font-size:12px; color:#5C6B7A; line-height:1.5;">${d.imageUrl ? 'Tap photo to replace,<br>or use the × to remove it' : 'Tap to add a photo'}</div>
    </div>
  `;

  let bodyHtml;
  if (isItem) {
    bodyHtml = `
      ${photoHtml}
      <div style="font-size:12px; font-weight:600; color:#8B9BAD; margin-bottom:8px;">Name</div>
      <input id="rc-f-name" class="input-card" value="${escapeHtmlRc(d.name)}" placeholder="e.g. Banana" style="width:100%; margin-bottom:24px;" />
      <div style="font-size:12px; font-weight:600; color:#8B9BAD; margin-bottom:8px;">Macros per 100g</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
        <div>
          <div style="font-size:11px; color:#6B7E91; margin-bottom:6px;">Calories (kcal)</div>
          <input id="rc-f-kcal" class="input-card" value="${escapeHtmlRc(d.kcal)}" placeholder="0" style="width:100%;" />
        </div>
        <div>
          <div style="font-size:11px; color:#6B7E91; margin-bottom:6px;">Protein (g)</div>
          <input id="rc-f-protein" class="input-card" value="${escapeHtmlRc(d.protein)}" placeholder="0" style="width:100%;" />
        </div>
        <div>
          <div style="font-size:11px; color:#6B7E91; margin-bottom:6px;">Fat (g)</div>
          <input id="rc-f-fat" class="input-card" value="${escapeHtmlRc(d.fat)}" placeholder="0" style="width:100%;" />
        </div>
        <div>
          <div style="font-size:11px; color:#6B7E91; margin-bottom:6px;">Carbs (g)</div>
          <input id="rc-f-carbs" class="input-card" value="${escapeHtmlRc(d.carbs)}" placeholder="0" style="width:100%;" />
        </div>
      </div>
      ${renderTagChipsEditor(d)}
    `;
  } else {
    const q = d.ingSearch.trim().toLowerCase();
    const addedIds = new Set(d.ingredients.map((i) => i.itemId));
    const replacing = d.replacing;
    const replaceMode = replacing !== null && replacing !== undefined;
    const showResults = q.length > 0;
    const results = showResults
      ? Data.getItems().filter((it) => it.name.toLowerCase().includes(q) && (replaceMode || !addedIds.has(it.id))).slice(0, 6)
      : [];
    const resultsHtml = results.map((it) => `
      <div data-action="${replaceMode ? 'pick-replace' : 'pick-ingredient'}" data-id="${it.id}" style="display:flex; align-items:center; justify-content:space-between; padding:11px 14px; cursor:pointer; border-bottom:1px solid rgba(42,58,74,0.5); transition:background 150ms ease;" onmouseover="this.style.background='#233040'" onmouseout="this.style.background='transparent'">
        <span style="font-size:14px; color:#E8EDF2;">${escapeHtmlRc(it.name)}</span>
        <span style="font-size:12px; color:#8B9BAD;">${roundRc(it.kcal)} kcal / 100g</span>
      </div>
    `).join('');
    const resultsBoxHtml = showResults ? `
      <div style="background:#1A2430; border:1px solid #2A3A4A; border-radius:11px; overflow:hidden; margin-bottom:14px;">
        ${resultsHtml || `<div style="padding:14px; font-size:13px; color:#8B9BAD; text-align:center;">No matching items in your library.</div>`}
      </div>
    ` : '';

    let tK = 0, tP = 0, tF = 0, tC = 0;
    const ingRowsHtml = d.ingredients.map((ing, idx) => {
      const it = itemByIdRc(ing.itemId);
      const gn = Number(ing.grams) || 0;
      if (!it) {
        return `
          <div style="display:flex; align-items:center; gap:10px; background:rgba(232,184,0,0.07); border:1px solid rgba(232,184,0,0.4); border-radius:11px; padding:10px 12px;">
            <span style="flex:1; min-width:0; font-size:14px; color:#E8B800; text-decoration:line-through;">Missing item</span>
            <div data-action="start-replace" data-idx="${idx}" style="font-size:12px; font-weight:600; color:#2ABFAD; cursor:pointer; padding:4px 8px; border-radius:6px;">Replace</div>
            <input class="rc-ing-gram" data-idx="${idx}" value="${escapeHtmlRc(ing.grams)}" placeholder="0" style="width:62px; background:#1A2430; border:1.5px solid #34465A; border-radius:8px; padding:7px 9px; font-size:13px; color:#E8EDF2; outline:none; text-align:right;" />
            <span style="font-size:12px; color:#8B9BAD;">g</span>
            <span style="font-size:13px; color:#8B9BAD; min-width:72px; text-align:right;">—</span>
            <div data-action="remove-ingredient" data-idx="${idx}" style="width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#6B7E91; flex-shrink:0;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </div>
          </div>
        `;
      }
      tK += (it.kcal * gn) / 100; tP += (it.protein * gn) / 100; tF += (it.fat * gn) / 100; tC += (it.carbs * gn) / 100;
      return `
        <div style="display:flex; align-items:center; gap:10px; background:#2A3A4A; border:1px solid #34465A; border-radius:11px; padding:10px 12px;">
          <span style="flex:1; min-width:0; font-size:14px; color:#E8EDF2;">${escapeHtmlRc(it.name)}</span>
          <input class="rc-ing-gram" data-idx="${idx}" value="${escapeHtmlRc(ing.grams)}" placeholder="0" style="width:62px; background:#1A2430; border:1.5px solid #34465A; border-radius:8px; padding:7px 9px; font-size:13px; color:#E8EDF2; outline:none; text-align:right;" />
          <span style="font-size:12px; color:#8B9BAD;">g</span>
          <span style="font-size:13px; color:#8B9BAD; min-width:72px; text-align:right;">${fmtRc((it.kcal * gn) / 100)} kcal</span>
          <div data-action="remove-ingredient" data-idx="${idx}" style="width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#6B7E91; flex-shrink:0;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </div>
        </div>
      `;
    }).join('');

    const totalsHtml = d.ingredients.length > 0 ? `
      <div style="background:#1A2430; border:1px solid #2A3A4A; border-radius:13px; padding:16px 18px; margin-bottom:24px;">
        <div class="section-label" style="margin-bottom:12px;">Recipe totals</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; color:#8B9BAD;">Calories</span><span style="font-size:14px; font-weight:600; color:#E8EDF2;">${fmtRc(tK)} kcal</span></div>
          <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; color:#8B9BAD;">Protein</span><span style="font-size:14px; font-weight:600; color:#E8EDF2;">${roundRc(tP)} g</span></div>
          <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; color:#8B9BAD;">Fat</span><span style="font-size:14px; font-weight:600; color:#E8EDF2;">${roundRc(tF)} g</span></div>
          <div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; color:#8B9BAD;">Carbs</span><span style="font-size:14px; font-weight:600; color:#E8EDF2;">${roundRc(tC)} g</span></div>
        </div>
      </div>
    ` : '';

    bodyHtml = `
      ${photoHtml}
      <div style="font-size:12px; font-weight:600; color:#8B9BAD; margin-bottom:8px;">Name</div>
      <input id="rc-f-name" class="input-card" value="${escapeHtmlRc(d.name)}" placeholder="e.g. Veggie salad" style="width:100%; margin-bottom:24px;" />
      <div style="font-size:12px; font-weight:600; color:#8B9BAD; margin-bottom:8px;">Ingredients</div>
      <div style="position:relative; margin-bottom:12px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; left:14px; top:50%; transform:translateY(-50%);"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>
        <input id="rc-ing-search" class="input-card" value="${escapeHtmlRc(d.ingSearch)}" placeholder="Search your items…" style="width:100%; padding:11px 14px 11px 40px;" />
      </div>
      ${resultsBoxHtml}
      ${d.ingredients.length > 0 ? `<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:24px;">${ingRowsHtml}</div>` : ''}
      ${totalsHtml}
      ${renderTagChipsEditor(d)}
    `;
  }

  return `
    <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:24px 34px 18px; border-bottom:1px solid #2A3A4A;">
        <span class="modal-title" style="font-size:19px;">${isItem ? (isEdit ? 'Edit item' : 'Add item') : (isEdit ? 'Edit recipe' : 'Create recipe')}</span>
        <div data-action="close-panel" class="icon-btn" style="width:34px; height:34px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </div>
      </div>
      <div style="flex:1; min-height:0; overflow-y:auto; padding:24px 34px;">
        ${bodyHtml}
      </div>
      <div style="display:flex; gap:10px; padding:16px 34px 20px; border-top:1px solid #2A3A4A;">
        <button class="btn-primary" style="flex:1;" data-action="${isItem ? 'save-item' : 'save-recipe'}" ${ctaEnabled ? '' : 'disabled'}>${ctaLabel}</button>
        ${isEdit ? `<button data-action="ask-delete" data-type="${isItem ? 'item' : 'recipe'}" data-id="${panel.id}" data-name="${escapeHtmlRc(d.name)}" class="btn-delete-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
          Delete
        </button>` : ''}
      </div>
    </div>
  `;
}

function renderPanelOverlay() {
  const panel = rcState.panel;
  if (!panel) return '';
  let innerHtml;
  if (panel.mode === 'detail') innerHtml = renderDetailPanel(panel);
  else innerHtml = renderFormPanel(panel);

  return `
    <div class="modal-overlay" data-action="overlay-click">
      <div style="position:relative; width:100%; max-width:640px; max-height:88vh; background:#1C2733; border:1px solid #2A3A4A; border-radius:22px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,0.55);" data-stop="1">
        ${innerHtml}
      </div>
    </div>
  `;
}

function renderConfirmDelete() {
  const c = rcState.confirmDelete;
  if (!c) return '';
  const body = c.type === 'item'
    ? 'This will remove it from your library. Any recipes using this item will be marked as broken.'
    : 'This will remove the recipe from your library.';
  return `
    <div class="modal-overlay" style="z-index:80;" data-action="cancel-delete">
      <div style="width:100%; max-width:420px; background:#1C2733; border:1px solid #2A3A4A; border-radius:18px; padding:26px; box-shadow:0 30px 80px rgba(0,0,0,0.55);" data-stop="1">
        <div style="font-size:18px; font-weight:600; color:#E8EDF2; margin-bottom:10px;">Delete ${escapeHtmlRc(c.name)}?</div>
        <div style="font-size:14px; color:#8B9BAD; line-height:1.55; margin-bottom:24px;">${body}</div>
        <div style="display:flex; gap:10px;">
          <button data-action="cancel-delete" class="btn-ghost" style="flex:1;">Cancel</button>
          <button data-action="confirm-delete" class="btn-confirm-delete" style="flex:1;">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function renderRecipes() {
  const app = document.getElementById('app');
  const focusInfo = captureFocusRc();
  const isItems = rcState.tab === 'items';

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-content">
        ${renderNavRc()}
        ${renderTopBar(isItems)}
        ${renderGridAndEmpty(isItems)}
      </div>
      ${renderPanelOverlay()}
      ${renderConfirmDelete()}
      <input type="file" id="rc-photo-input" accept="image/*" style="display:none;" />
    </div>
  `;

  restoreFocusRc(focusInfo);
}

const RC_FOCUS_IDS = ['rc-search', 'rc-f-name', 'rc-f-kcal', 'rc-f-protein', 'rc-f-fat', 'rc-f-carbs', 'rc-ing-search', 'rc-new-tag'];
function captureFocusRc() {
  const el = document.activeElement;
  if (!el) return null;
  if (RC_FOCUS_IDS.includes(el.id)) return { id: el.id, selStart: el.selectionStart, selEnd: el.selectionEnd };
  if (el.classList.contains('rc-ing-gram')) return { cls: true, idx: el.dataset.idx, selStart: el.selectionStart, selEnd: el.selectionEnd };
  return null;
}
function restoreFocusRc(info) {
  if (!info) return;
  let el = null;
  if (info.cls) el = document.querySelector(`.rc-ing-gram[data-idx="${info.idx}"]`);
  else el = document.getElementById(info.id);
  if (el) {
    el.focus();
    try { el.setSelectionRange(info.selStart, info.selEnd); } catch (e) {}
  }
}

/* ============ Event delegation ============ */

document.addEventListener('click', (e) => {
  // clicking directly on the dimmed overlay backdrop (not inside the panel box) closes it
  if (e.target.dataset.action === 'overlay-click') { closePanelRc(); return; }
  if (e.target.dataset.action === 'cancel-delete' && !e.target.closest('[data-stop]')) { cancelDelete(); return; }

  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  const type = target.dataset.type;

  switch (action) {
    case 'set-tab': setTabRc(target.dataset.tab); break;
    case 'set-tag': setRcState({ activeTag: target.dataset.tag }); break;
    case 'add-primary': openForm(rcState.tab === 'items' ? 'item' : 'recipe', null); break;
    case 'open-detail': openDetail(type, id); break;
    case 'toggle-fav':
      if (type === 'item') Data.toggleItemFavourite(id); else Data.toggleRecipeFavourite(id);
      renderRecipes();
      break;
    case 'close-panel': closePanelRc(); break;
    case 'edit-from-detail': openForm(type, id); break;
    case 'ask-delete': askDelete(type, id, target.dataset.name); break;
    case 'cancel-delete': cancelDelete(); break;
    case 'confirm-delete': doDelete(); break;
    case 'toggle-draft-tag': toggleDraftTag(target.dataset.tag); break;
    case 'start-tag': patchDraft({ addingTag: true }); break;
    case 'commit-tag': commitNewTag(); break;
    case 'pick-ingredient': addIngredient(id); break;
    case 'pick-replace': doReplace(rcState.panel.draft.replacing, id); break;
    case 'start-replace': startReplace(Number(target.dataset.idx)); break;
    case 'remove-ingredient': removeIngredient(Number(target.dataset.idx)); break;
    case 'save-item': if (!target.disabled) saveItem(); break;
    case 'save-recipe': if (!target.disabled) saveRecipe(); break;
    case 'upload-photo':
      triggerPhotoUpload(target.dataset.target === 'form' ? { kind: 'form' } : { kind: 'card', type, id });
      break;
    case 'remove-photo': removeCardPhoto(type, id); break;
    case 'remove-form-photo': patchDraft({ imageUrl: null }); break;
  }
});

document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'rc-search') { rcState.search = e.target.value; renderRecipes(); return; }
  if (id === 'rc-f-name') { patchDraft({ name: e.target.value }); return; }
  if (id === 'rc-f-kcal') { patchDraft({ kcal: cleanNumRc(e.target.value) }); return; }
  if (id === 'rc-f-protein') { patchDraft({ protein: cleanNumRc(e.target.value) }); return; }
  if (id === 'rc-f-fat') { patchDraft({ fat: cleanNumRc(e.target.value) }); return; }
  if (id === 'rc-f-carbs') { patchDraft({ carbs: cleanNumRc(e.target.value) }); return; }
  if (id === 'rc-ing-search') { patchDraft({ ingSearch: e.target.value }); return; }
  if (id === 'rc-new-tag') { patchDraft({ newTag: e.target.value }); return; }
  if (e.target.classList.contains('rc-ing-gram')) { setIngGrams(Number(e.target.dataset.idx), e.target.value); return; }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'rc-sort') {
    rcState.sort = e.target.value;
    renderRecipes();
  } else if (e.target.id === 'rc-photo-input') {
    applyPhotoFile(e.target.files && e.target.files[0]);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'rc-new-tag' && e.key === 'Enter') {
    commitNewTag();
  }
});

renderRecipes();
Data.ready().then(renderRecipes);
