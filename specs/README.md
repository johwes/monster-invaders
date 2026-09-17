# Wizard's Ward — Specs (v1)

Browser-based expanded arcade wizard defense. Start here.

## Vision

Top-down view of a **room**: a lone wizard holds the south end while a
demon horde pours from a **portal at the north end**. Real-time
single-direction shooter core with a tactical layer: **mana + cooldown
spells** (first: Hold), **full tactical pause**, and a roguelite draft —
after each cleared incursion the wizard drafts **1 of 3 boons or spells**,
then faces an endlessly scaling run with a **demon lord every 5
incursions**. Death or a breach of the ward line ends the run; the chase
is the local high score.

## Locked decisions

- **Tech:** TypeScript + Vite, static site, no backend.
- **Scope:** expanded arcade — classic core + 6 boons + Hold spell + endless + demon lords.
- **Tactics:** real-time + spells with full tactical pause (no order queue in v1).
- **Resource:** mana pool + per-spell cooldowns, with cost/cooldown/regen multiplier hooks for later equipment.
- **Targeting:** auto-north zones only in v1 (no aimed placement).
- **Wizard types:** designed-for-later extension point (`archetype`), one default wizard in v1.
- **Draft:** clear incursion → pause → pick 1 of 3 (Boon or Spell) → next incursion.
- **Run:** endless scaling, demon lord every 5th incursion, no victory screen in v1.
- **Movement/aim:** 8-way move across the whole room interior, spells auto-fire north toward the portal.
- **Input:** desktop keyboard + mobile/tablet touch (floating joystick default, relative-drag fallback), responsive canvas.
- **Persistence/audio:** `localStorage` high score + WebAudio arcane SFX.
- **Art:** dark-magic dungeon, retro sprites drawn in code, no binary assets.

## Spec index

| File | What it defines |
|------|-----------------|
| [02-gameplay.md](./02-gameplay.md) | Core loop, room/portal, mana/spells/pause, whole-room movement, archetype hook |
| [03-powerups.md](./03-powerups.md) | Draft pool (boons vs. spells), Hold ranks, discount hooks, tuning numbers |
| [04-controls-input.md](./04-controls-input.md) | 8-way keyboard, joystick + drag touch schemes, spell key/button, tactical pause |
| [05-presentation-audio.md](./05-presentation-audio.md) | Screens, HUD (mana/cooldowns), Hold visuals, SFX, high-score UI |
| [06-tech-architecture.md](./06-tech-architecture.md) | Vite+TS layout (`spells.ts`), game loop, state, storage keys, acceptance checklist |

Read in order 02 → 06. Each file is normative for its area; this README
is the overview. On conflict, the numbered file wins over this README.

## Glossary

- **Incursion:** one demon formation (normal) or one demon lord fight. Code may still call this `wave`.
- **Draft:** the between-incursion pick-1-of-3 boon/spell screen.
- **Run:** menu → incursions/demon lords until death or breach → game-over screen.
- **Stack:** taking the same boon/spell multiple times (capped per type).
- **Portal:** north-end door the horde enters through.
- **Ward line:** southern line the wizard defends; any demon crossing it ends the run.
- **Spell:** active ability gated by mana + cooldown (v1: Hold, 1 slot).
- **Boon:** always-on passive (the 6 originals).
- **Tactical pause:** full freeze (demons, timers, mana, cooldowns) for planning or breaks.
- **Archetype:** future wizard type (starting kit + draft weights + passive); v1 has one default.

## Open tuning questions (placeholders in specs)

- Demon lord cadence fixed at every 5 incursions — confirm after first playtest.
- Hold numbers (35 mana / 12s / 3s zone) and mana economy (100 / 8s regen) — tune for "saves 1 in 3 casts".
- Stacking caps (proposed in `03-powerups.md`) — tune for fun, not final.
- Touch scheme: floating joystick default + drag fallback, fixed speed with deadzone — confirm on device.
- Difficulty formula constants — starting values only, expect iteration.
