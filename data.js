/* ============ Portia — local data layer ============ */
/* Only this file reads/writes storage. All pages go through the functions below. */

const STORAGE_KEY = 'portia-data';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Keeps a dated-entry list (weight/waist/hips) sorted ascending by date so
// "most recent" is always the last element, and overwrites same-day entries
// instead of duplicating them so backfilling an earlier date after logging
// today doesn't make the later date lose its "most recent" status.
function upsertDatedEntry(list, date, value) {
  const idx = list.findIndex((e) => e.date === date);
  if (idx !== -1) {
    list[idx] = { date, value };
  } else {
    list.push({ date, value });
    list.sort((a, b) => a.date.localeCompare(b.date));
  }
}

function seedData() {
  // Clean-slate seed — no demo items, recipes, logs, weight history, or streak.
  // calorieTarget/proteinTarget keep their documented app defaults; every other
  // goal field is null until the user sets it from the UI (Progress tab supports
  // null/empty states for all of these already).
  const items = [];
  const recipes = [];
  const logs = [];
  const weight = [];
  const waist = [];
  const hips = [];

  const goals = {
    calorieTarget: 1300,
    proteinTarget: 90,
    weightTarget: null,
    weightStart: null,
    waistStart: null,
    waistTarget: null,
    hipsStart: null,
    hipsTarget: null,
    waterTarget: 2000,
  };

  const streak = {
    currentStreak: 0,
    bestStreak: 0,
    lastLoggedDate: null,
    totalDaysTracked: 0,
  };

  const waterStreak = {
    currentStreak: 0,
    bestStreak: 0,
    lastMetDate: null,
  };

  const proteinStreak = {
    currentStreak: 0,
    bestStreak: 0,
    lastMetDate: null,
  };

  return { items, recipes, logs, weight, waist, hips, goals, streak, dayLocks: {}, waterLogs: {}, waterStreak, proteinStreak };
}

// Pre-dated-history saves stored waist/hips as a single goals.waistCurrent /
// goals.hipsCurrent number. Turns that into a one-entry dated list (dated
// today, since the original save didn't record when it happened) so older
// data doesn't need a separate migration path once waist/hips read from
// the entries list like weight already does.
function migrateMeasureHistory(parsed) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!parsed.waist) {
    const legacy = parsed.goals && parsed.goals.waistCurrent;
    parsed.waist = legacy != null ? [{ date: todayIso, value: legacy }] : [];
  }
  if (!parsed.hips) {
    const legacy = parsed.goals && parsed.goals.hipsCurrent;
    parsed.hips = legacy != null ? [{ date: todayIso, value: legacy }] : [];
  }
  if (parsed.goals) {
    delete parsed.goals.waistCurrent;
    delete parsed.goals.hipsCurrent;
  }
}

/* ============ Supabase sync ============ */
/* Single-row JSONB blob keeps the existing localStorage-shaped data model
   unchanged — every Data.* method below still just calls loadData()/saveData()
   exactly as before. localStorage remains a write-through cache so the app
   keeps working instantly and offline; Supabase is the cross-device source
   of truth that gets pushed to in the background on every write. */
const SUPABASE_URL = 'https://ijtitwrxhswqdfcquqvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdGl0d3J4aHN3cWRmY3F1cXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTU1MDAsImV4cCI6MjA5ODMzMTUwMH0.WAWmR3ixO80Hf-5Pb6QmVIbYJs7xGTzOkBmIXSRlgM8';
const APP_DATA_ROW_ID = 'main';

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function readLocalOrSeed() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.dayLocks) parsed.dayLocks = {};
      if (!parsed.waterLogs) parsed.waterLogs = {};
      if (!parsed.waterStreak) parsed.waterStreak = { currentStreak: 0, bestStreak: 0, lastMetDate: null };
      if (!parsed.proteinStreak) parsed.proteinStreak = { currentStreak: 0, bestStreak: 0, lastMetDate: null };
      if (parsed.goals && parsed.goals.waterTarget == null) parsed.goals.waterTarget = 2000;
      migrateMeasureHistory(parsed);
      return parsed;
    } catch (e) {
      // fall through to reseed
    }
  }
  const seeded = seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

let cache = readLocalOrSeed();

let resolveReady;
const readyPromise = new Promise((resolve) => { resolveReady = resolve; });

// Tracks when THIS device last wrote data, independent of whether the
// Supabase push actually landed yet. syncFromRemote() uses this to decide
// whether a pulled row is actually newer than what we already have —
// without it, a remote pull always wins, which silently destroys any local
// write whose push hasn't finished landing yet (e.g. user navigates away
// right after pressing a button, before the fire-and-forget upsert completes).
const LOCAL_UPDATED_KEY = 'portia-data-updated-at';

function localUpdatedAt() {
  return Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
}

