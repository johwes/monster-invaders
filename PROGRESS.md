# Progress — Wizard's Ward

Sessions: read `AGENTS.md` + specs first, then work the **topmost unchecked item** below.
Check it off when its branch is merged. Update a spec file only if you changed
locked behavior or a tuning decision — progress logging goes here, not in specs.

- [ ] 0. Scaffold: Vite + TS, `src/` layout per `specs/06-tech-architecture.md`, pick `incursion/demon` vs `wave/invader` naming, record exact `npm install / dev / build / preview` in AGENTS.md.
- [ ] 1. Loop + canvas: fixed-timestep 60 Hz update w/ clamped delta, 960×540 reference units, DPR-capped-at-2 scaling, screen shell (menu/run/gameover placeholders).
- [ ] 2. Run state machine: menu → incursion → draft → … → gameover; tactical pause (`P`/`Esc`/button, blur auto-pause) freezing demons/projectiles/mana/cooldowns/particles.
- [ ] 3. Input: normalized `intent { moveX, moveY, casting, beam, spell1 }` abstraction; keyboard (WASD/arrows, Q/E spell, 1/2/3 draft, P/Esc pause, M mute); touch floating joystick (default) + relative-drag fallback, spell/pause buttons.
- [ ] 4. Room + combatants: whole-room wizard movement (260 px/s, diagonals normalized), auto-cast north (0.35s interval), demon formation entry/movement (imp first), hellfire south, rune pillars blocking both sides.
- [ ] 5. Damage + scoring: circle/AABB collision, 3 ward HP + 1s blink invulnerability, breach-ends-run, souls scoring + clear/no-hit bonuses, `ww.highScore` persistence.
- [ ] 6. Incursion flow: composition scaling (rows/cols, cackler i2+, brute i3+, bat i4+), drift/fire-rate formulas per `specs/02-gameplay.md`, endless loop with draft trigger between incursions.
- [ ] 7. Mana + Hold: 100 mana / 8s regen + 2-per-banish, per-spell cooldowns, `costMult`/`cdMult`/`regenMult` hooks, Hold L1/L2 auto-north zone (roots normals, 50% slows lords, re-cast refreshes), `mana-empty` cue.
- [ ] 8. Draft: pause + pick-1-of-3 (Boon/Spell labeled, 1/2/3 keys + tap), stacking caps, Lesser-Heal fallback, delta preview on cards (e.g. "0.35→0.28s").
- [ ] 9. Boon set: Ward, Arcane Power, Haste, Homing Skulls, Sunbeam (suppresses casts/skulls while channeling), Familiar — caps per `specs/03-powerups.md`, wizard-projectile cap ~40.
- [ ] 10. Demon lord: every 5th incursion, HP `60 + 25 × tier`, 2–3 attack patterns, HP bar, no pillars, 500 × tier souls, advances to draft on banish.
- [ ] 11. Presentation + audio: HUD (souls, incursion, pips, mana bar, cooldown sweep, boon icons), menu/draft/pause/gameover screens, juice (shake, flashes, banish bursts, banners; particles ≤ 200), synth SFX + `ww.muted`, audio-resume on gesture.
- [ ] 12. Acceptance pass: full manual checklist in `specs/06-tech-architecture.md` + one real-device touch check (both touch schemes).
