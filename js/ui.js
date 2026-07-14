// ============ UI: SCREENS, CARDS, MODALS ============

let currentTab = 'battlehub';

const TABS = [
  { id: 'battlehub',  label: '⚔️ Battle' },
  { id: 'campaign',   label: '🗺️ Campaign' },
  { id: 'arena',      label: '🏟️ Arena' },
  { id: 'tower',      label: '🗼 Tower' },
  { id: 'collection', label: '🃏 Collection' },
  { id: 'chests',     label: '📦 Chests' },
];

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map(t =>
    `<button class="tab ${currentTab === t.id ? 'active' : ''}" onclick="switchTab('${t.id}')">${t.label}</button>`
  ).join('');
}

function switchTab(tab) {
  B = null; // leaving a battle abandons it
  currentTab = tab;
  renderTabs();
  showScreen(tab);
  renderScreen(tab);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function renderScreen(tab) {
  ({ battlehub: renderBattleHub, campaign: renderCampaign, arena: renderArena,
     tower: renderTower, collection: renderCollection, chests: renderChests }[tab])();
  renderWallet();
}

function renderWallet() {
  document.getElementById('wallet').innerHTML =
    `<span>🪙 ${S.gold}</span><span>💎 ${S.gems}</span><span>🎟️ ${S.tokens}</span>`;
}

// ---- modals ----

function showModal(html) {
  const root = document.getElementById('modal-root');
  root.classList.remove('hidden');
  root.innerHTML = `<div class="modal-backdrop" onclick="closeModal()"></div><div class="modal">${html}</div>`;
}
function closeModal() {
  const root = document.getElementById('modal-root');
  root.classList.add('hidden');
  root.innerHTML = '';
}

// ---- card component ----

function cardHTML(heroId, opts = {}) {
  const h = HERO_BY_ID[heroId];
  const fusion = opts.fusion || 0;
  const st = computeStats(heroId, fusion, opts.gearId, 1);
  const stars = '★'.repeat(fusion) + '☆'.repeat(FUSION_MAX - fusion);
  const gear = opts.gearId ? GEAR_BY_ID[opts.gearId] : null;
  return `<div class="card r-${h.rarity} ${opts.locked ? 'locked' : ''} ${opts.small ? 'small' : ''}"
      ${opts.onclick ? `onclick="${opts.onclick}"` : ''}>
    <div class="cname">${h.name}</div>
    <div class="crow">${ROW_NAMES[h.level]} · ${RARITY_LABEL[h.rarity]}</div>
    <div class="cart">${h.emoji}</div>
    <div class="cab">${h.ability}</div>
    <div class="cstats"><span>⚔ ${st.dmg}</span><span>❤ ${st.hp}</span><span>⏳ ${h.cd}</span></div>
    ${opts.locked ? '' : `<div class="cstars">${stars}</div>`}
    <div class="cgear" title="${gear ? gear.name : 'Empty gear slot'}">${gear ? gear.emoji : '◌'}</div>
  </div>`;
}

// ============ BATTLE HUB (deck + quick battle) ============

function renderBattleHub() {
  const slots = S.deck.map((id, i) => {
    if (!id) return `<div class="deck-slot empty" onclick="openDeckPicker(${i})">＋</div>`;
    return `<div class="deck-slot">
      ${cardHTML(id, { fusion: S.collection[id].fusion, gearId: S.collection[id].gear, onclick: `openDeckPicker(${i})` })}
      <button class="slot-x" onclick="removeDeckSlot(${i})">✕</button>
    </div>`;
  }).join('');
  document.getElementById('screen-battlehub').innerHTML = `
    <h1>⚔️ Battle</h1>
    <div class="panel">
      <div class="panel-head"><h2>Your Deck (6 heroes)</h2><button class="btn btn-small" onclick="autoDeck()">Auto-fill</button></div>
      <p class="hint">Lv1 heroes fight in the melee row, Lv2 in the mid row, Lv3 in the ranged row — each row has only 2 slots, so mix your levels!</p>
      <div class="deck-grid">${slots}</div>
    </div>
    <div class="panel">
      <h2>Quick Battle</h2>
      <p class="hint">A friendly fight against a random enemy deck. Gold only — progress comes from Campaign, Arena and Tower.</p>
      <div class="btn-row">
        <button class="btn" onclick="startQuick(0.8, 40)">😊 Easy</button>
        <button class="btn" onclick="startQuick(1.2, 80)">😐 Normal</button>
        <button class="btn btn-danger" onclick="startQuick(1.8, 150)">😈 Hard</button>
      </div>
    </div>`;
}

function removeDeckSlot(i) {
  event.stopPropagation();
  S.deck[i] = null;
  saveGame();
  renderBattleHub();
}

function openDeckPicker(i) {
  const owned = Object.keys(S.collection).filter(id => !S.deck.includes(id));
  if (owned.length === 0) {
    showModal(`<h2>No heroes available</h2><p>All your owned heroes are already in the deck. Unlock more from chests, campaign and arenas!</p><button class="btn" onclick="closeModal()">OK</button>`);
    return;
  }
  owned.sort((a, b) => HERO_BY_ID[a].level - HERO_BY_ID[b].level);
  const cards = owned.map(id =>
    cardHTML(id, { fusion: S.collection[id].fusion, gearId: S.collection[id].gear, small: true, onclick: `chooseDeckHero(${i}, '${id}')` })
  ).join('');
  showModal(`<h2>Pick a hero for slot ${i + 1}</h2><div class="grid-cards modal-grid">${cards}</div>
    <button class="btn" onclick="closeModal()">Cancel</button>`);
}

function chooseDeckHero(i, heroId) {
  S.deck[i] = heroId;
  saveGame();
  closeModal();
  renderBattleHub();
}

function autoDeck() {
  const owned = Object.keys(S.collection);
  const score = id => RARITY_ORDER.indexOf(HERO_BY_ID[id].rarity) * 10 + S.collection[id].fusion;
  const deck = [];
  // aim for 2 heroes per level, strongest first
  for (const lvl of [1, 2, 3]) {
    const pool = owned.filter(id => HERO_BY_ID[id].level === lvl).sort((a, b) => score(b) - score(a));
    deck.push(...pool.slice(0, 2));
  }
  // fill leftovers with strongest remaining
  const rest = owned.filter(id => !deck.includes(id)).sort((a, b) => score(b) - score(a));
  while (deck.length < 6 && rest.length) deck.push(rest.shift());
  while (deck.length < 6) deck.push(null);
  S.deck = deck.slice(0, 6);
  saveGame();
  renderBattleHub();
}

// ============ CAMPAIGN ============

function renderCampaign() {
  const rows = CAMPAIGN.map(st => {
    const cleared = st.stage <= S.campaignCleared;
    const unlocked = st.stage <= S.campaignCleared + 1;
    const hero = st.heroReward ? HERO_BY_ID[st.heroReward] : null;
    const rewardTxt = cleared
      ? `🪙 ${Math.round(st.gold / 2)} (replay)`
      : `🪙 ${st.gold} · 💎 ${st.gems}${hero ? ` · ${hero.emoji} ${hero.name}` : ''}`;
    return `<div class="stage-row ${cleared ? 'cleared' : ''} ${unlocked ? '' : 'locked'}">
      <span class="stage-num">${cleared ? '✅' : unlocked ? '⚔️' : '🔒'}</span>
      <span class="stage-name">Stage ${st.stage} · ${st.name}</span>
      <span class="stage-reward">${rewardTxt}</span>
      ${unlocked ? `<button class="btn btn-small" onclick="startCampaign(${st.stage})">${cleared ? 'Replay' : 'Fight'}</button>` : ''}
    </div>`;
  }).join('');
  document.getElementById('screen-campaign').innerHTML = `
    <h1>🗺️ Campaign</h1>
    <p class="hint">Clear stages to earn gold, gems and unlock new heroes. Enemies get stronger every stage.</p>
    <div class="panel stage-list">${rows}</div>`;
}

// ============ ARENA ============

function renderArena() {
  resetArenaIfNeeded(); saveGame();
  document.getElementById('screen-arena').innerHTML = `
    <h1>🏟️ Arena</h1>
    <div class="event-banner">Current event: <b>${EVENT_NAME}</b> — earn 🎟️ event tokens here to open Event Chests!</div>
    <div class="panel-row">
      <div class="panel arena-panel">
        <h2>🌤️ Daily Arena</h2>
        <p class="hint">Resets every day. Rewards: 🪙 100 · 🎟️ 40 per win.</p>
        <p>Attempts left today: <b>${S.arena.dailyLeft}</b> / 3</p>
        <button class="btn btn-gold" onclick="startDailyArena()" ${S.arena.dailyLeft <= 0 ? 'disabled' : ''}>Fight</button>
      </div>
      <div class="panel arena-panel">
        <h2>🌩️ Weekly Arena</h2>
        <p class="hint">Much stronger enemies, resets weekly. Rewards: 🪙 250 · 🎟️ 120 · 💎 15 per win.</p>
        <p>Attempts left this week: <b>${S.arena.weeklyLeft}</b> / 3</p>
        <button class="btn btn-danger" onclick="startWeeklyArena()" ${S.arena.weeklyLeft <= 0 ? 'disabled' : ''}>Fight</button>
      </div>
    </div>`;
}

// ============ TOWER ============

function renderTower() {
  const next = S.towerBest + 1;
  document.getElementById('screen-tower').innerHTML = `
    <h1>🗼 The Tower</h1>
    <p class="hint">Climb as far as you can — every floor is stronger than the last. Gems every 5 floors, gear every 3 floors.</p>
    <div class="panel tower-panel">
      <div class="tower-best">Best floor: <b>${S.towerBest}</b></div>
      <button class="btn btn-gold btn-big" onclick="startTower(${next})">Challenge Floor ${next} ⬆️</button>
    </div>`;
}

// ============ COLLECTION ============

function renderCollection() {
  const sorted = HEROES.slice().sort((a, b) =>
    RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.level - b.level);
  const cards = sorted.map(h => {
    const e = S.collection[h.id];
    return e
      ? cardHTML(h.id, { fusion: e.fusion, gearId: e.gear, onclick: `showHeroDetail('${h.id}')` })
      : cardHTML(h.id, { locked: true });
  }).join('');
  const gearList = GEARS.map(g => {
    const n = S.gearInv[g.id] || 0;
    return `<span class="gear-chip ${n ? '' : 'none'}" title="${g.name}: +${g.dmg}⚔ +${g.hp}❤ (x2 on Lv${g.syn})">${g.emoji} ×${n}</span>`;
  }).join('');
  document.getElementById('screen-collection').innerHTML = `
    <h1>🃏 Collection <span class="count">${ownedCount()} / ${HEROES.length}</span></h1>
    <div class="panel"><h2>🎒 Gear bag</h2><div class="gear-bag">${gearList}</div>
    <p class="hint">Earn gear in the Tower (every 3rd floor). Click one of your heroes to equip. Gear matching the hero's level gives <b>double</b> the bonus!</p></div>
    <div class="grid-cards">${cards}</div>`;
}

function showHeroDetail(heroId) {
  const h = HERO_BY_ID[heroId];
  const e = S.collection[heroId];
  const inDeck = S.deck.includes(heroId);
  const gearRows = GEARS.map(g => {
    const n = S.gearInv[g.id] || 0;
    const syn = g.syn === h.level;
    return `<div class="gear-row">
      <span>${g.emoji} ${g.name} ${syn ? '<b class="syn">SYNERGY x2!</b>' : ''} <small>+${g.dmg}⚔ +${g.hp}❤${syn ? ' → +' + g.dmg * 2 + '⚔ +' + g.hp * 2 + '❤' : ''}</small></span>
      <span>×${n} <button class="btn btn-small" onclick="equipGearOn('${heroId}','${g.id}'); showHeroDetail('${heroId}'); " ${n <= 0 || e.gear === g.id ? 'disabled' : ''}>Equip</button></span>
    </div>`;
  }).join('');
  showModal(`
    <div class="detail-flex">
      <div class="detail-card">${cardHTML(heroId, { fusion: e.fusion, gearId: e.gear })}</div>
      <div class="detail-info">
        <h2>${h.emoji} ${h.name}</h2>
        <p>${RARITY_LABEL[h.rarity]} · ${ROW_NAMES[h.level]}</p>
        <p>Fusion: ${'★'.repeat(e.fusion)}${'☆'.repeat(FUSION_MAX - e.fusion)} <small>(+${Math.round(e.fusion * FUSION_BONUS * 100)}% stats — pull dupes from chests to fuse!)</small></p>
        <p>${inDeck ? '✅ In your deck' : 'Not in deck'}</p>
        ${e.gear ? `<button class="btn btn-small" onclick="unequipGearFrom('${heroId}'); showHeroDetail('${heroId}')">Unequip ${GEAR_BY_ID[e.gear].emoji}</button>` : ''}
      </div>
    </div>
    <h3>Gear</h3>
    <div class="gear-list">${gearRows}</div>
    <button class="btn" onclick="closeModal(); renderCollection()">Close</button>
  `);
}

// ============ CHESTS ============

function costText(cost) {
  if (cost.gold) return `🪙 ${cost.gold}`;
  if (cost.gems) return `💎 ${cost.gems}`;
  if (cost.tokens) return `🎟️ ${cost.tokens}`;
}
function canAfford(cost) {
  return (!cost.gold || S.gold >= cost.gold) && (!cost.gems || S.gems >= cost.gems) && (!cost.tokens || S.tokens >= cost.tokens);
}
function payCost(cost) {
  S.gold -= cost.gold || 0; S.gems -= cost.gems || 0; S.tokens -= cost.tokens || 0;
}

function renderChests() {
  const chests = CHESTS.map(c => {
    const total = Object.values(c.rates).reduce((a, b) => a + b, 0);
    const rates = RARITY_ORDER.filter(r => c.rates[r]).map(r =>
      `<div class="rate-row"><span class="rate-dot r-${r}"></span>${RARITY_LABEL[r]}: ${(c.rates[r] / total * 100).toFixed(1)}%</div>`).join('');
    return `<div class="panel chest-panel ${c.id === 'event' ? 'event-chest' : ''}">
      <div class="chest-emoji">${c.emoji}</div>
      <h2>${c.name}</h2>
      <details class="rates"><summary>Drop rates</summary>${rates}</details>
      <button class="btn btn-gold" onclick="openChest('${c.id}')" ${canAfford(c.cost) ? '' : 'disabled'}>Open · ${costText(c.cost)}</button>
    </div>`;
  }).join('');
  document.getElementById('screen-chests').innerHTML = `
    <h1>📦 Chests</h1>
    <div class="event-banner">Event: <b>${EVENT_NAME}</b> — Event heroes drop <b>only</b> from Event Chests and Arenas!</div>
    <p class="hint">Duplicates raise a hero's <b>fusion level</b> (+12% stats per ★). Once unlocked, a hero is yours forever.</p>
    <div class="chest-grid">${chests}</div>`;
}

function rollRarity(rates) {
  const total = Object.values(rates).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of Object.entries(rates)) { r -= w; if (r <= 0) return rarity; }
  return Object.keys(rates)[0];
}

