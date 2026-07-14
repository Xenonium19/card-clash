// ============ BATTLE ENGINE ============

let B = null; // active battle

const DEPLOYS_PER_TURN = 2;
const HERO_HP = 100;

function makeUnit(heroId, fusion, gearId, power) {
  const h = HERO_BY_ID[heroId];
  const st = computeStats(heroId, fusion, gearId, power);
  return { heroId, name: h.name, emoji: h.emoji, level: h.level, rarity: h.rarity,
           dmg: st.dmg, hp: st.hp, maxHp: st.hp, cd: h.cd };
}

function makeSide(units) {
  return {
    hp: HERO_HP, maxHp: HERO_HP,
    board: { 1: [null, null], 2: [null, null], 3: [null, null] },
    bench: units.map(u => ({ unit: u, cdLeft: 0, onBoard: false })),
  };
}

// Random enemy deck: 6 distinct heroes up to a max rarity (index into RARITY_ORDER)
function randomEnemyDeck(maxRarityIdx) {
  const weights = { common: 30, uncommon: 22, rare: 16, epic: 9, elite: 5, legendary: 2, event: 1, mythical: 0.5 };
  const pool = HEROES.filter(h => RARITY_ORDER.indexOf(h.rarity) <= maxRarityIdx);
  const picked = [];
  while (picked.length < 6 && picked.length < pool.length) {
    const avail = pool.filter(h => !picked.includes(h.id));
    const total = avail.reduce((s, h) => s + weights[h.rarity], 0);
    let r = Math.random() * total;
    for (const h of avail) { r -= weights[h.rarity]; if (r <= 0) { picked.push(h.id); break; } }
  }
  return picked;
}

function requireDeck() {
  if (deckReady()) return true;
  showModal(`<h2>Deck incomplete</h2><p>You need 6 heroes in your deck. Go to the <b>Battle</b> tab to build it.</p><button class="btn" onclick="closeModal()">OK</button>`);
  return false;
}

// cfg: { title, mode, power, maxRarityIdx, enemyDeck?, rewards:{gold,gems,tokens,heroId,gear}, floor?, stage? }
function startBattle(cfg) {
  if (!requireDeck()) return;
  const pUnits = S.deck.map(id => makeUnit(id, S.collection[id].fusion, S.collection[id].gear, 1));
  const eIds = cfg.enemyDeck || randomEnemyDeck(cfg.maxRarityIdx != null ? cfg.maxRarityIdx : 5);
  const eUnits = eIds.map(id => makeUnit(id, 0, null, cfg.power));
  B = { cfg, turn: 1, deploysLeft: DEPLOYS_PER_TURN, selected: null, log: [], over: false,
        player: makeSide(pUnits), enemy: makeSide(eUnits) };
  blog(`⚔️ ${cfg.title} — battle begins!`);
  aiDeploy(2);
  showScreen('battle');
  renderBattle();
}

function blog(msg) { B.log.push(msg); }

function livingUnits(side) {
  const arr = [];
  for (const lvl of [1, 2, 3]) for (const u of side.board[lvl]) if (u) arr.push(u);
  return arr;
}

function emptySlots(side, level) {
  const out = [];
  side.board[level].forEach((u, i) => { if (!u) out.push(i); });
  return out;
}

// ---- deployment ----

function selectBench(i) {
  if (!B || B.over) return;
  const e = B.player.bench[i];
  if (e.onBoard || e.cdLeft > 0 || B.deploysLeft <= 0) return;
  B.selected = (B.selected === i) ? null : i;
  renderBattle();
}

function deployTo(level, slot) {
  if (!B || B.over || B.selected == null) return;
  const e = B.player.bench[B.selected];
  if (e.unit.level !== level || B.player.board[level][slot]) return;
  const u = Object.assign({}, e.unit, { hp: e.unit.maxHp });
  B.player.board[level][slot] = u;
  e.onBoard = true;
  e.boardRef = u;
  B.deploysLeft--;
  B.selected = null;
  blog(`You deploy ${u.emoji} ${u.name}.`);
  renderBattle();
}

function aiDeploy(n) {
  let deployed = 0;
  while (deployed < n) {
    const options = B.enemy.bench.filter(e => !e.onBoard && e.cdLeft === 0 && emptySlots(B.enemy, e.unit.level).length > 0);
    if (options.length === 0) break;
    // AI prefers its strongest available hero
    options.sort((a, b) => (b.unit.dmg + b.unit.maxHp) - (a.unit.dmg + a.unit.maxHp));
    const e = options[0];
    const slots = emptySlots(B.enemy, e.unit.level);
    const u = Object.assign({}, e.unit, { hp: e.unit.maxHp });
    B.enemy.board[e.unit.level][slots[0]] = u;
    e.onBoard = true;
    e.boardRef = u;
    blog(`Enemy deploys ${u.emoji} ${u.name}.`);
    deployed++;
  }
}

function killUnit(side, u) {
  for (const lvl of [1, 2, 3]) {
    side.board[lvl].forEach((b, i) => { if (b === u) side.board[lvl][i] = null; });
  }
  const e = side.bench.find(e => e.boardRef === u);
  if (e) { e.onBoard = false; e.boardRef = null; e.cdLeft = u.cd; }
}

