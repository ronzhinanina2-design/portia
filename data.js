/* ============ Portia — local data layer ============ */
/* Only this file reads/writes storage. All pages go through the functions below. */

const STORAGE_KEY = 'portia-data';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Master tag vocabulary shared across Today/Week/Recipes. Items and recipes
// reference these by id (`tagIds`) instead of storing their own free-text
// tag strings, so renaming/merging/deleting a tag in one place cascades
// everywhere it's used instead of requiring a find-and-replace per record.
// Breakfast/Lunch/Dinner/Snack double as the slot tags randomize (week.js)
// filters on — see portia-randomize-rules-cc-brief.md.
const DEFAULT_TAG_NAMES = ['High protein', 'Vegetarian', 'Grains', 'Fruit', 'Dairy', 'Snack', 'Meat', 'Fish', 'Healthy fats', 'Breakfast', 'Lunch', 'Dinner', 'Garnish'];

// Deterministic (not random) so independently migrating the same tag name on
// two unsynced devices converges on the same id instead of creating two rows
// for "Vegetarian" that only merge back into one after the next sync.
function tagIdForName(name) {
  const slug = String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `tag-${slug || 'untitled'}`;
}
function makeTag(name, createdAt) {
  return { id: tagIdForName(name), name: String(name).trim(), createdAt: createdAt || new Date().toISOString().slice(0, 10) };
}
function defaultTags() {
  const now = new Date().toISOString().slice(0, 10);
  return DEFAULT_TAG_NAMES.map((name) => makeTag(name, now));
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

  return { items, recipes, logs, weight, waist, hips, goals, streak, dayLocks: {}, waterLogs: {}, waterStreak, proteinStreak, deletedIds: [], tags: defaultTags() };
}

