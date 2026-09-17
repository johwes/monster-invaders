// Incursion (formation / demon-lord) helpers (spec 02).
// Normal-incursion composition + difficulty scaling live here; demon-lord
// spawn numbers (HP/souls/attack cadence) locked in PROGRESS item 10.

import type { DemonKind } from './entities.ts';
import {
  FORMATION_BASE_FIRE_INTERVAL,
  FORMATION_BASE_SPEED,
} from './constants.ts';

/** Every 5th incursion is a demon lord fight (spec 02). */
export function isLordIncursion(incursion: number): boolean {
  return incursion > 0 && incursion % 5 === 0;
}

/**
 * Formation size for a normal incursion (spec 02: rows 4->6, cols 8->11).
 * Rows grow every 3rd incursion, columns every 2nd, so the formation caps
 * at 6x11 from incursion 7 on — endless past that, difficulty continues
 * through drift/fire-rate scaling below. Tunable.
 */
export function formationLayout(incursion: number): { rows: number; cols: number } {
  const i = Math.max(1, Math.floor(incursion));
  return {
    rows: Math.min(6, 4 + Math.floor((i - 1) / 3)),
    cols: Math.min(11, 8 + Math.floor((i - 1) / 2)),
  };
}

/**
 * Demon kind at a formation cell (row 0 is the north/back rank by the
 * portal, row `rows - 1` the south/front rank by the wizard). Unlocks per
 * spec 02: cackler i2+, brute i3+, bat i4+. Brutes hold the front rank,
 * bats skirmish along the back rank, cacklers fill the middle — anything
 * still locked (or on incursion 1) is an imp ("imp first").
 */
export function demonKindAt(
  incursion: number,
  row: number,
  col: number,
  rows: number,
): DemonKind {
  const i = Math.max(1, Math.floor(incursion));
  if (row === rows - 1) {
    // Front rank: brutes punch through on even columns (odd stay imps so
    // the rank is not a full 3-HP wall and imps never vanish entirely).
    return i >= 3 && col % 2 === 0 ? 'brute' : 'imp';
  }
  if (row === 0) {
    // Back rank: bats skirmish on even columns once they unlock.
    if (i >= 4) return col % 2 === 0 ? 'bat' : 'cackler';
    return i >= 2 ? 'cackler' : 'imp';
  }
  return i >= 2 ? 'cackler' : 'imp';
}

/** Base HP per demon kind (spec 02: brute 3, everything else 1). */
export function demonHpForKind(kind: DemonKind): number {
  return kind === 'brute' ? 3 : 1;
}

/**
 * Souls per banished demon (spec 02): imp 10, cackler 20, bat 30,
 * brute 50. Demon lords use `lordSoulsForTier` below instead.
 */
export function demonSoulsForKind(kind: DemonKind): number {
  switch (kind) {
    case 'imp':
      return 10;
    case 'cackler':
      return 20;
    case 'bat':
      return 30;
    case 'brute':
      return 50;
  }
}

/** Horde drift speed: `base * (1 + 0.06 * incursion)` (spec 02). */
export function driftSpeedForIncursion(incursion: number): number {
  return FORMATION_BASE_SPEED * (1 + 0.06 * Math.max(1, Math.floor(incursion)));
}

/**
 * Classic thin-formation speed-up: the horde sidles faster as it thins,
 * up to 2x at the last demon. Factor is tunable (spec 02 leaves the exact
 * curve open).
 */
export function thinSpeedMultiplier(alive: number, initial: number): number {
  if (initial <= 0 || alive >= initial) return 1;
  return 1 + (1 - Math.max(0, alive) / initial);
}

/**
 * Demon fire interval: `max(0.25s, 0.9s - 0.04s * incursion)` (spec 02).
 * Floors at 0.25s from incursion 17 on.
 */
export function fireIntervalForIncursion(incursion: number): number {
  return Math.max(
    0.25,
    FORMATION_BASE_FIRE_INTERVAL - 0.04 * Math.max(1, Math.floor(incursion)),
  );
}

/** Incursion-clear bonus: `25 * incursion` (spec 02). */
export function clearBonusForIncursion(incursion: number): number {
  return 25 * Math.max(1, Math.floor(incursion));
}

/**
 * No-hit incursion bonus: +50% of the clear bonus (spec 02). Kept as
 * integer souls via floor, so incursion 1 pays 25 + 12 = 37.
 */
export function noHitBonusForIncursion(incursion: number): number {
  return Math.floor(clearBonusForIncursion(incursion) / 2);
}

/** Demon lord tier for an incursion: `floor(incursion / 5)` (min 1). */
export function lordTierForIncursion(incursion: number): number {
  return Math.max(1, Math.floor(Math.max(1, Math.floor(incursion)) / 5));
}

/** Demon lord HP: `60 + 25 x tier`, where tier = incursion / 5 (spec 02). */
export function lordHpForTier(tier: number): number {
  return 60 + 25 * tier;
}

/** Demon lord souls: `500 x tier` (spec 02). */
export function lordSoulsForTier(tier: number): number {
  return 500 * tier;
}

/**
 * Lord attack cadence (item 10 tuning): `max(1.1s, 2.2s - 0.15s * tier)`.
 * The three patterns (spread / aimed burst / summon) cycle in rotation, so
 * each individual pattern recurs every 3x this interval. Floors at 1.1s
 * from tier 8 on (incursion 40).
 */
export function lordAttackIntervalForTier(tier: number): number {
  return Math.max(1.1, 2.2 - 0.15 * Math.max(1, Math.floor(tier)));
}
