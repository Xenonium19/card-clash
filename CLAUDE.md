# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Card Clash" — a single-page browser card-battler in vanilla HTML/CSS/JS. No build step, no dependencies, no framework, no tests. It must keep working when opened directly from `file://`, which is why there are **no ES modules** — all JS files share the global scope via plain `<script>` tags.

## Commands

- **Run:** open `index.html` in a browser (`Start-Process index.html`). Refresh to reload changes.
- **Syntax check:** `node --check js/<file>.js` (the only automated check there is).
- **Deploy:** commit and `git push` to `main`. GitHub Pages (repo `Xenonium19/card-clash`) republishes https://xenonium19.github.io/card-clash/ automatically in ~1 minute. The game is live and shared with friends — don't push half-working states.

## Architecture

Script load order in `index.html` matters (globals must exist before use at run time):

1. `js/data.js` — static definitions: `HEROES`, `GEARS`, `CHESTS`, `CAMPAIGN`, rarity/deck/hand constants. Balance numbers live here.
2. `js/state.js` — the save: global `S`, persisted to localStorage under `cardclash_save_v1`. Also fusion/gear/collection mutations and stat math (`computeStats` = base × fusion bonus + gear, ×2 gear effect on level synergy).
3. `js/ui.js` — all non-battle screens. Everything renders by building innerHTML template strings with inline `onclick="globalFn(...)"` handlers; there is no event-listener wiring or virtual DOM. `cardHTML()` is the single card component used everywhere.
4. `js/battle.js` — battle engine around global `B` (null when not fighting), plus the battle screen renderer and mode launchers (`startCampaign`, `startTower`, arenas, quick).
5. `js/main.js` — boot (loadSave + first render).

State changes always follow: mutate `S` → `saveGame()` → re-render the affected screen (full re-render, no diffing).

## Save compatibility (important)

Real players have live saves. When changing the shape of `S`, add a migration in `loadSave()` (see the deck 6→12 padding) rather than changing `defaultSave()` alone, and don't rename `SAVE_KEY` — that wipes everyone's collection.

## Game rules that are design decisions (don't change without asking)

The owner has a specific design; these are intentional, not accidents:

- Board: 3 rows ("levels") per side, 2 slots each. Lv1 melee / Lv2 mid / Lv3 ranged; a card can only deploy to its own level's row.
- Combat: ALL attackers hit the frontmost occupied enemy row (Lv1 first — back rows are unreachable while lower rows live), and within it the lowest-HP unit. Dead units are gone for the whole battle. No cooldowns. No hero HP — a side loses when board + hand + deck are all empty.
- Deck 12 max / 6 min (min exists because new accounts own only the 6 starters); hand of 6 refills from the deck as cards are played; 3 deploys per turn per side.
- Rarity ladder and border colors: common grey, uncommon light green, rare blue, epic purple, elite red, legendary gold, event (themed per event, currently "Solar Festival"), mythical (animated prism + shine). CSS classes `r-<rarity>`.
- Event heroes drop only from Event Chests and arena rewards. Unlocked heroes are permanent; dupes raise fusion (max 5 stars, +12%/star).
- Hero special abilities are placeholder text only ("(soon)") — not implemented yet.
- Drop rates, stats and economy numbers are placeholders awaiting balance passes.

## Card art

Heroes use emoji unless they have an `art:` field (e.g. Warrior). Pipeline for new art the owner uploads into `assets/heroes/`: resize to 512px-wide JPEG quality 85 (System.Drawing via PowerShell works), save as `assets/heroes/<heroId>.jpg`, move the original into `assets/heroes/originals/` (gitignored — keep multi-MB files out of the repo), add `art:` to the hero in data.js. The owner's art has a frame + title baked in; CSS crops toward the face (`object-position: 50% 22%`).
