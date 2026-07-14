// ============ BATTLE ENGINE ============
// Rules:
// - You bring a deck of 6-12 heroes; 6 random ones form your hand, the rest is your draw pile.
// - Playing a hero draws a new card from the deck (while any remain).
// - Dead units are gone for the whole battle (no cooldowns, no redeploys).
// - Everyone targets the frontmost occupied enemy row (Lv1 first), and within
//   that row the LOWEST-HP unit. Nobody can reach the back rows early.
// - No hero HP: you win by wiping out the enemy's board, hand and deck.

let B = null; // active battle

const DEPLOYS_PER_TURN = 3;

function makeUnit(heroId, fusion, gearId, power) {
  const h = HERO_BY_ID[heroId];
  const st = computeStats(heroId, fusion, gearId, power);
  return { heroId, name: h.name, emoji: h.emoji, art: h.art, level: h.level, rarity: h.rarity,
           dmg: st.dmg, hp: st.hp, maxHp: st.hp };
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeSide(units) {
  const deck = shuffled(units);
  const hand = deck.splice(0, HAND_SIZE);
  return { board: { 1: [null, null], 2: [null, null], 3: [null, null] }, hand, deck };
}

// Random enemy deck: up to 12 distinct heroes up to a max rarity (index into RARITY_ORDER)
function randomEnemyDeck(maxRarityIdx) {
  const weights = { common: 30, uncommon: 22, rare: 16, epic: 9, elite: 5, legendary: 2, event: 1, mythical: 0.5 };
  const pool = HEROES.filter(h => RARITY_ORDER.indexOf(h.rarity) <= maxRarityIdx);
  const picked = [];
  while (picked.length < DECK_SIZE && picked.length < pool.length) {
    const avail = pool.filter(h => !picked.includes(h.id));
    const total = avail.reduce((s, h) => s + weights[h.rarity], 0);
    let r = Math.random() * total;
    for (const h of avail) { r -= weights[h.rarity]; if (r <= 0) { picked.push(h.id); break; } }
  }
  return picked;
}

function requireDeck() {
  if (deckReady()) return true;
  showModal(`<h2>Deck incomplete</h2><p>You need at least ${DECK_MIN} heroes in your deck (up to ${DECK_SIZE}). Build it at the top of the <b>Collection</b> tab.</p><button class="btn" onclick="closeModal()">OK</button>`);
  return false;
}

// cfg: { title, mode, power, maxRarityIdx, enemyDeck?, rewards:{gold,gems,tokens,heroId,gear}, floor?, stage? }
function startBattle(cfg) {
  if (!requireDeck()) return;
  const pIds = S.deck.filter(Boolean);
  const pUnits = pIds.map(id => makeUnit(id, S.collection[id].fusion, S.collection[id].gear, 1));
  const eIds = cfg.enemyDeck || randomEnemyDeck(cfg.maxRarityIdx != null ? cfg.maxRarityIdx : 5);
  const eUnits = eIds.map(id => makeUnit(id, 0, null, cfg.power));
  B = { cfg, turn: 1, deploysLeft: DEPLOYS_PER_TURN, selected: null, log: [], over: false,
        player: makeSide(pUnits), enemy: makeSide(eUnits) };
  blog(`⚔️ ${cfg.title} — battle begins!`);
  aiDeploy(DEPLOYS_PER_TURN);
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

function sideDefeated(side) {
  return livingUnits(side).length === 0 && side.hand.length === 0 && side.deck.length === 0;
}

function drawCard(side) {
  if (side.deck.length > 0) side.hand.push(side.deck.shift());
}

// ---- deployment ----

function selectBench(i) {
  if (!B || B.over) return;
  if (B.deploysLeft <= 0) return;
  B.selected = (B.selected === i) ? null : i;
  renderBattle();
}

function deployTo(level, slot) {
  if (!B || B.over || B.selected == null) return;
  const u = B.player.hand[B.selected];
  if (!u || u.level !== level || B.player.board[level][slot]) return;
  B.player.board[level][slot] = u;
  B.player.hand.splice(B.selected, 1);
  drawCard(B.player);
  B.deploysLeft--;
  B.selected = null;
  blog(`You deploy ${u.emoji} ${u.name}.`);
  renderBattle();
}

function aiDeploy(n) {
  let deployed = 0;
  while (deployed < n) {
    const options = B.enemy.hand.filter(u => emptySlots(B.enemy, u.level).length > 0);
    if (options.length === 0) break;
    // AI plays its strongest deployable card
    options.sort((a, b) => (b.dmg + b.maxHp) - (a.dmg + a.maxHp));
    const u = options[0];
    const slots = emptySlots(B.enemy, u.level);
    B.enemy.board[u.level][slots[0]] = u;
    B.enemy.hand.splice(B.enemy.hand.indexOf(u), 1);
    drawCard(B.enemy);
    blog(`Enemy deploys ${u.emoji} ${u.name}.`);
    deployed++;
  }
}

function killUnit(side, u) {
  for (const lvl of [1, 2, 3]) {
    side.board[lvl].forEach((b, i) => { if (b === u) side.board[lvl][i] = null; });
  }
}

// ---- combat ----
// All attackers hit the frontmost occupied enemy row (lowest level first);
// within that row they focus the unit with the LOWEST current HP.

function doAttacks(att, def, attName) {
  let waited = false;
  for (const u of livingUnits(att)) {
    if (u.hp <= 0) continue; // died to nothing here, but stay safe
    const targets = livingUnits(def);
    if (targets.length === 0) { waited = true; continue; }
    const front = Math.min(...targets.map(t => t.level));
    const pool = targets.filter(t => t.level === front);
    const t = pool.reduce((low, c) => c.hp < low.hp ? c : low, pool[0]);
    t.hp -= u.dmg;
    blog(`${u.emoji} ${u.name} → ${t.emoji} ${t.name} for ${u.dmg}.`);
    if (t.hp <= 0) { killUnit(def, t); blog(`💥 ${t.emoji} ${t.name} is slain — gone for this battle!`); }
  }
  if (waited) blog(`${attName} heroes wait — no enemies in range.`);
}

function endTurn() {
  if (!B || B.over) return;
  doAttacks(B.player, B.enemy, 'Your');
  if (sideDefeated(B.enemy)) { B.over = true; renderBattle(); return winBattle(); }
  aiDeploy(DEPLOYS_PER_TURN);
  doAttacks(B.enemy, B.player, 'Enemy');
  if (sideDefeated(B.player)) { B.over = true; renderBattle(); return loseBattle(); }
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
    <p>The enemy army is wiped out!</p>
    <p class="reward-lines">${lines.join('<br>') || 'No rewards this time.'}</p>
    ${extra}<button class="btn" onclick="closeModal(); battleDone()">Continue</button>
  `);
}

function loseBattle() {
  showModal(`
    <h2>☠️ Defeat</h2>
    <p>Your whole army has fallen. Upgrade your deck with chests, gear and fusion, then try again!</p>
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
    const canDrop = clickable && !B.over && B.selected != null && B.player.hand[B.selected] && B.player.hand[B.selected].level === level;
    return `<div class="slot ${canDrop ? 'can-drop' : ''}" ${canDrop ? `onclick="deployTo(${level},${slot})"` : ''}>
      <span class="slot-hint">${canDrop ? 'Place' : ''}</span></div>`;
  }
  const pct = Math.max(0, Math.round(u.hp / u.maxHp * 100));
  return `<div class="slot filled r-${u.rarity}">
    <div class="u-emoji">${u.art ? `<img src="${u.art}" alt="${u.name}">` : u.emoji}</div>
    <div class="u-name">${u.name}</div>
    <div class="u-hpbar"><div class="u-hpfill" style="width:${pct}%"></div></div>
    <div class="u-stats">⚔${u.dmg} ❤${u.hp}</div>
  </div>`;
}

function boardRowHTML(side, level, clickable) {
  const cells = side.board[level].map((u, i) => unitChipHTML(u, clickable, level, i)).join('');
  return `<div class="brow"><div class="brow-label">${ROW_NAMES[level]}</div><div class="brow-slots">${cells}</div></div>`;
}

function benchCardHTML(u, i) {
  const sel = B.selected === i ? 'selected' : '';
  return `<div class="bench-card r-${u.rarity} ${sel}" onclick="selectBench(${i})">
    <div class="u-emoji">${u.art ? `<img src="${u.art}" alt="${u.name}">` : u.emoji}</div>
    <div class="u-name">${u.name}</div>
    <div class="u-stats">⚔${u.dmg} ❤${u.maxHp}</div>
    <div class="u-row">L${u.level}</div>
  </div>`;
}

function sideInfoHTML(side, label, extra = '') {
  return `<div class="side-info ${extra}"><b>${label}</b>
    <span>🛡 Board: ${livingUnits(side).length}</span>
    <span>🖐 Hand: ${side.hand.length}</span>
    <span>🎴 Deck: ${side.deck.length}</span></div>`;
}

function renderBattle() {
  if (!B) return;
  const el = document.getElementById('screen-battle');
  el.innerHTML = `
  <div class="battle-flex">
    <div class="battle-main">
      <div class="battle-head">
        <span>${B.cfg.title} · Turn ${B.turn}</span>
        <button class="btn btn-small btn-danger" onclick="retreatBattle()">Retreat 🏳️</button>
      </div>
      ${sideInfoHTML(B.enemy, '👹 Enemy')}
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
      <div class="battle-actions">
        ${sideInfoHTML(B.player, '🙂 You', 'inline')}
        <span class="deploys">Deploys left: <b>${B.deploysLeft}</b></span>
        <button class="btn btn-gold" onclick="endTurn()" ${B.over ? 'disabled' : ''}>End Turn ▶</button>
      </div>
      <div class="bench">${B.player.hand.map((u, i) => benchCardHTML(u, i)).join('') || '<span class="hint">Hand empty — your deck is used up!</span>'}</div>
    </div>
    <div class="battle-log">${B.log.slice(-40).map(l => `<div>${l}</div>`).join('')}</div>
  </div>`;
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
