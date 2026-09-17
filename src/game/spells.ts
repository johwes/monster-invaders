// Spell definitions (specs 02/03/06). Casting, zones, and cooldown
// timers arrive with PROGRESS item 7; this file locks the data template
// and the Hold tuning numbers straight from spec 03.

export interface CostModifiers {
  costMult: number;
  cdMult: number;
  regenMult: number;
}

export const DEFAULT_MODIFIERS: CostModifiers = {
  costMult: 1.0,
  cdMult: 1.0,
  regenMult: 1.0,
};

/** Mana economy (spec 03). No max-mana upgrades in v1. */
export const MANA_MAX = 100;
export const MANA_REGEN = 8;
export const MANA_PER_BANISH = 2;

export interface SpellRank {
  cost: number;
  cooldown: number;
  duration: number;
  zoneW: number;
  zoneH: number;
}

export interface SpellDef {
  id: string;
  kind: 'spell';
  name: string;
  /** Rankable spells stack ranks; taking L2 requires L1 (spec 03). */
  cap: number;
  ranks: SpellRank[];
}

export const HOLD: SpellDef = {
  id: 'hold',
  kind: 'spell',
  name: 'Hold',
  cap: 2,
  ranks: [
    { cost: 35, cooldown: 12, duration: 3, zoneW: 220, zoneH: 160 },
    { cost: 30, cooldown: 10, duration: 4, zoneW: 260, zoneH: 180 },
  ],
};

/** Effective cost = `base x costMult` (spec 03). */
export function effectiveCost(base: number, mods: CostModifiers): number {
  return base * mods.costMult;
}

/** Effective cooldown = `base x cdMult` (spec 03). */
export function effectiveCooldown(base: number, mods: CostModifiers): number {
  return base * mods.cdMult;
}

/** Effective regen = `base x regenMult` (spec 03). */
export function effectiveRegen(base: number, mods: CostModifiers): number {
  return base * mods.regenMult;
}
