# 06 — Tech and Architecture

## Stack

TypeScript + Vite, plain Canvas 2D, no game engine. Static hosting
(any static host). No backend. Target modern browsers (ES2020+).

## Suggested layout (adjust at build, then record real paths in AGENTS.md)

```text
index.html          # canvas mount, viewport meta, touch-action
src/
  main.ts           # boot, resize, screen switching
  game/
    loop.ts         # fixed-timestep update + render (pause-aware)
    state.ts        # run state, incursion/draft/pause/gameover machine
    entities.ts     # wizard, demons, bolts, demon lord, particles, zones
    waves.ts        # formation gen + difficulty scaling (may rename to incursions.ts)
    powerups.ts     # boon + spell draft pool, stacking, fallback (may rename to boons.ts)
    spells.ts       # spell defs { cost, cooldown, zone, duration, effect }, cost/cd mults
    input.ts        # keyboard + touch abstraction
    audio.ts        # WebAudio arcane SFX + mute
    storage.ts      # high score / mute keys
    render.ts       # room, sprites, HUD, screens
```

Code may keep `wave/invader` identifiers internally to avoid churn, or adopt
`incursion/demon` from the start — pick one at scaffolding and use it consistently.
`archetype` is an extension point (starting stats + draft weights); v1 ships one
default archetype only.

## Key technical rules

- **Loop:** fixed-timestep update (60 Hz) decoupled from render; clamp
  delta to avoid spiral after tab-switch. Pause fully skips updates
  (demons, projectiles, mana, cooldowns, particles); render shows overlay.
- **Units:** logic in 960×540 reference space; render scales with
  devicePixelRatio (cap DPR at 2 for perf).
- **Input abstraction:** gameplay reads `intent = { moveX, moveY, casting, beam, spell1 }`,
  filled by keyboard or touch drivers — no raw key checks in entities.
  `moveX/moveY` is a normalized direction vector (fixed speed above deadzone).
  Touch has two drivers (floating joystick default, relative-drag fallback) behind
  one intent; joystick constants: base radius ~60px (reference units), deadzone ~0.25,
  spawn zone lower 60% of room, spell/pause buttons excluded from stick capture.
- **Spells:** data-driven `{ id, kind: 'spell', cost, cooldown, zone, duration, effect }`;
  effective cost/cooldown go through `costMult`/`cdMult`, regen through `regenMult`.
  Hold zone is an entity with TTL; re-application refreshes duration.
- **Caps:** wizard projectiles ≤ 40, particles ≤ 200, familiars ≤ 2, active zones ≤ 4.
- **Collision:** circle/AABB is fine; spatial partition unnecessary at this scale.
- **Storage keys:** `ww.highScore` (number), `ww.muted` (`"1"`/`"0"`).
  Guard `localStorage` with try/catch (private mode).

## Commands (fill in exact versions at scaffolding)

- `npm install`, `npm run dev`, `npm run build`, `npm run preview`.
- No test framework in v1 — verification is the checklist below.

## Acceptance checklist (manual)

- [ ] Desktop: 8-way move across whole room, auto-cast north, clear incursion 1, draft appears, pick works via 1/2/3.
- [ ] Spell: `Q` casts Hold when mana/cooldown allow; zone roots normals, slows lord; `mana-empty` cue otherwise.
- [ ] Pause: `P` freezes demons/timers/mana/cooldowns; resume continues cleanly; blur auto-pauses.
- [ ] Touch emulation + one real phone: floating joystick spawns where thumb lands, deadzone ignores jitter, drag fallback toggle works, spell + pause buttons tappable.
- [ ] Whole-room roam: wizard can reach north; breach-while-north still ends the run.
- [ ] Demon lord incursion 5 spawns, has HP bar, banishing it advances to draft.
- [ ] Ward hit → HP pip lost + shake + invulnerability blink; death or breach → game over + souls.
- [ ] High score persists across reload; mute persists; pause on tab blur.
- [ ] 60fps-ish on desktop, no scroll/zoom gestures hijacking play on mobile.
