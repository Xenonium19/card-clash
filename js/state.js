// ============ PLAYER SAVE STATE ============

const SAVE_KEY = 'cardclash_save_v1';
let S = null;

function defaultSave() {
  const collection = {};
  for (const id of STARTER_HEROES) collection[id] = { fusion: 0, gear: null };
  return {
    gold: 800, gems: 60, tokens: 0,
    collection,                      // heroId -> { fusion, gear }
    gearInv: {},                     // gearId -> unequipped count
    deck: STARTER_HEROES.slice(),    // 6 heroIds (or null in empty slots)
    campaignCleared: 0,
    towerBest: 0,
    arena: { dailyDate: '', dailyLeft: 3, weeklyKey: '', weeklyLeft: 3 },
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    S = raw ? Object.assign(defaultSave(), JSON.parse(raw)) : defaultSave();
  } catch (e) { S = defaultSave(); }
  resetArenaIfNeeded();
  saveGame();
}

function saveGame() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }

// ---- collection ----

function ownedCount() { return Object.keys(S.collection).length; }

// Add a hero (from chest / reward). Returns what happened for the reveal UI.
function addHero(heroId) {
  const entry = S.collection[heroId];
  if (!entry) {
    S.collection[heroId] = { fusion: 0, gear: null };
    saveGame();
    return { result: 'new' };
  }
  if (entry.fusion < FUSION_MAX) {
    entry.fusion++;
    saveGame();
    return { result: 'fusion', fusion: entry.fusion };
  }
  const refund = (RARITY_ORDER.indexOf(HERO_BY_ID[heroId].rarity) + 1) * 100;
  S.gold += refund;
  saveGame();
  return { result: 'maxed', refund };
}

// Effective battle stats for a hero: base * fusion bonus + gear (doubled on synergy level), then * power
function computeStats(heroId, fusion, gearId, power = 1) {
  const h = HERO_BY_ID[heroId];
  let dmg = h.dmg * (1 + FUSION_BONUS * (fusion || 0));
  let hp  = h.hp  * (1 + FUSION_BONUS * (fusion || 0));
  if (gearId && GEAR_BY_ID[gearId]) {
    const g = GEAR_BY_ID[gearId];
    const mult = (g.syn === h.level) ? 2 : 1;
    dmg += g.dmg * mult;
    hp  += g.hp * mult;
  }
  return { dmg: Math.round(dmg * power), hp: Math.round(hp * power) };
}

function deckReady() { return S.deck.filter(Boolean).length === 6; }

// ---- gear ----

function addGear(gearId) {
  S.gearInv[gearId] = (S.gearInv[gearId] || 0) + 1;
  saveGame();
}

function equipGearOn(heroId, gearId) {
  const entry = S.collection[heroId];
  if (!entry || (S.gearInv[gearId] || 0) <= 0) return;
  if (entry.gear) S.gearInv[entry.gear] = (S.gearInv[entry.gear] || 0) + 1;
  S.gearInv[gearId]--;
  entry.gear = gearId;
  saveGame();
}

function unequipGearFrom(heroId) {
  const entry = S.collection[heroId];
  if (!entry || !entry.gear) return;
  S.gearInv[entry.gear] = (S.gearInv[entry.gear] || 0) + 1;
  entry.gear = null;
  saveGame();
}

// ---- arena resets ----

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + week;
}

function resetArenaIfNeeded() {
  if (S.arena.dailyDate !== todayStr()) {
    S.arena.dailyDate = todayStr();
    S.arena.dailyLeft = 3;
  }
  if (S.arena.weeklyKey !== weekKey()) {
    S.arena.weeklyKey = weekKey();
    S.arena.weeklyLeft = 3;
  }
}
