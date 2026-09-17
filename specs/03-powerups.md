# 03 — Arcane Boons, Spells, and Draft

Draft pool is split into **passive boons** (always-on) and **active spells**
(mana + cooldown). The 6 original boons are unchanged; Hold is the first
tactical spell. Wizard archetypes are a designed-for-later hook only.

## Draft flow

- Triggered on every normal and demon lord incursion clear (before next incursion spawns).
- Game pauses; overlay shows 3 distinct cards drawn from the combined
  boon + spell pool. Cards are labeled by kind (Boon / Spell).
- Wizard picks 1 (click/tap or 1/2/3 keys). No skip, no reroll in v1.
- Duplicate picks stack up to the per-type cap; at cap, that type is removed
  from the draw pool (if all capped, offer heal/score instead — see fallback).
- Draft state must be keyboard- and touch-operable (see 04).

## Passive boon set (v1, six — unchanged)

Levels are stacks taken. All numbers tunable. Classic names in parentheses.

1. **Ward** (= Armor, cap 3): +1 max ward HP and heal 1 on pickup. L3 ≈ 6 HP.
2. **Arcane Power** (= Firepower, cap 4): each level reduces cast interval (~0.35→0.16s);
   L2 adds double-bolt, L4 triple-spread. Base damage stays 1.
3. **Haste** (= Speed, cap 2): +25% wizard move speed per level; L2 also +20% bolt speed.
4. **Homing Skulls** (= Missiles, cap 3): spectral skulls seek nearest live
   demon every 1.2s/0.9s/0.7s, 1/1/2 skulls, small splash (60px). Fizzle if no target.
5. **Sunbeam** (= Laser beam, cap 2): channeled piercing beam with heat meter.
   L1: ~2s on / 3s cooldown; L2: ~3s on / 2s cooldown, wider beam.
   Beam DPS ≈ 6× base cast but normal bolts and skulls pause while channeling.
6. **Familiar** (= Helper robot, cap 2): bound imp-drake flanking the wizard,
   auto-casting weak bolts (0.5s interval, 1 damage) at nearest demon.
   Familiar is invulnerable in v1 (avoid escort-frustration).

## Active spell set (v1: Hold, rankable)

1. **Hold** (Spell, cap 2): projects an auto-north rune circle that roots
   normal demons and slows demon lords 50% (never roots lords).
   - L1: cost 35 mana, cooldown 12s, duration 3s, zone ~220×160px ahead of wizard.
   - L2: cost 30 mana, cooldown 10s, duration 4s, zone ~260×180px.
   - Taking L2 requires L1 (ranks stack). Re-rooting a held demon refreshes duration.
   - Visual/audio: rune circle + shackle particles + deep bell (see 05).

Future spells reuse this template: `{ cost, cooldown, zone, duration, effect }`
with `costMult`/`cdMult` applied. Do not hardcode single-spell assumptions.

## Discount hooks (future boons/equipment)

- Effective cost = `base cost × costMult`, cooldown = `base × cdMult`,
  regen = `base × regenMult`. All default 1.0.
- Mana base: 100 max, regen 8/s + 2 per banish. No max-mana upgrades in v1.
- v1 has no discount content; the hooks exist so later cards like
  "−20% cooldowns" or "+50% regen" need no refactor.

## Fallback card

If all drawn types are capped (late runs), replace capped cards with:
**Lesser Heal +1 HP** and/or **+250 souls**. Implement at least Lesser Heal.

## Interaction rules

- Arcane spread + skulls + familiar bolts can coexist (projectile cap needed —
  see 06, suggest max ~40 wizard projectiles).
- Sunbeam suppresses normal casts + skulls while channeling (prevents melt).
  Hold does not suppress anything — it is the combo enabler.
- Haste applies to wizard only; familiar positioning lerps to avoid jitter.
- Balance target: an incursion-10 build (~7 drafts) should clear incursions in
  45–75s without feeling invincible; Hold should save a run ~1 in 3 casts, not every cast.
