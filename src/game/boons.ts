// Draft pool (spec 03). Combined boon + spell pool, stacking caps, the
// Lesser-Heal / souls fallback, and per-card delta previews (PROGRESS
// item 8). Continuous boon behaviors (arcane intervals, haste speed,
// skulls, sunbeam, familiars) land with item 9; this file only tracks what
// the wizard has drafted and what the next pick would grant.

import { HOLD } from './spells.ts';

export interface BoonDef {
  id: string;
  kind: 'boon';
  name: string;
  /** Max stacks; at cap the type leaves the draw pool (spec 03). */
  cap: number;
}

export const BOONS: BoonDef[] = [
  { id: 'ward', kind: 'boon', name: 'Ward', cap: 3 },
  { id: 'arcane-power', kind: 'boon', name: 'Arcane Power', cap: 4 },
  { id: 'haste', kind: 'boon', name: 'Haste', cap: 2 },
  { id: 'homing-skulls', kind: 'boon', name: 'Homing Skulls', cap: 3 },
  { id: 'sunbeam', kind: 'boon', name: 'Sunbeam', cap: 2 },
  { id: 'familiar', kind: 'boon', name: 'Familiar', cap: 2 },
];

/** Fallback card ids when every drawn type is capped (spec 03). */
export const FALLBACK_HEAL_ID = 'lesser-heal';
export const FALLBACK_SOULS_ID = 'soul-cache';
/** Souls paid by the score fallback (spec 03: "+250 souls"). */
export const FALLBACK_SOULS_AMOUNT = 250;

/**
 * Run build: stacks taken per draftable id (`ward`, `arcane-power`, …,
 * `hold`). One-shot fallbacks (`lesser-heal`, `soul-cache`) never appear
 * here — they apply immediately and leave no stacks.
 */
export type BuildLevels = Record<string, number>;

export function levelOf(levels: BuildLevels, id: string): number {
  return Math.max(0, Math.floor(levels[id] ?? 0));
}

/** Max stacks for a draftable id (boons + Hold). */
export function capForId(id: string): number {
  if (id === HOLD.id) return HOLD.cap;
  return BOONS.find((boon) => boon.id === id)?.cap ?? 0;
}

function isCapped(levels: BuildLevels, id: string): boolean {
  return levelOf(levels, id) >= capForId(id);
}

/** Draftable ids still below their stacking cap (spec 03). */
export function availableDraftIds(levels: BuildLevels): string[] {
  const ids = [...BOONS.map((boon) => boon.id), HOLD.id];
  return ids.filter((id) => !isCapped(levels, id));
}

export type DraftKind = 'boon' | 'spell';

export interface DraftOffer {
  id: string;
  kind: DraftKind;
  name: string;
  /** Stacks already held (0 when unowned). */
  currentLevel: number;
  /** Stacks after taking this card (1-shot fallbacks report 0). */
  nextLevel: number;
  /** Stacking cap (0 for repeatable 1-shot fallbacks). */
  cap: number;
  /** One-line effect with cost/cooldown/duration for spells (spec 05). */
  effect: string;
  /** What changes on pickup, e.g. "Hold 3s→4s" (spec 05). */
  delta: string;
}

const KIND_BY_ID: Record<string, DraftKind> = {
  hold: 'spell',
};

function kindForId(id: string): DraftKind {
  return KIND_BY_ID[id] ?? 'boon';
}

function nameForId(id: string): string {
  if (id === HOLD.id) return HOLD.name;
  if (id === FALLBACK_HEAL_ID) return 'Lesser Heal';
  if (id === FALLBACK_SOULS_ID) return '+250 Souls';
  return BOONS.find((boon) => boon.id === id)?.name ?? id;
}

/**
 * One-line effect + delta preview for an id at its current stacks. Numbers
 * below restate spec-locked tuning only (spec 02 base stats, spec 03 Hold
 * ranks / skull intervals / sunbeam duty / haste % / familiar cadence);
 * Arcane Power stays qualitative until item 9 locks its per-rank curve.
 */