function pushToRemote(data, ts) {
  if (!supabaseClient) return Promise.resolve();
  const updatedAt = new Date(ts || Date.now()).toISOString();
  return supabaseClient
    .from('app_data')
    .upsert({ id: APP_DATA_ROW_ID, data, updated_at: updatedAt })
    .then(({ error }) => { if (error) console.warn('Supabase push failed', error); })
    .catch((e) => console.warn('Supabase push failed', e));
}

async function syncFromRemote() {
  if (!supabaseClient) { resolveReady(); return; }
  try {
    const { data: row, error } = await supabaseClient
      .from('app_data')
      .select('data, updated_at')
      .eq('id', APP_DATA_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    if (row && row.data) {
      const remoteTs = new Date(row.updated_at).getTime();
      if (remoteTs > localUpdatedAt()) {
        cache = row.data;
        if (!cache.dayLocks) cache.dayLocks = {};
        if (!cache.waterLogs) cache.waterLogs = {};
        if (!cache.waterStreak) cache.waterStreak = { currentStreak: 0, bestStreak: 0, lastMetDate: null };
        if (!cache.proteinStreak) cache.proteinStreak = { currentStreak: 0, bestStreak: 0, lastMetDate: null };
        if (cache.goals && cache.goals.waterTarget == null) cache.goals.waterTarget = 2000;
        migrateMeasureHistory(cache);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        localStorage.setItem(LOCAL_UPDATED_KEY, String(remoteTs));
      } else {
        // Our local copy is at least as new as remote — make sure remote catches up
        // instead of letting a stale remote row silently win.
        await pushToRemote(cache, localUpdatedAt() || Date.now());
      }
    } else {
      await pushToRemote(cache, localUpdatedAt() || Date.now());
    }
  } catch (e) {
    console.warn('Supabase sync failed, using local cache', e);
  } finally {
    resolveReady();
  }
}
syncFromRemote();

function loadData() {
  return cache;
}

function saveData(data) {
  cache = data;
  const now = Date.now();
  // localStorage has a small per-origin quota (~5MB) and the blob embeds every
  // uploaded photo as base64, so it can throw QuotaExceededError once enough
  // photos pile up. If we let that throw escape here, the line below that
  // pushes to Supabase never runs — the write is lost everywhere and silently
  // disappears on next load even though the UI looked like it saved.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LOCAL_UPDATED_KEY, String(now));
  } catch (e) {
    console.warn('localStorage save failed (quota?), relying on Supabase', e);
  }
  pushToRemote(data, now);
}