// ---- combat ----
// Lv1/Lv2 attackers hit the frontmost occupied enemy row; Lv3 (ranged) can hit anyone.
// With no enemy units on the board, attacks hit the enemy hero directly.

function doAttacks(att, def, defName) {
  for (const u of livingUnits(att)) {
    if (B.over) return;
    if (u.hp <= 0) continue;
    const targets = livingUnits(def);
    if (targets.length === 0) {
      def.hp -= u.dmg;
      blog(`${u.emoji} ${u.name} hits the ${defName} hero for ${u.dmg}!`);
    } else {
      let pool;
      if (u.level === 3) pool = targets;
      else {
        const front = Math.min(...targets.map(t => t.level));
        pool = targets.filter(t => t.level === front);
      }
      const t = pool[Math.floor(Math.random() * pool.length)];
      t.hp -= u.dmg;
      blog(`${u.emoji} ${u.name} → ${t.emoji} ${t.name} for ${u.dmg}.`);
      if (t.hp <= 0) { killUnit(def, t); blog(`💥 ${t.emoji} ${t.name} is defeated!`); }
    }
    if (def.hp <= 0) { def.hp = 0; B.over = true; return; }
  }
}

function endTurn() {
  if (!B || B.over) return;
  doAttacks(B.player, B.enemy, 'enemy');
  if (B.enemy.hp <= 0) { renderBattle(); return winBattle(); }
  aiDeploy(DEPLOYS_PER_TURN);
  doAttacks(B.enemy, B.player, 'your');
  if (B.player.hp <= 0) { renderBattle(); return loseBattle(); }
  for (const side of [B.player, B.enemy])
    for (const e of side.bench) if (!e.onBoard && e.cdLeft > 0) e.cdLeft--;
  B.turn++;
  B.deploysLeft = DEPLOYS_PER_TURN;
  B.selected = null;
  renderBattle();
}

function retreatBattle() {
  if (!B) return;
  B = null;
  switchTab(currentTab || 'battlehub');
}

// ---- outcome ----

function winBattle() {
  const cfg = B.cfg;
  const r = cfg.rewards || {};
  const lines = [];
  if (r.gold)   { S.gold += r.gold;     lines.push(`🪙 +${r.gold} gold`); }
  if (r.gems)   { S.gems += r.gems;     lines.push(`💎 +${r.gems} gems`); }
  if (r.tokens) { S.tokens += r.tokens; lines.push(`🎟️ +${r.tokens} event tokens`); }
  if (r.heroId && !S.collection[r.heroId]) {
    addHero(r.heroId);
    const h = HERO_BY_ID[r.heroId];
    lines.push(`${h.emoji} <b>${h.name}</b> joins your collection!`);
  }
  if (r.gear) {
    const g = GEARS[Math.floor(Math.random() * GEARS.length)];
    addGear(g.id);
    lines.push(`${g.emoji} Gear found: <b>${g.name}</b>`);
  }
  if (cfg.mode === 'campaign' && cfg.stage > S.campaignCleared) S.campaignCleared = cfg.stage;
  if (cfg.mode === 'tower' && cfg.floor > S.towerBest) S.towerBest = cfg.floor;
  saveGame();
  renderWallet();

  let extra = '';
  if (cfg.mode === 'tower') {
    extra = `<button class="btn btn-gold" onclick="closeModal(); startTower(${cfg.floor + 1})">Next Floor ⬆️</button> `;
  }
  showModal(`
    <h2>🏆 Victory!</h2>
    <p class="reward-lines">${lines.join('<br>') || 'No rewards this time.'}</p>
    ${extra}<button class="btn" onclick="closeModal(); battleDone()">Continue</button>
  `);
}

function loseBattle() {
  const mode = B.cfg.mode;
  showModal(`
    <h2>☠️ Defeat</h2>
    <p>Your hero has fallen. Upgrade your deck with chests, gear and fusion, then try again!</p>
    <button class="btn" onclick="closeModal(); battleDone()">Continue</button>
  `);
}

function battleDone() {
  const mode = B ? B.cfg.mode : null;
  B = null;
  const backTab = { campaign: 'campaign', tower: 'tower', daily: 'arena', weekly: 'arena', quick: 'battlehub' }[mode] || 'battlehub';
  switchTab(backTab);
}

// ---- battle rendering ----

function unitChipHTML(u, clickable, level, slot) {
  if (!u) {
    const canDrop = clickable && B.selected != null && B.player.bench[B.selected].unit.level === level;
    return `<div class="slot ${canDrop ? 'can-drop' : ''}" ${canDrop ? `onclick="deployTo(${level},${slot})"` : ''}>
      <span class="slot-hint">${canDrop ? 'Place' : ''}</span></div>`;
  }
  const pct = Math.max(0, Math.round(u.hp / u.maxHp * 100));
  return `<div class="slot filled r-${u.rarity}">
    <div class="u-emoji">${u.emoji}</div>
    <div class="u-name">${u.name}</div>
    <div class="u-hpbar"><div class="u-hpfill" style="width:${pct}%"></div></div>
    <div class="u-stats">⚔${u.dmg} ❤${u.hp}</div>
  </div>`;
}

