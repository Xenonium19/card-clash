// ============ STATIC GAME DATA ============

const ROW_NAMES = { 1: 'Lv1 · Melee', 2: 'Lv2 · Mid', 3: 'Lv3 · Ranged' };

const RARITY_ORDER = ['common','uncommon','rare','epic','elite','legendary','event','mythical'];
const RARITY_LABEL = {
  common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic',
  elite:'Elite', legendary:'Legendary', event:'Event', mythical:'Mythical'
};

const EVENT_NAME = 'Solar Festival ☀️';

// level: which board row the card can be deployed to (1 melee, 2 mid, 3 ranged)
const HEROES = [
  // ---- Level 1 · Melee ----
  { id:'warrior',        name:'Warrior',          level:1, rarity:'common',    dmg:12, hp:60,  emoji:'⚔️', ability:'Cleave (soon)' },
  { id:'shieldbearer',   name:'Shield Bearer',    level:1, rarity:'common',    dmg:8,  hp:85,  emoji:'🛡️', ability:'Taunt (soon)' },
  { id:'knight',         name:'Knight',           level:1, rarity:'uncommon',  dmg:16, hp:100, emoji:'🤺', ability:'Charge (soon)' },
  { id:'berserker',      name:'Berserker',        level:1, rarity:'rare',      dmg:24, hp:110, emoji:'🪓', ability:'Rage below 50% HP (soon)' },
  { id:'paladin',        name:'Paladin',          level:1, rarity:'epic',      dmg:28, hp:150, emoji:'⚜️', ability:'Heals allies (soon)' },
  { id:'dragonknight',   name:'Dragon Knight',    level:1, rarity:'elite',     dmg:38, hp:185, emoji:'🐉', ability:'Dragon breath (soon)' },
  { id:'shadowreaper',   name:'Shadow Reaper',    level:1, rarity:'legendary', dmg:55, hp:230, emoji:'💀', ability:'Reaps souls on kill (soon)' },
  // ---- Level 2 · Mid ----
  { id:'spearman',       name:'Spearman',         level:2, rarity:'common',    dmg:11, hp:50,  emoji:'🔱', ability:'Pierce (soon)' },
  { id:'slinger',        name:'Slinger',          level:2, rarity:'common',    dmg:10, hp:45,  emoji:'🪃', ability:'Ricochet (soon)' },
  { id:'monk',           name:'Monk',             level:2, rarity:'uncommon',  dmg:14, hp:65,  emoji:'🧘', ability:'Inner peace (soon)' },
  { id:'battlemage',     name:'Battle Mage',      level:2, rarity:'rare',      dmg:22, hp:60,  emoji:'🔮', ability:'Arcane bolt (soon)' },
  { id:'witch',          name:'Witch',            level:2, rarity:'epic',      dmg:30, hp:75,  emoji:'🧙', ability:'Hex (soon)' },
  { id:'nightassassin',  name:'Night Assassin',   level:2, rarity:'elite',     dmg:42, hp:70,  emoji:'🗡️', ability:'Backstab (soon)' },
  { id:'phoenixqueen',   name:'Phoenix Queen',    level:2, rarity:'legendary', dmg:60, hp:120, emoji:'🔥', ability:'Rebirth once (soon)' },
  { id:'solarchampion',  name:'Solar Champion',   level:2, rarity:'event',     dmg:50, hp:110, emoji:'☀️', ability:'Solar flare (soon)' },
  // ---- Level 3 · Ranged ----
  { id:'archer',         name:'Archer',           level:3, rarity:'common',    dmg:13, hp:35,  emoji:'🏹', ability:'Double shot (soon)' },
  { id:'crossbowman',    name:'Crossbowman',      level:3, rarity:'common',    dmg:14, hp:32,  emoji:'🎯', ability:'Piercing bolt (soon)' },
  { id:'cannoneer',      name:'Cannoneer',        level:3, rarity:'uncommon',  dmg:20, hp:40,  emoji:'💣', ability:'Splash damage (soon)' },
  { id:'sniper',         name:'Sniper',           level:3, rarity:'rare',      dmg:30, hp:38,  emoji:'🔭', ability:'Headshot (soon)' },
  { id:'frostwizard',    name:'Frost Wizard',     level:3, rarity:'epic',      dmg:34, hp:55,  emoji:'❄️', ability:'Freeze (soon)' },
  { id:'stormcaller',    name:'Storm Caller',     level:3, rarity:'elite',     dmg:45, hp:65,  emoji:'⛈️', ability:'Chain lightning (soon)' },
  { id:'moonpriestess',  name:'Moon Priestess',   level:3, rarity:'event',     dmg:48, hp:85,  emoji:'🌙', ability:'Lunar blessing (soon)' },
  { id:'celestialdragon',name:'Celestial Dragon', level:3, rarity:'mythical',  dmg:80, hp:150, emoji:'🌌', ability:'Starfall (soon)' },
];
const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));

