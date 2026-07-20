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
const DEFAULT_TAG_NAMES = ['High protein', 'Vegetarian', 'Grains', 'Fruit', 'Dairy', 'Snack', 'Meat', 'Fish', 'Healthy fats'];

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

/* ============ Demo mock library ============ */
/* Transcribed from portia-demo-mock-library.md. Macros are per 100g unless an
   item carries wholeG (a natural single-unit weight — e.g. 1 egg, 1 tbsp oil)
   in which case the source figure was per-unit and has been scaled to a
   per-100g rate so it fits the same schema as every other item. */
const DEMO_EXTRA_TAG_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Garnish', 'Drink', 'Pasta', 'Dressing'];

function slugId(prefix, name) {
  const slug = String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${prefix}-${slug}`;
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const DEMO_RAW_ITEMS = [
  { name: 'Greek yoghurt', kcal: 63, protein: 9, fat: 3, carbs: 4, tags: ['High protein', 'Dairy', 'Breakfast'] },
  { name: 'Granola Bionova chocolate', kcal: 390, protein: 20, fat: 12, carbs: 55, tags: ['Breakfast', 'High protein', 'Grains'] },
  { name: 'Blueberries', kcal: 40, protein: 1, fat: 0, carbs: 9, tags: ['Fruit', 'Snack'] },
  { name: 'Chicken breast (oven baked)', kcal: 120, protein: 24, fat: 2, carbs: 0, tags: ['Meat', 'High protein', 'Lunch', 'Dinner'] },
  { name: 'Brown rice', kcal: 120, protein: 3, fat: 1, carbs: 25, tags: ['Grains', 'Garnish', 'Lunch', 'Dinner'] },
  { name: 'Green beans', kcal: 35, protein: 3, fat: 0, carbs: 6, tags: ['Garnish', 'Vegetarian', 'Lunch', 'Dinner'] },
  { name: 'Pasta', kcal: 130, protein: 4, fat: 1, carbs: 26, tags: ['Garnish', 'Grains', 'Vegetarian', 'Lunch', 'Dinner'] },
  { name: 'Olives', kcal: 130, protein: 2, fat: 12, carbs: 4, tags: ['Vegetarian', 'Lunch', 'Dinner'] },
  // Source gave 120 kcal / 14g fat per 1 tbsp (14g) — scaled to per-100g, wholeG keeps "whole" = 1 tbsp.
  { name: 'Olive oil', kcal: 857, protein: 0, fat: 100, carbs: 0, tags: ['Healthy fats', 'Dressing', 'Lunch', 'Dinner'], wholeG: 14 },
  { name: 'Spinach', kcal: 23, protein: 3, fat: 0, carbs: 4, tags: ['Vegetarian', 'Garnish', 'Breakfast', 'Lunch', 'Dinner'] },
  { name: 'Tomatoes', kcal: 24, protein: 1, fat: 0, carbs: 5, tags: ['Vegetarian', 'Lunch', 'Dinner', 'Garnish'] },
  { name: 'Champignons', kcal: 35, protein: 5, fat: 1, carbs: 3, tags: ['Vegetarian', 'Garnish', 'Lunch', 'Dinner'] },
  { name: 'Dark chocolate', kcal: 562, protein: 11, fat: 32, carbs: 46, tags: ['Snack'] },
  { name: 'Actimel', kcal: 72, protein: 3, fat: 2, carbs: 8, tags: ['Dairy', 'Snack', 'Drink'] },
  { name: 'Apples', kcal: 52, protein: 0, fat: 0, carbs: 14, tags: ['Fruit', 'Snack'] },
  { name: 'Strawberries', kcal: 38, protein: 1, fat: 0, carbs: 8, tags: ['Vegetarian', 'Fruit', 'Snack'] },
  { name: 'Salmon (raw)', kcal: 208, protein: 20, fat: 13, carbs: 0, tags: ['Fish', 'High protein', 'Healthy fats', 'Dinner'] },
  { name: 'Asparagus', kcal: 20, protein: 2, fat: 0, carbs: 4, tags: ['Vegetarian', 'Garnish', 'Dinner'] },
  { name: 'Turkey mince', kcal: 148, protein: 19, fat: 8, carbs: 0, tags: ['Meat', 'High protein', 'Dinner'] },
  { name: 'Cod (raw)', kcal: 82, protein: 18, fat: 1, carbs: 0, tags: ['Fish', 'High protein', 'Dinner'] },
  { name: 'Buckwheat', kcal: 110, protein: 4, fat: 1, carbs: 21, tags: ['Grains', 'Lunch', 'Dinner'] },
  { name: 'Feta cheese', kcal: 264, protein: 14, fat: 21, carbs: 4, tags: ['Dairy', 'Healthy fats', 'Lunch', 'Dinner'] },
  { name: 'Black coffee', kcal: 2, protein: 0, fat: 0, carbs: 0, tags: ['Drink', 'Breakfast'] },
  { name: 'Mixed vegetables', kcal: 35, protein: 2, fat: 0, carbs: 7, tags: ['Vegetarian', 'Garnish', 'Lunch', 'Dinner'] },
  { name: 'Tomato sauce', kcal: 29, protein: 1, fat: 0, carbs: 6, tags: ['Garnish', 'Dinner'] },
  { name: 'Bell pepper', kcal: 26, protein: 1, fat: 0, carbs: 6, tags: ['Vegetarian', 'Fruit', 'Snack'] },
  { name: 'Honey', kcal: 304, protein: 0, fat: 0, carbs: 82, tags: ['Snack'] },
  { name: 'Walnuts', kcal: 654, protein: 15, fat: 65, carbs: 14, tags: ['Healthy fats', 'Snack'] },
  { name: 'Cottage cheese', kcal: 98, protein: 11, fat: 4, carbs: 3, tags: ['High protein', 'Dairy', 'Breakfast'] },
  // Source gave 78 kcal / 6g protein per egg (~50g) — scaled to per-100g, wholeG keeps "whole" = 1 egg.
  { name: 'Eggs', kcal: 156, protein: 12, fat: 10, carbs: 2, tags: ['High protein', 'Breakfast'], wholeG: 50 },
  { name: 'Dried apricots', kcal: 241, protein: 3, fat: 0, carbs: 63, tags: ['Fruit', 'Snack'] },
  { name: 'Almonds', kcal: 579, protein: 21, fat: 50, carbs: 22, tags: ['Healthy fats', 'Snack'] },
  { name: 'Kefir', kcal: 41, protein: 3, fat: 1, carbs: 4, tags: ['Dairy', 'Drink', 'Breakfast', 'Snack'] },
  { name: 'Rice crackers', kcal: 387, protein: 7, fat: 3, carbs: 81, tags: ['Snack', 'Grains'] },
  { name: 'Shrimp (cooked)', kcal: 99, protein: 24, fat: 0, carbs: 0, tags: ['Fish', 'High protein', 'Lunch', 'Dinner'] },
];

const DEMO_RAW_RECIPES = [
  { name: 'Greek yoghurt with blueberries', tags: ['High protein', 'Healthy fats', 'Fruit', 'Dairy', 'Breakfast'], ingredients: [['Granola Bionova chocolate', 35], ['Greek yoghurt', 100], ['Blueberries', 25]] },
  { name: 'Cottage cheese bowl with honey & walnuts', tags: ['High protein', 'Dairy', 'Breakfast', 'Healthy fats'], ingredients: [['Cottage cheese', 150], ['Honey', 15], ['Walnuts', 15]] },
  { name: 'Scrambled eggs with spinach and tomatoes', tags: ['High protein', 'Breakfast', 'Vegetarian'], ingredients: [['Eggs', 100], ['Spinach', 50], ['Tomatoes', 50]] },
  { name: 'Chicken breast with brown rice and green beans', tags: ['High protein', 'Meat', 'Grains', 'Lunch', 'Dinner'], ingredients: [['Chicken breast (oven baked)', 150], ['Brown rice', 100], ['Green beans', 100]] },
  { name: 'Pasta with shrimp & olives', tags: ['Lunch', 'Dinner', 'Fish', 'Pasta'], ingredients: [['Pasta', 60], ['Shrimp (cooked)', 50], ['Olives', 50], ['Olive oil', 14], ['Feta cheese', 10]] },
  { name: 'Buckwheat with chicken and vegetables', tags: ['High protein', 'Meat', 'Grains', 'Lunch', 'Dinner'], ingredients: [['Buckwheat', 150], ['Chicken breast (oven baked)', 120], ['Mixed vegetables', 100]] },
  { name: 'Veggie salad with feta', tags: ['Vegetarian', 'Dairy', 'Healthy fats', 'Lunch', 'Dinner'], ingredients: [['Mixed vegetables', 150], ['Feta cheese', 40], ['Olive oil', 10]] },
  { name: 'Salmon with roasted asparagus', tags: ['High protein', 'Fish', 'Healthy fats', 'Dinner'], ingredients: [['Salmon (raw)', 150], ['Asparagus', 150], ['Olive oil', 10]] },
  { name: 'Turkey meatballs in tomato sauce', tags: ['High protein', 'Meat', 'Dinner'], ingredients: [['Turkey mince', 200], ['Tomato sauce', 100]] },
  { name: 'Shrimp stir-fry with vegetables', tags: ['High protein', 'Fish', 'Lunch', 'Dinner'], ingredients: [['Shrimp (cooked)', 150], ['Mixed vegetables', 150], ['Olive oil', 10]] },
  { name: 'Baked cod with roasted vegetables', tags: ['High protein', 'Fish', 'Dinner'], ingredients: [['Cod (raw)', 180], ['Mixed vegetables', 150], ['Olive oil', 10]] },
  { name: 'Chicken breast with green beans and champignons', tags: ['High protein', 'Meat', 'Garnish', 'Lunch', 'Dinner'], ingredients: [['Chicken breast (oven baked)', 500], ['Champignons', 400], ['Green beans', 400], ['Spinach', 100]] },
];

// Filenames in /demo/assets are named to match the item/recipe id exactly
// (e.g. item-almonds.jpeg, recipe-veggie-salad-with-feta.jpeg), so a photo
// resolves automatically once dropped in — no per-item wiring needed.
const DEMO_ASSET_EXT = {
  'item-almonds': 'jpeg',
  'item-apples': 'jpeg',
  'item-asparagus': 'jpeg',
  'item-bell-pepper': 'jpeg',
  'item-blueberries': 'jpeg',
  'item-brown-rice': 'jpeg',
  'item-buckwheat': 'jpeg',
  'item-champignons': 'jpeg',
  'item-greek-yoghurt': 'jpeg',
  'item-green-beans': 'jpeg',
  'item-spinach': 'jpeg',
  'item-strawberries': 'jpeg',
  'item-tomatoes': 'avif',
  'item-walnuts': 'jpeg',
  'recipe-baked-cod-with-roasted-vegetables': 'jpeg',
  'recipe-buckwheat-with-chicken-and-vegetables': 'jpeg',
  'recipe-chicken-breast-with-green-beans-and-champignons': 'jpg',
  'recipe-cottage-cheese-bowl-with-honey-walnuts': 'jpeg',
  'recipe-greek-yoghurt-with-blueberries': 'jpeg',
  'recipe-pasta-with-shrimp-olives': 'jpeg',
  'recipe-salmon-with-roasted-asparagus': 'jpeg',
  'recipe-scrambled-eggs-with-spinach-and-tomatoes': 'webp',
  'recipe-turkey-meatballs-in-tomato-sauce': 'jpeg',
  'recipe-veggie-salad-with-feta': 'jpeg',
};
function demoAssetUrl(id) {
  const ext = DEMO_ASSET_EXT[id];
  return ext ? `assets/${id}.${ext}` : '';
}

function buildDemoLibrary(tagByName) {
  const createdAt = isoDaysAgo(21);
  const items = DEMO_RAW_ITEMS.map((raw) => {
    const id = slugId('item', raw.name);
    return {
      id,
      name: raw.name,
      kcal: raw.kcal,
      protein: raw.protein,
      fat: raw.fat,
      carbs: raw.carbs,
      tagIds: raw.tags.map((t) => tagByName.get(t).id),
      wholeG: raw.wholeG || 100,
      favourite: false,
      imageUrl: demoAssetUrl(id),
      createdAt,
    };
  });
  const itemByName = new Map(items.map((it) => [it.name, it]));
  const recipes = DEMO_RAW_RECIPES.map((raw) => {
    const id = slugId('recipe', raw.name);
    return {
      id,
      name: raw.name,
      ingredients: raw.ingredients.map(([itemName, grams]) => ({ itemId: itemByName.get(itemName).id, grams })),
      tagIds: raw.tags.map((t) => tagByName.get(t).id),
      favourite: false,
      imageUrl: demoAssetUrl(id),
      createdAt,
    };
  });
  return { items, recipes };
}

// Mirrors recipeTotals()/calc() in today.js/week.js so seeded log entries carry
// the same kcal/protein a real "log meal" pass through the UI would compute.
function demoRecipeTotals(recipe, itemsById) {
  let kcal = 0, protein = 0, grams = 0;
  recipe.ingredients.forEach((ing) => {
    const it = itemsById.get(ing.itemId);
    kcal += Math.round((it.kcal * ing.grams) / 100);
    protein += Math.round((it.protein * ing.grams) / 100);
    grams += ing.grams;
  });
  return { kcal, protein, grams };
}

function demoEntryForItem(item, grams) {
  const wholeG = item.wholeG || 100;
  const portion = grams === wholeG ? 'whole' : grams === wholeG / 2 ? 'half' : 'custom';
  return { itemId: item.id, portion, grams, kcal: Math.round((item.kcal * grams) / 100), protein: Math.round((item.protein * grams) / 100) };
}

function demoEntryForRecipe(recipe, itemsById) {
  const t = demoRecipeTotals(recipe, itemsById);
  return { itemId: recipe.id, portion: 'whole', grams: t.grams, kcal: t.kcal, protein: t.protein };
}

function buildDemoLogs(items, recipes) {
  const itemsById = new Map(items.map((it) => [it.id, it]));
  const itemByName = new Map(items.map((it) => [it.name, it]));
  const recipeByName = new Map(recipes.map((r) => [r.name, r]));
  const rec = (name) => demoEntryForRecipe(recipeByName.get(name), itemsById);
  const item = (name, grams) => demoEntryForItem(itemByName.get(name), grams);

  const days = [
    { daysAgo: 4, breakfast: rec('Greek yoghurt with blueberries'), lunch: rec('Chicken breast with brown rice and green beans'), snack: item('Apples', 150), dinner: rec('Salmon with roasted asparagus') },
    { daysAgo: 3, breakfast: rec('Cottage cheese bowl with honey & walnuts'), lunch: rec('Buckwheat with chicken and vegetables'), snack: item('Almonds', 30), dinner: rec('Turkey meatballs in tomato sauce') },
    { daysAgo: 2, breakfast: rec('Scrambled eggs with spinach and tomatoes'), lunch: rec('Baked cod with roasted vegetables'), snack: item('Dark chocolate', 20), dinner: rec('Veggie salad with feta') },
    { daysAgo: 1, breakfast: rec('Greek yoghurt with blueberries'), lunch: rec('Shrimp stir-fry with vegetables'), snack: item('Strawberries', 120), dinner: rec('Pasta with shrimp & olives') },
    { daysAgo: 0, breakfast: rec('Cottage cheese bowl with honey & walnuts'), lunch: rec('Chicken breast with brown rice and green beans') },
  ];

  const logs = [];
  days.forEach((day) => {
    const date = isoDaysAgo(day.daysAgo);
    ['breakfast', 'lunch', 'snack', 'dinner'].forEach((slot) => {
      if (!day[slot]) return;
      logs.push({ id: uid('log'), date, slot, entries: [day[slot]] });
    });
  });
  return logs;
}

function seedData() {
  const tags = [...defaultTags(), ...DEMO_EXTRA_TAG_NAMES.map((n) => makeTag(n, isoDaysAgo(21)))];
  const tagByName = new Map(tags.map((t) => [t.name, t]));

  const { items, recipes } = buildDemoLibrary(tagByName);
  const logs = buildDemoLogs(items, recipes);

  const weight = [];
  upsertDatedEntry(weight, isoDaysAgo(21), 76.0);
  upsertDatedEntry(weight, isoDaysAgo(14), 75.4);
  upsertDatedEntry(weight, isoDaysAgo(7), 74.8);
  upsertDatedEntry(weight, isoDaysAgo(1), 74.2);

  const waist = [];
  upsertDatedEntry(waist, isoDaysAgo(14), 72.0);
  upsertDatedEntry(waist, isoDaysAgo(7), 70.5);
  upsertDatedEntry(waist, isoDaysAgo(1), 69.2);

  const hips = [];
  upsertDatedEntry(hips, isoDaysAgo(14), 98.0);
  upsertDatedEntry(hips, isoDaysAgo(7), 97.2);
  upsertDatedEntry(hips, isoDaysAgo(1), 96.4);

  const goals = {
    calorieTarget: 1300,
    proteinTarget: 90,
    weightTarget: 68,
    weightStart: 76,
    waistStart: 72,
    waistTarget: 65,
    hipsStart: 98,
    hipsTarget: 92,
    waterTarget: 2000,
  };

  const streak = {
    currentStreak: 4,
    bestStreak: 4,
    lastLoggedDate: isoDaysAgo(1),
    totalDaysTracked: 4,
  };

  const waterStreak = {
    currentStreak: 0,
    bestStreak: 0,
    lastMetDate: null,
  };

  // currentStreak >= 7 so the "Protein Pro" milestone shows unlocked, per the
  // demo brief's Progress-tab seed spec.
  const proteinStreak = {
    currentStreak: 7,
    bestStreak: 7,
    lastMetDate: isoDaysAgo(1),
  };

  const waterLogs = { [isoDaysAgo(0)]: 800 };

  return { items, recipes, logs, weight, waist, hips, goals, streak, dayLocks: {}, waterLogs, waterStreak, proteinStreak, deletedIds: [], tags };
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

// Demo build: always disconnected from Supabase, regardless of the URL/key
// above, so a visitor never sees or merges into Nina's real app_data row.
const supabaseClient = null;

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
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return normalizeData(JSON.parse(raw));
    } catch (e) {
      // fall through to reseed
    }
  }
  const seeded = seedData();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

let cache = readLocalOrSeed();

let resolveReady;
const readyPromise = new Promise((resolve) => { resolveReady = resolve; });

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
    .select('data')
    .eq('id', APP_DATA_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return row && row.data ? normalizeData(row.data) : null;
}

async function syncFromRemote() {
  if (!supabaseClient) { resolveReady(); return; }
  try {
    const remoteData = await fetchRemoteRow();
    if (remoteData) {
      const merged = mergeRemoteAndLocal(remoteData, cache);
      cache = merged;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      // Only push back if merging actually pulled in something new — avoids
      // an upsert on every single page load when nothing changed.
      if (JSON.stringify(merged) !== JSON.stringify(remoteData)) {
        await pushToRemote(merged, Date.now());
      }
    } else {
      await pushToRemote(cache, Date.now());
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

// Every write is queued through this chain so concurrent saves (e.g. several
// Data.* calls in quick succession) pull-merge-push one at a time in order,
// instead of racing separate fetch/upsert pairs against each other.
let pushChain = Promise.resolve();

function mergeAndPush() {
  pushChain = pushChain.then(async () => {
    if (!supabaseClient) return;
    let merged = cache;
    try {
      const remoteData = await fetchRemoteRow();
      if (remoteData) merged = mergeRemoteAndLocal(remoteData, cache);
    } catch (e) {
      console.warn('Supabase pull-before-push failed, pushing local as-is', e);
    }
    const now = Date.now();
    cache = merged;
    // localStorage has a small per-origin quota (~5MB) and the blob embeds
    // every uploaded photo as base64, so it can throw QuotaExceededError
    // once enough photos pile up. Don't let that stop the Supabase push.
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn('localStorage save failed (quota?), relying on Supabase', e);
    }
    await pushToRemote(merged, now);
  });
  return pushChain;
}

function saveData(data) {
  cache = data;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
