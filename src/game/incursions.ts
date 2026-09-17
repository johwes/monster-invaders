// Incursion (formation / demon-lord) helpers (spec 02).
// Composition scaling and spawn logic arrive with PROGRESS items 6 and 10.

/** Every 5th incursion is a demon lord fight (spec 02). */
export function isLordIncursion(incursion: number): boolean {
  return incursion > 0 && incursion % 5 === 0;
}

/** Demon lord HP: `60 + 25 x tier`, where tier = incursion / 5 (spec 02). */
export function lordHpForTier(tier: number): number {
  return 60 + 25 * tier;
}

/** Demon lord souls: `500 x tier` (spec 02). */
export function lordSoulsForTier(tier: number): number {
  return 500 * tier;
}