// One-time upgrade from free-text `tags: string[]` on each item/recipe (plus
// the interim shared-vocabulary `tags: string[]` on the data root) to a
// master `tags` table of {id, name} rows referenced by `tagIds` on items and
// recipes. Detected by shape — old data has string entries where the new
// shape has tag objects — so it's safe to run on every load; it's a no-op
// once everything's already migrated.
function migrateTagsIfNeeded(parsed) {
  const rootNeedsMigration = (parsed.tags || []).some((t) => typeof t === 'string');
  // Keyed off missing `tagIds` rather than presence of `tags` — a record can
  // legitimately carry both (e.g. a `tags` string array kept around for an
  // older deployed frontend that hasn't picked up the new schema yet), and
  // re-migrating an already-migrated record would silently overwrite any
  // rename/merge done since via the tag ids, since it re-derives tagIds from
  // the (now stale) free-text strings.
  const recordsNeedMigration = [...(parsed.items || []), ...(parsed.recipes || [])].some((r) => !Array.isArray(r.tagIds));
  if (!rootNeedsMigration && !recordsNeedMigration) {
    (parsed.items || []).forEach((i) => { if (!i.tagIds) i.tagIds = []; });
    (parsed.recipes || []).forEach((r) => { if (!r.tagIds) r.tagIds = []; });
    if (!parsed.tags) parsed.tags = [];
    return;
  }

  // normalized name -> { original casing -> { count, lastCreatedAt } }, so
  // duplicates that only differ by case/whitespace collapse into one tag,
  // keeping whichever original casing was most common (tie: most recent).
  const variantsByNorm = new Map();
  const recordTag = (raw, createdAt) => {
    const name = String(raw || '').trim();
    if (!name) return;
    const norm = name.toLowerCase();
    if (!variantsByNorm.has(norm)) variantsByNorm.set(norm, new Map());
    const variants = variantsByNorm.get(norm);
    const v = variants.get(name) || { count: 0, lastCreatedAt: '' };
    v.count += 1;
    if ((createdAt || '') > v.lastCreatedAt) v.lastCreatedAt = createdAt || '';
    variants.set(name, v);
  };
  [...(parsed.items || []), ...(parsed.recipes || [])].forEach((r) => {
    (r.tags || []).forEach((t) => recordTag(t, r.createdAt));
  });
  (parsed.tags || []).forEach((t) => { if (typeof t === 'string') recordTag(t, ''); });

  const normToTag = new Map();
  const mergeLog = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  variantsByNorm.forEach((variants, norm) => {
    let bestName = null, bestCount = -1, bestDate = '';
    const allNames = [];
    variants.forEach((v, name) => {
      allNames.push(name);
      if (v.count > bestCount || (v.count === bestCount && v.lastCreatedAt >= bestDate)) {
        bestCount = v.count; bestDate = v.lastCreatedAt; bestName = name;
      }
    });
    normToTag.set(norm, makeTag(bestName, todayIso));
    if (allNames.length > 1) mergeLog.push(`  "${allNames.join('", "')}" -> "${bestName}"`);
  });

  const mapRecordTags = (list) => {
    (list || []).forEach((r) => {
      const ids = [];
      (r.tags || []).forEach((raw) => {
        const name = String(raw || '').trim();
        if (!name) return;
        const tag = normToTag.get(name.toLowerCase());
        if (tag && !ids.includes(tag.id)) ids.push(tag.id);
      });
      r.tagIds = ids;
      delete r.tags;
    });
  };
  mapRecordTags(parsed.items);
  mapRecordTags(parsed.recipes);
  parsed.tags = Array.from(normToTag.values());

  if (mergeLog.length) {
    console.log('[Portia] Tag migration merged duplicate tags:\n' + mergeLog.join('\n'));
  } else {
    console.log(`[Portia] Tag migration complete — ${parsed.tags.length} tags moved to id-based references.`);
  }
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

// Brings any parsed/pulled data object up to the current shape. Applied to
// both localStorage reads and remote pulls so mergeRemoteAndLocal can always
// assume every field it touches exists, regardless of which device or how
// old the copy is.
function normalizeData(parsed) {
  if (!parsed.dayLocks) parsed.dayLocks = {};
  if (!parsed.waterLogs) parsed.waterLogs = {};
  if (!parsed.waterStreak) parsed.waterStreak = { currentStreak: 0, bestStreak: 0, lastMetDate: null };
  if (!parsed.proteinStreak) parsed.proteinStreak = { currentStreak: 0, bestStreak: 0, lastMetDate: null };
  if (!parsed.deletedIds) parsed.deletedIds = [];
  if (parsed.goals && parsed.goals.waterTarget == null) parsed.goals.waterTarget = 2000;
  migrateMeasureHistory(parsed);
  migrateTagsIfNeeded(parsed);
  // Base slot logs used to be created without an id (only "extra" logs added
  // via "Add meal" got one). Merge needs every log addressable by a stable
  // key, so backfill one here rather than special-casing id-less logs.
  (parsed.logs || []).forEach((l) => { if (!l.id) l.id = uid('log'); });
  return parsed;
}

function mergeById(remoteList, localList, deletedIds) {
  const map = new Map();
  (remoteList || []).forEach((e) => { if (!deletedIds.has(e.id)) map.set(e.id, e); });
  (localList || []).forEach((e) => { if (!deletedIds.has(e.id)) map.set(e.id, e); });
  return Array.from(map.values());
}

function mergeDated(remoteList, localList) {
  const map = new Map();
  (remoteList || []).forEach((e) => map.set(e.date, e));
  (localList || []).forEach((e) => map.set(e.date, e));
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Combines this device's local cache with whatever another device has
// already pushed to Supabase. The old sync compared timestamps and had
// whichever side was "newer" overwrite the other wholesale — so saving from
// one device could silently erase an addition made from another device in
// between syncs (e.g. an item added on mobile, then wiped out by the next
// save from a desktop tab that never re-pulled). Merging entity collections
// by id/date instead means concurrent additions from both devices survive.
// Deletions are tracked in deletedIds so a delete on one device isn't
// resurrected by a stale copy still holding that record on the other.
function mergeRemoteAndLocal(remote, local) {
  const deletedIds = new Set([...(remote.deletedIds || []), ...(local.deletedIds || [])]);
  return {
    items: mergeById(remote.items, local.items, deletedIds),
    recipes: mergeById(remote.recipes, local.recipes, deletedIds),
    logs: mergeById(remote.logs, local.logs, deletedIds),
    weight: mergeDated(remote.weight, local.weight),
    waist: mergeDated(remote.waist, local.waist),
    hips: mergeDated(remote.hips, local.hips),
    dayLocks: { ...remote.dayLocks, ...local.dayLocks },
    waterLogs: { ...remote.waterLogs, ...local.waterLogs },
    goals: { ...remote.goals, ...local.goals },
    streak: { ...remote.streak, ...local.streak },
    waterStreak: { ...remote.waterStreak, ...local.waterStreak },
    proteinStreak: { ...remote.proteinStreak, ...local.proteinStreak },
    tags: mergeById(remote.tags, local.tags, deletedIds),
    deletedIds: Array.from(deletedIds),
  };
}

function readLocalOrSeed() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return normalizeData(JSON.parse(raw));
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

// Plain unconditional write — only safe when there's no existing row to race
// against (first-ever bootstrap). Any push that could be racing another
// device's concurrent write must go through pushWithRetry instead.
function pushToRemote(data, ts) {
  if (!supabaseClient) return Promise.resolve();
  const updatedAt = new Date(ts || Date.now()).toISOString();
  return supabaseClient
    .from('app_data')
    .upsert({ id: APP_DATA_ROW_ID, data, updated_at: updatedAt })
    .then(({ error }) => { if (error) console.warn('Supabase push failed', error); })
    .catch((e) => console.warn('Supabase push failed', e));
}

async function fetchRemoteRow() {
  const { data: row, error } = await supabaseClient
    .from('app_data')
    .select('data, updated_at')
    .eq('id', APP_DATA_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  return { data: normalizeData(row.data), updatedAt: row.updated_at };
}

// Pulls the latest remote row, merges it with `baseline` (the local change
// this call is responsible for landing), and writes back — but only if the
// row's updated_at still matches what we just read. If another device wrote
// in between, the conditional UPDATE affects zero rows (rather than
// clobbering that write), and we loop: re-pull (now including the other
// device's change), re-merge baseline into it, and try again. Without this,
// two devices writing within the same pull-merge-push window both compute
// their "merged" result from the same stale remote snapshot, and whichever
// upserts last silently overwrites the other's addition — permanently,
// since the losing device's own local cache then gets overwritten with that
// same stale-merge result. This is the root cause of items added on one
// device never appearing on another even after a reload.
async function pushWithRetry(baseline) {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let merged = baseline;
    let expectedUpdatedAt = null;
    let remoteData = null;
    try {
      const remote = await fetchRemoteRow();
      if (remote) {
        merged = mergeRemoteAndLocal(remote.data, baseline);
        expectedUpdatedAt = remote.updatedAt;
        remoteData = remote.data;
      }
    } catch (e) {
      console.warn('Supabase pull-before-push failed, pushing local as-is', e);
    }

    cache = merged;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      // localStorage has a small per-origin quota (~5MB) and the blob embeds
      // every uploaded photo as base64, so it can throw QuotaExceededError
      // once enough photos pile up. Don't let that stop the Supabase push.
      console.warn('localStorage save failed (quota?), relying on Supabase', e);
    }

    if (remoteData && JSON.stringify(merged) === JSON.stringify(remoteData)) {
      return; // nothing local to contribute — skip the round trip
    }

    const now = new Date().toISOString();
    if (expectedUpdatedAt == null) {
      // No row existed yet (or the pull failed) — nothing to race against.
      await pushToRemote(merged, Date.now());
      return;
    }

    const { data: rows, error } = await supabaseClient
      .from('app_data')
      .update({ data: merged, updated_at: now })
      .eq('id', APP_DATA_ROW_ID)
      .eq('updated_at', expectedUpdatedAt)
      .select('id');
    if (error) {
      console.warn('Supabase push failed', error);
      return;
    }
    if (rows && rows.length > 0) return; // conditional update landed
    // else: updated_at had already moved (another device won the race) —
    // loop and re-merge against the newer remote state.
  }
  console.warn('Supabase push gave up after repeated concurrent-write conflicts; local change is saved and will sync on the next write.');
}

async function syncFromRemote() {
  if (!supabaseClient) { resolveReady(); return; }
  try {
    await pushWithRetry(cache);
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

// Every write is queued through this chain so concurrent saves (e.g. several
// Data.* calls in quick succession) pull-merge-push one at a time in order,
// instead of racing separate fetch/upsert pairs against each other. This
// only serializes writes within this tab — pushWithRetry's compare-and-swap
// is what protects against a concurrent write from a different device/tab.
let pushChain = Promise.resolve();

function mergeAndPush() {
  const baseline = cache;
  pushChain = pushChain.then(async () => {
    if (!supabaseClient) return;
    await pushWithRetry(baseline);
  });
  return pushChain;
}

function saveData(data) {
  cache = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed (quota?), relying on Supabase', e);
  }
  mergeAndPush();
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
    data.deletedIds.push(id);
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
    data.deletedIds.push(id);
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
      if (idx !== -1) {
        data.deletedIds.push(data.logs[idx].id);
        data.logs.splice(idx, 1);
      }
      saveData(data);
      return null;
    }
    const log = idx === -1 ? { id: uid('log'), date, slot, entries } : { ...data.logs[idx], entries };
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
      data.deletedIds.push(id);
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
    data.deletedIds.push(id);
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

  // ---- tags (master vocabulary referenced by id from items/recipes) ----
  getTags() {
    return loadData().tags;
  },
  getTagById(id) {
    return loadData().tags.find((t) => t.id === id) || null;
  },
  // scope: 'items' | 'recipes' | undefined (both). Counts are derived on
  // every call rather than cached, so they can never drift from what's
  // actually referenced.
  getTagUsageCounts(scope) {
    const data = loadData();
    const counts = new Map();
    data.tags.forEach((t) => counts.set(t.id, 0));
    const bump = (rec) => (rec.tagIds || []).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    if (scope !== 'recipes') data.items.forEach(bump);
    if (scope !== 'items') data.recipes.forEach(bump);
    return counts;
  },
  getTopTags(scope, n) {
    const counts = this.getTagUsageCounts(scope);
    return this.getTags()
      .filter((t) => (counts.get(t.id) || 0) > 0)
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))
      .slice(0, n || 8);
  },
  addTag(name) {
    const data = loadData();
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const norm = trimmed.toLowerCase();
    const existing = data.tags.find((t) => t.name.trim().toLowerCase() === norm);
    if (existing) return existing;
    const tag = makeTag(trimmed);
    data.tags.push(tag);
    saveData(data);
    return tag;
  },
  // Renaming to a name that already belongs to another tag is treated as a
  // merge (the two tags can't both exist under the same name) rather than
  // blocked, so the user doesn't have to separately discover the merge flow.
  renameTag(id, name) {
    const data = loadData();
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const norm = trimmed.toLowerCase();
    const collision = data.tags.find((t) => t.id !== id && t.name.trim().toLowerCase() === norm);
    if (collision) return this.mergeTags(id, collision.id, collision.name);
    const idx = data.tags.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    data.tags[idx] = { ...data.tags[idx], name: trimmed };
    saveData(data);
    return data.tags[idx];
  },
  mergeTags(loserId, winnerId, survivingName) {
    if (loserId === winnerId) return null;
    const data = loadData();
    const winnerIdx = data.tags.findIndex((t) => t.id === winnerId);
    if (winnerIdx === -1) return null;
    const repoint = (list) => list.forEach((rec) => {
      if (!rec.tagIds || !rec.tagIds.includes(loserId)) return;
      const ids = rec.tagIds.filter((x) => x !== loserId);
      if (!ids.includes(winnerId)) ids.push(winnerId);
      rec.tagIds = ids;
    });
    repoint(data.items);
    repoint(data.recipes);
    data.tags[winnerIdx] = { ...data.tags[winnerIdx], name: (survivingName || data.tags[winnerIdx].name).trim() };
    data.tags = data.tags.filter((t) => t.id !== loserId);
    data.deletedIds.push(loserId);
    saveData(data);
    return data.tags[winnerIdx];
  },
  deleteTag(id) {
    const data = loadData();
    const strip = (list) => list.forEach((rec) => { if (rec.tagIds) rec.tagIds = rec.tagIds.filter((x) => x !== id); });
    strip(data.items);
    strip(data.recipes);
    data.tags = data.tags.filter((t) => t.id !== id);
    data.deletedIds.push(id);
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
