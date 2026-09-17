// Draft pool stubs (spec 03). Draft flow and stacking arrive with
// PROGRESS items 8-9; this file only locks the pool ids and stack caps.

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

/** Fallback card id when every drawn type is capped (spec 03). */
export const FALLBACK_HEAL_ID = 'lesser-heal';
