// Combatant data shapes (spec 02). Movement, casting, and collision
// arrive with PROGRESS items 4-5; `archetype` stays a stub extension
// point with one default wizard (spec 02).

export type DemonKind = 'imp' | 'cackler' | 'brute' | 'bat';

export interface Archetype {
  id: string;
  /** Base wizard stats read through the archetype, never hardcoded (spec 02). */
  moveSpeed: number;
  castInterval: number;
  wardHp: number;
}

export const DEFAULT_ARCHETYPE: Archetype = {
  id: 'default',
  moveSpeed: 260,
  castInterval: 0.35,
  wardHp: 3,
};

export interface Wizard {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mana: number;
}

export interface Demon {
  kind: DemonKind;
  x: number;
  y: number;
  hp: number;
}