const STARTER_HEROES = ['warrior','shieldbearer','spearman','slinger','archer','crossbowman'];

// Gear: syn = level the gear synergizes with (effects DOUBLED on matching-level heroes)
const GEARS = [
  { id:'ironsword',   name:'Iron Sword',   emoji:'🗡️', dmg:6,  hp:0,  syn:1 },
  { id:'oakshield',   name:'Oak Shield',   emoji:'🛡️', dmg:0,  hp:25, syn:1 },
  { id:'warbanner',   name:'War Banner',   emoji:'🚩', dmg:4,  hp:12, syn:2 },
  { id:'mysticorb',   name:'Mystic Orb',   emoji:'🔮', dmg:8,  hp:0,  syn:2 },
  { id:'sniperscope', name:'Sniper Scope', emoji:'🔍', dmg:10, hp:0,  syn:3 },
  { id:'windrunes',   name:'Wind Runes',   emoji:'🌀', dmg:2,  hp:18, syn:3 },
];
const GEAR_BY_ID = Object.fromEntries(GEARS.map(g => [g.id, g]));

// Chest tiers. rates = rarity weights (relative). eventPool = can drop event heroes.
const CHESTS = [
  { id:'wooden', name:'Wooden Chest', emoji:'📦', cost:{ gold:150 },
    rates:{ common:62, uncommon:25, rare:10, epic:3 } },
  { id:'golden', name:'Golden Chest', emoji:'🎁', cost:{ gems:40 },
    rates:{ common:28, uncommon:30, rare:25, epic:12, elite:4, legendary:1 } },
  { id:'royal',  name:'Royal Chest',  emoji:'👑', cost:{ gems:120 },
    rates:{ rare:40, epic:33, elite:17, legendary:8, mythical:2 } },
  { id:'event',  name:'Event Chest',  emoji:'🌞', cost:{ tokens:80 },
    rates:{ event:20, rare:34, epic:25, elite:13, legendary:7, mythical:1 } },
];
const CHEST_BY_ID = Object.fromEntries(CHESTS.map(c => [c.id, c]));

// Campaign stages. power scales enemy stats; heroReward unlocks on first clear.
const CAMPAIGN = [
  { stage:1,  name:'Greenwood Path',   power:0.60, gold:80,  gems:10 },
  { stage:2,  name:'Old Watchtower',   power:0.75, gold:90,  gems:10, heroReward:'knight' },
  { stage:3,  name:'Misty Marsh',      power:0.90, gold:100, gems:15 },
  { stage:4,  name:'Mountain Pass',    power:1.00, gold:110, gems:15, heroReward:'monk' },
  { stage:5,  name:'Ruined Keep',      power:1.15, gold:120, gems:20 },
  { stage:6,  name:'Ember Fields',     power:1.30, gold:130, gems:20, heroReward:'cannoneer' },
  { stage:7,  name:'Frozen Hollow',    power:1.50, gold:140, gems:25 },
  { stage:8,  name:'Shadow Gate',      power:1.70, gold:150, gems:25, heroReward:'berserker' },
  { stage:9,  name:'Stormspire',       power:1.90, gold:170, gems:30 },
  { stage:10, name:'The Dark Citadel', power:2.20, gold:200, gems:40, heroReward:'battlemage' },
];

const FUSION_MAX = 5;
const FUSION_BONUS = 0.12; // +12% dmg & hp per fusion star

const DECK_SIZE = 12;  // max heroes in a deck
const DECK_MIN = 6;    // minimum heroes to start a battle
const HAND_SIZE = 6;   // cards in hand during battle; refills from deck as you play
