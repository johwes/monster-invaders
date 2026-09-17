// Incursion (formation / demon-lord) helpers (spec 02).
// Composition scaling and spawn logic arrive with PROGRESS items 6 and 10.

import type { DemonKind } from './entities.ts';

/** Every 5th incursion is a demon lord fight (spec 02). */
export function isLordIncursion(incursion: number): boolean {
  return incursion > 0 && incursion % 5 === 0;
}

/**
 * Formation size for a normal incursion. Item 4 placeholder: fixed 4 rows
 * x 8 columns (spec 02's starting end of the 4->6 / 8->11 ranges). Item 6
 * expands this to the full scaling composition (cackler i2+, brute i3+,
 * bat i4+).
 */
export function formationLayout(_incursion: number): { rows: number; cols: number } {
  return { rows: 4, cols: 8 };
}

/**
 * Demon kind at a formation cell. Item 4: imps only ("imp first", spec
 * 02 classic grunt equivalent). Item 6 unlocks cackler/brute/bat by
 * incursion number.
 */
export function demonKindAt(
  _incursion: number,
  _row: number,
  _col: number,
): DemonKind {
  return 'imp';
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

/** Demon lord HP: `60 + 25 x tier`, where tier = incursion / 5 (spec 02). */
export function lordHpForTier(tier: number): number {
  return 60 + 25 * tier;
}

/** Demon lord souls: `500 x tier` (spec 02). */
export function lordSoulsForTier(tier: number): number {
  return 500 * tier;
}