export function effectForId(id: string, currentLevel: number): { effect: string; delta: string } {
  switch (id) {
    case 'ward':
      return {
        effect: '+1 max ward HP and heal 1 on pickup.',
        delta: `Max HP ${3 + currentLevel}→${4 + currentLevel}, heal 1`,
      };
    case 'arcane-power': {
      const next = currentLevel + 1;
      const extra = next === 2 ? ' + double-bolt' : next === 4 ? ' + triple-spread' : '';
      return {
        effect: `Cast interval down (→~0.16s at L4).${extra}`,
        delta: `Level ${currentLevel}→${next}${extra}`,
      };
    }
    case 'haste': {
      const cur = Math.round(260 * (1 + 0.25 * currentLevel));
      const next = Math.round(260 * (1 + 0.25 * (currentLevel + 1)));
      const bolt = currentLevel === 1 ? ', +20% bolt speed' : '';
      return {
        effect: '+25% wizard move speed per level (L2 also +20% bolt speed).',
        delta: `Move ${cur}→${next} px/s${bolt}`,
      };
    }
    case 'homing-skulls': {
      const desc = ['—', '1 skull / 1.2s', '1 skull / 0.9s', '2 skulls / 0.7s'];
      return {
        effect: 'Spectral skulls seek the nearest demon (small splash).',
        delta: `${desc[currentLevel] ?? '—'}→${desc[currentLevel + 1] ?? '—'}`,
      };
    }
    case 'sunbeam': {
      const desc = ['—', '2s on / 3s cooldown', '3s on / 2s cooldown, wider'];
      return {
        effect: 'Channeled piercing beam; casts + skulls pause while on.',
        delta: `${desc[currentLevel] ?? '—'}→${desc[currentLevel + 1] ?? '—'}`,
      };
    }
    case 'familiar':
      return {
        effect: 'Bound drake auto-casts weak bolts (0.5s, 1 dmg).',
        delta: `Familiars ${currentLevel}→${currentLevel + 1}`,
      };
    case 'hold': {
      if (currentLevel === 0) {
        return {
          effect: 'Auto-north rune circle: roots normals 3s (lords slowed 50%).',
          delta: 'New spell · 35 mana · 12s cooldown',
        };
      }
      return {
        effect: 'Auto-north rune circle: roots normals 4s (lords slowed 50%).',
        delta: 'Hold 3s→4s · 35→30 mana · 12→10s cd',
      };
    }
    case FALLBACK_HEAL_ID:
      return {
        effect: 'Heal 1 ward HP immediately (no max change).',
        delta: '+1 HP',
      };
    case FALLBACK_SOULS_ID:
      return {
        effect: 'Banish bonus converted to souls immediately.',
        delta: `+${FALLBACK_SOULS_AMOUNT} souls`,
      };
    default:
      return { effect: '', delta: '' };
  }
}

function offerForId(id: string, levels: BuildLevels): DraftOffer {
  const currentLevel = levelOf(levels, id);
  const fallback = id === FALLBACK_HEAL_ID || id === FALLBACK_SOULS_ID;
  const { effect, delta } = effectForId(id, currentLevel);
  return {
    id,
    kind: kindForId(id),
    name: nameForId(id),
    currentLevel: fallback ? 0 : currentLevel,
    nextLevel: fallback ? 0 : currentLevel + 1,
    cap: fallback ? 0 : capForId(id),
    effect,
    delta,
  };
}

/**
 * Draw 3 draft offers (spec 03): 3 distinct cards from the combined
 * boon + spell pool below cap. Capped types never appear; when the pool
 * holds fewer than 3 ids, repeatable 1-shot fallbacks (Lesser Heal, then
 * +250 souls, alternating) fill the rest — so a fully capped late run
 * still drafts heal/score instead of dead cards. No skip / no reroll.
 */
export function drawDraftOffers(
  levels: BuildLevels,
  rng: () => number = Math.random,
): DraftOffer[] {
  const pool = [...availableDraftIds(levels)];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const ids = pool.slice(0, 3);
  const fallbacks = [FALLBACK_HEAL_ID, FALLBACK_SOULS_ID];
  let fill = 0;
  while (ids.length < 3) {
    ids.push(fallbacks[fill % fallbacks.length]);
    fill += 1;
  }
  return ids.map((id) => offerForId(id, levels));
}