function boardRowHTML(side, level, clickable) {
  const cells = side.board[level].map((u, i) => unitChipHTML(u, clickable, level, i)).join('');
  return `<div class="brow"><div class="brow-label">${ROW_NAMES[level]}</div><div class="brow-slots">${cells}</div></div>`;
}

function benchCardHTML(e, i) {
  const u = e.unit;
  let overlay = '';
  if (e.onBoard) overlay = `<div class="bench-overlay">ON BOARD</div>`;
  else if (e.cdLeft > 0) overlay = `<div class="bench-overlay">⏳ ${e.cdLeft}</div>`;
  const sel = B.selected === i ? 'selected' : '';
  return `<div class="bench-card r-${u.rarity} ${sel}" onclick="selectBench(${i})">
    <div class="u-emoji">${u.emoji}</div>
    <div class="u-name">${u.name}</div>
    <div class="u-stats">⚔${u.dmg} ❤${u.maxHp}</div>
    <div class="u-row">L${u.level}</div>
    ${overlay}
  </div>`;
}

function heroBarHTML(side, label) {
  const pct = Math.max(0, Math.round(side.hp / side.maxHp * 100));
  return `<div class="hero-bar">
    <span class="hero-label">${label}</span>
    <div class="hero-hp"><div class="hero-hpfill" style="width:${pct}%"></div><span class="hero-hptext">${side.hp} / ${side.maxHp}</span></div>
  </div>`;
}

function renderBattle() {
  if (!B) return;
  const el = document.getElementById('screen-battle');
  el.innerHTML = `
    <div class="battle-head">
      <span>${B.cfg.title} · Turn ${B.turn}</span>
      <button class="btn btn-small btn-danger" onclick="retreatBattle()">Retreat 🏳️</button>
    </div>
    ${heroBarHTML(B.enemy, '👹 Enemy')}
    <div class="board enemy-board">
      ${boardRowHTML(B.enemy, 3, false)}
      ${boardRowHTML(B.enemy, 2, false)}
      ${boardRowHTML(B.enemy, 1, false)}
    </div>
    <div class="board-divider">⚔️</div>
    <div class="board player-board">
      ${boardRowHTML(B.player, 1, true)}
      ${boardRowHTML(B.player, 2, true)}
      ${boardRowHTML(B.player, 3, true)}
    </div>
    ${heroBarHTML(B.player, '🙂 You')}
    <div class="battle-actions">
      <span class="deploys">Deploys left: <b>${B.deploysLeft}</b></span>
      <button class="btn btn-gold" onclick="endTurn()" ${B.over ? 'disabled' : ''}>End Turn ▶</button>
    </div>
    <div class="bench">${B.player.bench.map((e, i) => benchCardHTML(e, i)).join('')}</div>
    <div class="battle-log">${B.log.slice(-8).map(l => `<div>${l}</div>`).join('')}</div>
  `;
  const logEl = el.querySelector('.battle-log');
  logEl.scrollTop = logEl.scrollHeight;
}

// ---- mode launchers ----

function startQuick(power, gold) {
  startBattle({ title: 'Quick Battle', mode: 'quick', power, maxRarityIdx: 5, rewards: { gold } });
}

function startCampaign(stage) {
  const st = CAMPAIGN[stage - 1];
  if (!st || stage > S.campaignCleared + 1) return;
  const cleared = stage <= S.campaignCleared;
  const rewards = cleared
    ? { gold: Math.round(st.gold / 2) }
    : { gold: st.gold, gems: st.gems, heroId: st.heroReward };
  startBattle({ title: `Stage ${st.stage}: ${st.name}`, mode: 'campaign', stage,
    power: st.power, maxRarityIdx: Math.min(5, Math.ceil(stage / 2)), rewards });
}

function startTower(floor) {
  const power = 0.8 + 0.2 * (floor - 1);
  const rewards = { gold: 50 + 25 * floor };
  if (floor % 5 === 0) rewards.gems = 20;
  if (floor % 3 === 0) rewards.gear = true;
  startBattle({ title: `Tower · Floor ${floor}`, mode: 'tower', floor, power,
    maxRarityIdx: Math.min(7, 1 + Math.floor(floor / 3)), rewards });
}

function startDailyArena() {
  resetArenaIfNeeded();
  if (S.arena.dailyLeft <= 0 || !requireDeck()) return;
  S.arena.dailyLeft--; saveGame();
  startBattle({ title: 'Daily Arena', mode: 'daily', power: 1.0, maxRarityIdx: 5,
    rewards: { gold: 100, tokens: 40 } });
}

function startWeeklyArena() {
  resetArenaIfNeeded();
  if (S.arena.weeklyLeft <= 0 || !requireDeck()) return;
  S.arena.weeklyLeft--; saveGame();
  startBattle({ title: 'Weekly Arena', mode: 'weekly', power: 1.6, maxRarityIdx: 7,
    rewards: { gold: 250, tokens: 120, gems: 15 } });
}