const Data = {
  // ---- items ----
  getItems() {
    return loadData().items;
  },
  getItemById(id) {
    return loadData().items.find((i) => i.id === id) || null;
  },
  addItem(item) {
    const data = loadData();
    const newItem = { favourite: false, ...item, id: uid('item'), createdAt: new Date().toISOString().slice(0, 10) };
    data.items.push(newItem);
    saveData(data);
    return newItem;
  },
  updateItem(id, patch) {
    const data = loadData();
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    data.items[idx] = { ...data.items[idx], ...patch };
    saveData(data);
    return data.items[idx];
  },
  deleteItem(id) {
    const data = loadData();
    data.items = data.items.filter((i) => i.id !== id);
    saveData(data);
  },
  toggleItemFavourite(id) {
    const data = loadData();
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    data.items[idx] = { ...data.items[idx], favourite: !data.items[idx].favourite };
    saveData(data);
    return data.items[idx];
  },

  // ---- recipes ----
  getRecipes() {
    return loadData().recipes;
  },
  getRecipeById(id) {
    return loadData().recipes.find((r) => r.id === id) || null;
  },
  addRecipe(recipe) {
    const data = loadData();
    const newRecipe = { favourite: false, ...recipe, id: uid('recipe'), createdAt: new Date().toISOString().slice(0, 10) };
    data.recipes.push(newRecipe);
    saveData(data);
    return newRecipe;
  },
  updateRecipe(id, patch) {
    const data = loadData();
    const idx = data.recipes.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    data.recipes[idx] = { ...data.recipes[idx], ...patch };
    saveData(data);
    return data.recipes[idx];
  },
  toggleRecipeFavourite(id) {
    const data = loadData();
    const idx = data.recipes.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    data.recipes[idx] = { ...data.recipes[idx], favourite: !data.recipes[idx].favourite };
    saveData(data);
    return data.recipes[idx];
  },
  deleteRecipe(id) {
    const data = loadData();
    data.recipes = data.recipes.filter((r) => r.id !== id);
    saveData(data);
  },

  // ---- logs ----
  // A slot can hold multiple logs per day (the base entry plus any extras
  // added via "Add meal"). getLogForSlot/setLogForSlot/clearLogForSlot only
  // ever touch the first (oldest, i.e. base) log for that date+slot, so
  // existing call sites (Week tab planning, base slot cards) are unaffected.
  // Extra entries are addressed individually by id via addLogForSlot/
  // getLogById/updateLogById/deleteLogById.
  getLogsForDate(date) {
    return loadData().logs.filter((l) => l.date === date);
  },
  getAllLogs() {
    return loadData().logs;
  },
  getLogsForSlot(date, slot) {
    return loadData().logs.filter((l) => l.date === date && l.slot === slot);
  },
  getLogForSlot(date, slot) {
    return loadData().logs.find((l) => l.date === date && l.slot === slot) || null;
  },
  setLogForSlot(date, slot, entries) {
    const data = loadData();
    const idx = data.logs.findIndex((l) => l.date === date && l.slot === slot);
    if (!entries || entries.length === 0) {
      if (idx !== -1) data.logs.splice(idx, 1);
      saveData(data);
      return null;
    }
    const log = idx === -1 ? { date, slot, entries } : { ...data.logs[idx], entries };
    if (idx === -1) data.logs.push(log);
    else data.logs[idx] = log;
    saveData(data);
    return log;
  },
  clearLogForSlot(date, slot) {
    this.setLogForSlot(date, slot, []);
  },
  addLogForSlot(date, slot, entries) {
    const data = loadData();
    const log = { id: uid('log'), date, slot, entries };
    data.logs.push(log);
    saveData(data);
    return log;
  },
  getLogById(id) {
    return loadData().logs.find((l) => l.id === id) || null;
  },
  updateLogById(id, entries) {
    const data = loadData();
    const idx = data.logs.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    if (!entries || entries.length === 0) {
      data.logs.splice(idx, 1);
      saveData(data);
      return null;
    }
    data.logs[idx] = { ...data.logs[idx], entries };
    saveData(data);
    return data.logs[idx];
  },
  deleteLogById(id) {
    const data = loadData();
    data.logs = data.logs.filter((l) => l.id !== id);
    saveData(data);
  },

  // ---- weight ----
  getWeightEntries() {
    return loadData().weight;
  },
  addWeightEntry(entry) {
    const data = loadData();
    upsertDatedEntry(data.weight, entry.date, entry.value);
    saveData(data);
  },

  // ---- waist ----
  getWaistEntries() {
    return loadData().waist;
  },
  addWaistEntry(entry) {
    const data = loadData();
    upsertDatedEntry(data.waist, entry.date, entry.value);
    saveData(data);
  },

  // ---- hips ----
  getHipsEntries() {
    return loadData().hips;
  },
  addHipsEntry(entry) {
    const data = loadData();
    upsertDatedEntry(data.hips, entry.date, entry.value);
    saveData(data);
  },

  // ---- goals ----
  getGoals() {
    return loadData().goals;
  },
  updateGoals(patch) {
    const data = loadData();
    data.goals = { ...data.goals, ...patch };
    saveData(data);
    return data.goals;
  },

  // ---- streak ----
  getStreak() {
    return loadData().streak;
  },
  updateStreak(patch) {
    const data = loadData();
    data.streak = { ...data.streak, ...patch };
    saveData(data);
    return data.streak;
  },

  // ---- protein streak (consecutive days the protein goal was hit) ----
  getProteinStreak() {
    return loadData().proteinStreak;
  },
  updateProteinStreak(patch) {
    const data = loadData();
    data.proteinStreak = { ...data.proteinStreak, ...patch };
    saveData(data);
    return data.proteinStreak;
  },

  // ---- water ----
  getWaterForDate(date) {
    return loadData().waterLogs[date] || 0;
  },
  addWater(date, amountMl) {
    const data = loadData();
    const prevMl = data.waterLogs[date] || 0;
    const nextMl = prevMl + amountMl;
    data.waterLogs[date] = nextMl;

    const goal = data.goals.waterTarget;
    if (goal && prevMl < goal && nextMl >= goal) {
      const y = new Date(date + 'T00:00:00');
      y.setDate(y.getDate() - 1);
      const yesterday = y.toISOString().slice(0, 10);
      const ws = data.waterStreak;
      if (ws.lastMetDate !== date) {
        const nextStreak = ws.lastMetDate === yesterday ? ws.currentStreak + 1 : 1;
        data.waterStreak = {
          currentStreak: nextStreak,
          bestStreak: Math.max(ws.bestStreak, nextStreak),
          lastMetDate: date,
        };
      }
    }
    saveData(data);
    return nextMl;
  },
  getWaterGoal() {
    return loadData().goals.waterTarget;
  },
  setWaterGoal(ml) {
    const data = loadData();
    data.goals = { ...data.goals, waterTarget: ml };
    saveData(data);
    return data.goals;
  },
  getWaterStreak() {
    return loadData().waterStreak;
  },

  // ---- day lock ("Done for today") ----
  getDayLock(date) {
    return loadData().dayLocks[date] || null;
  },
  setDayLock(date, lock) {
    const data = loadData();
    data.dayLocks[date] = lock;
    saveData(data);
    return data.dayLocks[date];
  },
  clearDayLock(date) {
    const data = loadData();
    delete data.dayLocks[date];
    saveData(data);
  },

  // ---- sync ----
  ready() {
    return readyPromise;
  },
};
