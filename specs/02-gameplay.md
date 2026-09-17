# 02 — Gameplay

Covers the classic core plus endless/demon-lord run structure in a
top-down room, with the tactical spell layer. Boon/spell effects live in
[03-powerups.md](./03-powerups.md).

## Core loop

1. Start screen → run starts at incursion 1 with base wizard (bolt + no spell equipped).
2. Normal incursion: banish all demons before any crosses the ward line.
3. Draft screen (pick 1 of 3: boon or spell) → next incursion.
4. Every 5th incursion is a demon lord fight instead of a formation.
5. Death (ward HP depleted or demons breach the ward line) → game-over
   screen with score and high score.

No victory screen in v1 — the run is endless.

## Arena

Top-down room viewed from above. The **portal** spans the north end where
demons enter; the **ward line** sits near the south end in front of the
wizard's starting ground. The wizard roams the whole room interior with
8-way movement (portal mouth excluded), casting north. Reference space stays
960×540; portrait rooms narrow (see 04).

## Entities

- **Wizard:** moves 8-way across the whole room interior, casts northward. Base stats: speed 260 px/s
  (at 960×540 reference), cast interval 0.35s, 1 bolt, 3 ward HP,
  mana 100 with regen 8/s plus a small trickle per banish (see Mana).
- **Demon:** formation entering from the portal, sidling across the room
  and stepping south on edge hit. Direct classic equivalents, same stats:
  - `imp` (= grunt: 1 HP, slow hellfire), `cackler` (= weaver: 1 HP, sine drift),
    `brute` (= tank: 3 HP, slow), `bat` (= dart: 1 HP, fast swoop on later incursions).
- **Hellfire bolt:** demon projectile flying south, 1 damage to the wizard on hit.
- **Wizard bolt:** northbound spell; variants (spread, skulls, sunbeam,
  familiar bolts) defined in `03-powerups.md`.
- **Rune pillars:** destructible cover. 3 pillars, pixel-damage (or HP-cell)
  model — implementation detail, but must block both sides' projectiles.
  Demon lord fights have no pillars (or they are restored — pick one at build).
- **Demon lord:** large multi-HP boss with 2–3 attack patterns (hellfire
  spread, aimed burst, summon minions or sweeping beam telegraph). One demon
  lord type in v1 is acceptable; patterns scale with lord tier.

## Mana, spells, tactical pause

- **Mana + cooldowns:** active spells cost mana and trigger a per-spell
  cooldown. Casting with insufficient mana or on cooldown fails with a
  `mana-empty` cue (no lockout). Numbers per spell in 03.
- **Slots:** 1 active spell slot in v1 (architect for 2). Base bolt always fires.
- **Hold (v1 spell):** auto-north zone — a rune circle projected ahead of the
  wizard that roots normal demons (bosses: 50% slow, never rooted) for its
  duration. Lets the wizard pin one group while clearing another.
  Zone shape/size/duration in 03. No aimed placement in v1.
- **Tactical pause:** full freeze of demons, projectiles, timers, mana, and
  cooldowns. Manual (`P`/`Esc`/button), automatic on blur/draft. No
  order-queueing while paused in v1 — pause is for planning and breaks.
- **Equipment/discount hooks (later):** cost, cooldown, and regen must be
  computed through multipliers (`costMult`, `cdMult`, `regenMult`, default 1.0)
  so future boons/equipment can discount them without refactoring.

## Incursions and difficulty

- Normal incursion composition scales: rows 4→6, columns 8→11, new types unlock
  (cackler i2+, bat i4+, brute i3+).
- Reference scaling (tunable):
  - horde drift speed: `base * (1 + 0.06 * incursion)`, plus classic
    speed-up as the formation thins.
  - demon fire rate: interval `max(0.25s, 0.9s - 0.04s * incursion)`.
  - demon lord HP: `60 + 25 * lordTier`, lord contact/bolt damage 1.
- Ward line: if any demon crosses it, the run ends immediately (classic breach rule),
  even if the wizard is roaming north. North roaming risks contact damage and
  encirclement — tune `bat` swoops and contact damage if portal-camping dominates.

## Damage and lives

- Ward HP model, not one-hit lives: base 3 HP, Ward boon adds max HP (see 03).
- Brief invulnerability (1s) + blink after taking a hit.
- No continues in v1.

## Scoring

- Displayed as **souls banished**; stored as numeric `score` in code:
  imp 10, cackler 20, bat 30, brute 50, demon lord 500 × tier.
- Incursion-clear bonus: `25 * incursion`.
- No-hit incursion bonus: +50% clear bonus (encourages skilled play).
- Score persists only for the run; best goes to `localStorage` (see 06).

## Archetypes (designed-for-later)

An `archetype` extension point only: starting kit + draft weighting + 1 passive
(e.g. Warden: +control duration; Pyromancer: +splash; Chronomancer: −cooldowns).
No v1 content. Gameplay must not hardcode "one wizard" — read starting
stats through the archetype default.