function openChest(chestId) {
  const c = CHEST_BY_ID[chestId];
  if (!canAfford(c.cost)) return;
  payCost(c.cost);
  const rarity = rollRarity(c.rates);
  const pool = HEROES.filter(h => h.rarity === rarity);
  const hero = pool[Math.floor(Math.random() * pool.length)];
  const res = addHero(hero.id);
  saveGame();
  renderWallet();
  const e = S.collection[hero.id];
  let msg;
  if (res.result === 'new') msg = `<div class="pull-result new">✨ NEW HERO! ✨</div>`;
  else if (res.result === 'fusion') msg = `<div class="pull-result fusion">🔷 Duplicate → Fusion ★${res.fusion}!</div>`;
  else msg = `<div class="pull-result maxed">Max fusion — converted to 🪙 ${res.refund}</div>`;
  showModal(`
    <h2>${c.emoji} ${c.name}</h2>
    <div class="pull-card reveal">${cardHTML(hero.id, { fusion: e.fusion, gearId: e.gear })}</div>
    ${msg}
    <div class="btn-row">
      <button class="btn btn-gold" onclick="closeModal(); openChest('${chestId}')" ${canAfford(c.cost) ? '' : 'disabled'}>Open again · ${costText(c.cost)}</button>
      <button class="btn" onclick="closeModal(); renderChests()">Done</button>
    </div>
  `);
}
