/* ============ Portia — local data layer ============ */
/* Only this file reads/writes storage. All pages go through the functions below. */

const STORAGE_KEY = 'portia-data';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedData() {
  // kcal/protein/fat/carbs below are per-100g; wholeG is the typical "whole portion" size
  // used by the Today/Week "Whole / Half / Custom" portion picker.
  const items = [
    { id: 'chicken', name: 'Grilled chicken breast', kcal: 165, protein: 31, fat: 3.6, carbs: 0, wholeG: 200, tags: ['High protein', 'Meat'], imageUrl: null, createdAt: '2026-06-01' },
    { id: 'brownrice', name: 'Brown rice', kcal: 120, protein: 2.7, fat: 0.9, carbs: 25, wholeG: 150, tags: ['Grains', 'Vegetarian'], imageUrl: null, createdAt: '2026-06-01' },
    { id: 'yogurt', name: 'Greek yogurt', kcal: 59, protein: 10, fat: 0.4, carbs: 3.6, wholeG: 170, tags: ['High protein', 'Dairy'], imageUrl: null, createdAt: '2026-06-02' },
    { id: 'berries', name: 'Mixed berries', kcal: 50, protein: 1, fat: 0.3, carbs: 12, wholeG: 100, tags: ['Fruit', 'Vegetarian'], imageUrl: null, createdAt: '2026-06-02' },
    { id: 'salmon', name: 'Salmon fillet', kcal: 187, protein: 20, fat: 11, carbs: 0, wholeG: 150, tags: ['High protein', 'Fish'], imageUrl: null, createdAt: '2026-06-03' },
    { id: 'avocado', name: 'Avocado', kcal: 160, protein: 2, fat: 15, carbs: 9, wholeG: 100, tags: ['Healthy fats', 'Vegetarian'], imageUrl: null, createdAt: '2026-06-03' },
    { id: 'quinoa', name: 'Quinoa', kcal: 147, protein: 5.4, fat: 2.4, carbs: 26, wholeG: 150, tags: ['Grains', 'Vegetarian'], imageUrl: null, createdAt: '2026-06-04' },
    { id: 'eggs', name: 'Boiled eggs', kcal: 140, protein: 13, fat: 9.5, carbs: 1.1, wholeG: 100, tags: ['High protein'], imageUrl: null, createdAt: '2026-06-04' },
    { id: 'almonds', name: 'Almonds', kcal: 567, protein: 21, fat: 49, carbs: 20, wholeG: 30, tags: ['Healthy fats', 'Snack'], imageUrl: null, createdAt: '2026-06-05' },
    { id: 'banana', name: 'Banana', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, wholeG: 120, tags: ['Fruit', 'Snack'], imageUrl: null, createdAt: '2026-06-05' },
    { id: 'cottage', name: 'Cottage cheese', kcal: 87, protein: 13, fat: 2.3, carbs: 4.3, wholeG: 150, tags: ['High protein', 'Dairy'], imageUrl: null, createdAt: '2026-06-06' },
    { id: 'sweetpotato', name: 'Sweet potato', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, wholeG: 150, tags: ['Grains', 'Vegetarian'], imageUrl: null, createdAt: '2026-06-06' },
  ];

  const recipes = [
    {
      id: 'recipe-bowl',
      name: 'Chicken & rice bowl',
      ingredients: [
        { itemId: 'chicken', grams: 200 },
        { itemId: 'brownrice', grams: 150 },
        { itemId: 'avocado', grams: 60 },
      ],
      tags: ['High protein', 'Meat'],
      imageUrl: null,
      createdAt: '2026-06-10',
    },
    {
      id: 'recipe-breakfast',
      name: 'Berry yogurt bowl',
      ingredients: [
        { itemId: 'yogurt', grams: 170 },
        { itemId: 'berries', grams: 100 },
        { itemId: 'almonds', grams: 15 },
      ],
      tags: ['Vegetarian', 'High protein'],
      imageUrl: null,
      createdAt: '2026-06-11',
    },
  ];

  const today = new Date().toISOString().slice(0, 10);

  const logs = [
    {
      date: today,
      slot: 'breakfast',
      entries: [
        { itemId: 'yogurt', portion: 'whole', grams: 170, kcal: 100, protein: 17 },
        { itemId: 'berries', portion: 'whole', grams: 100, kcal: 50, protein: 1 },
      ],
    },
    {
      date: today,
      slot: 'lunch',
      entries: [
        { itemId: 'chicken', portion: 'whole', grams: 200, kcal: 330, protein: 62 },
        { itemId: 'quinoa', portion: 'half', grams: 75, kcal: 110, protein: 4 },
      ],
    },
  ]; // kcal/protein here are pre-computed absolutes for these grams, consistent with items' per-100g rates

  // a little extra history/future so the Week tab has past (logged), today, and planned (future) days to show
  function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const yesterday = offsetDate(-1);
  const twoDaysAgo = offsetDate(-2);
  const tomorrow = offsetDate(1);
  const dayAfterTomorrow = offsetDate(2);

  logs.push(
    { date: yesterday, slot: 'breakfast', entries: [
      { itemId: 'yogurt', portion: 'whole', grams: 170, kcal: 100, protein: 17 },
      { itemId: 'berries', portion: 'whole', grams: 100, kcal: 50, protein: 1 },
    ] },
    { date: yesterday, slot: 'lunch', entries: [
      { itemId: 'chicken', portion: 'whole', grams: 200, kcal: 330, protein: 62 },
      { itemId: 'brownrice', portion: 'whole', grams: 150, kcal: 180, protein: 4 },
    ] },
    { date: yesterday, slot: 'snack', entries: [
      { itemId: 'almonds', portion: 'whole', grams: 30, kcal: 170, protein: 6 },
    ] },
    { date: yesterday, slot: 'dinner', entries: [
      { itemId: 'salmon', portion: 'whole', grams: 150, kcal: 281, protein: 30 },
      { itemId: 'sweetpotato', portion: 'whole', grams: 150, kcal: 129, protein: 2 },
    ] },

    { date: twoDaysAgo, slot: 'breakfast', entries: [
      { itemId: 'eggs', portion: 'whole', grams: 100, kcal: 140, protein: 13 },
      { itemId: 'avocado', portion: 'whole', grams: 100, kcal: 160, protein: 2 },
    ] },
    { date: twoDaysAgo, slot: 'lunch', entries: [
      { itemId: 'quinoa', portion: 'whole', grams: 150, kcal: 221, protein: 8 },
      { itemId: 'chicken', portion: 'whole', grams: 200, kcal: 330, protein: 62 },
    ] },
    { date: twoDaysAgo, slot: 'snack', entries: [
      { itemId: 'banana', portion: 'whole', grams: 120, kcal: 107, protein: 1 },
    ] },
    { date: twoDaysAgo, slot: 'dinner', entries: [
      { itemId: 'cottage', portion: 'whole', grams: 150, kcal: 131, protein: 20 },
      { itemId: 'sweetpotato', portion: 'whole', grams: 150, kcal: 129, protein: 2 },
    ] },

    { date: tomorrow, slot: 'breakfast', entries: [
      { itemId: 'yogurt', portion: 'whole', grams: 170, kcal: 100, protein: 17 },
      { itemId: 'banana', portion: 'whole', grams: 120, kcal: 107, protein: 1 },
    ] },
    { date: tomorrow, slot: 'lunch', entries: [
      { itemId: 'salmon', portion: 'whole', grams: 150, kcal: 281, protein: 30 },
      { itemId: 'brownrice', portion: 'whole', grams: 150, kcal: 180, protein: 4 },
    ] },

    { date: dayAfterTomorrow, slot: 'breakfast', entries: [
      { itemId: 'almonds', portion: 'whole', grams: 30, kcal: 170, protein: 6 },
      { itemId: 'berries', portion: 'whole', grams: 100, kcal: 50, protein: 1 },
    ] },
  );

  // biweekly points ending today, oldest to newest
  const weightSeries = [76.0, 75.5, 75.1, 74.6, 74.3, 73.8, 73.4, 73.1, 72.7, 72.4, 72.1, 72.0];
  const weight = weightSeries.map((value, i) => ({
    date: offsetDate(-(weightSeries.length - 1 - i) * 14),
    value,
  }));

  const goals = {
    calorieTarget: 1300,
    proteinTarget: 90,
    weightTarget: 68,
    weightStart: 76,
    waistCurrent: 65,
    waistStart: 72,
    waistTarget: 65,
    hipsCurrent: null,
    hipsStart: null,
    hipsTarget: null,
  };

  const streak = {
    currentStreak: 7,
    bestStreak: 23,
    lastLoggedDate: today,
    totalDaysTracked: 42,
  };

  return { items, recipes, logs, weight, goals, streak, dayLocks: {} };
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.dayLocks) parsed.dayLocks = {};
      return parsed;
    } catch (e) {
      // fall through to reseed
    }
  }
  const seeded = seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    const newItem = { ...item, id: uid('item'), createdAt: new Date().toISOString().slice(0, 10) };
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

  // ---- recipes ----
  getRecipes() {
    return loadData().recipes;
  },
  getRecipeById(id) {
    return loadData().recipes.find((r) => r.id === id) || null;
  },
  addRecipe(recipe) {
    const data = loadData();
    const newRecipe = { ...recipe, id: uid('recipe'), createdAt: new Date().toISOString().slice(0, 10) };
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
  deleteRecipe(id) {
    const data = loadData();
    data.recipes = data.recipes.filter((r) => r.id !== id);
    saveData(data);
  },

  // ---- logs ----
  getLogsForDate(date) {
    return loadData().logs.filter((l) => l.date === date);
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
    const log = { date, slot, entries };
    if (idx === -1) data.logs.push(log);
    else data.logs[idx] = log;
    saveData(data);
    return log;
  },
  clearLogForSlot(date, slot) {
    this.setLogForSlot(date, slot, []);
  },

  // ---- weight ----
  getWeightEntries() {
    return loadData().weight;
  },
  addWeightEntry(entry) {
    const data = loadData();
    data.weight.push(entry);
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
};
