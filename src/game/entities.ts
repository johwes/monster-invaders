// Combatants: room movement, auto-cast, formation, projectiles, pillars
// (specs 02/04/06, PROGRESS item 4). Gameplay reads the normalized `Intent`
// and never checks raw keys. Damage/scoring collision arrives with item 5;
// breach-ends-run with item 5; mana/cooldowns with item 7; full incursion
// scaling with item 6; demon lords with item 10.
//
// `archetype` stays a stub extension point with one default wizard: all
// starting stats (move speed, cast interval, ward HP) are read through it.

import {
  BOLT_RADIUS,
  FORMATION_BASE_FIRE_INTERVAL,
  FORMATION_BASE_SPEED,
  FORMATION_COL_GAP,
  FORMATION_ROW_GAP,
  FORMATION_START_Y,
  FORMATION_STEP_DOWN,
  HELLFIRE_SPEED,
  PILLARS,
  PORTAL_MOUTH,
  ROOM_BOTTOM,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  WIZARD_BOLT_SPEED,
  WIZARD_PROJECTILE_CAP,
  WIZARD_RADIUS,
  WIZARD_START,
} from './constants.ts';
import type { Intent } from './input.ts';
import { demonHpForKind, demonKindAt, formationLayout } from './incursions.ts';
import { MANA_MAX } from './spells.ts';

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
  /** Countdown to the next auto-cast north (spec 04: always on). */
  castTimer: number;
}

export interface Demon {
  kind: DemonKind;
  x: number;
  y: number;
  hp: number;
}

export type BoltSide = 'wizard' | 'hellfire';

export interface Bolt {
  x: number;
  y: number;
  /** Signed vertical velocity: negative flies north, positive south. */
  vy: number;
  side: BoltSide;
}

export interface Pillar {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

export interface CombatState {
  wizard: Wizard;
  demons: Demon[];
  wizardBolts: Bolt[];
  hellfire: Bolt[];
  pillars: Pillar[];
  /** Shared formation drift direction: +1 east, -1 west. */
  formationDir: 1 | -1;
  fireTimer: number;
}

export function createWizard(archetype: Archetype = DEFAULT_ARCHETYPE): Wizard {
  return {
    x: WIZARD_START.x,
    y: WIZARD_START.y,
    hp: archetype.wardHp,
    maxHp: archetype.wardHp,
    mana: MANA_MAX,
    castTimer: 0,
  };
}

/** Build the entering formation for an incursion (portal at the north). */
export function createDemons(incursion: number): Demon[] {
  const { rows, cols } = formationLayout(incursion);
  const width = (cols - 1) * FORMATION_COL_GAP;
  const startX = (ROOM_LEFT + ROOM_RIGHT) / 2 - width / 2;
  const demons: Demon[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const kind = demonKindAt(incursion, row, col);
      demons.push({
        kind,
        x: startX + col * FORMATION_COL_GAP,
        y: FORMATION_START_Y + row * FORMATION_ROW_GAP,
        hp: demonHpForKind(kind),
      });
    }
  }
  return demons;
}

export function createPillars(): Pillar[] {
  return PILLARS.map((p) => ({ ...p }));
}

export function createCombat(
  incursion: number,
  archetype: Archetype = DEFAULT_ARCHETYPE,
): CombatState {
  return {
    wizard: createWizard(archetype),
    demons: createDemons(incursion),
    wizardBolts: [],
    hellfire: [],
    pillars: createPillars(),
    formationDir: 1,
    fireTimer: FORMATION_BASE_FIRE_INTERVAL,
  };
}

function clampWizard(wizard: Wizard): void {
  wizard.x = Math.min(ROOM_RIGHT - WIZARD_RADIUS, Math.max(ROOM_LEFT + WIZARD_RADIUS, wizard.x));
  wizard.y = Math.min(ROOM_BOTTOM - WIZARD_RADIUS, Math.max(ROOM_TOP + WIZARD_RADIUS, wizard.y));
  // Portal mouth excluded from movement (spec 02).
  if (
    wizard.x > PORTAL_MOUTH.x0 &&
    wizard.x < PORTAL_MOUTH.x1 &&
    wizard.y < PORTAL_MOUTH.y1
  ) {
    wizard.y = PORTAL_MOUTH.y1;
  }
}

/** Push the wizard out of solid pillars (cover blocks movement too). */
function resolveWizardPillars(wizard: Wizard, pillars: Pillar[]): void {
  for (const pillar of pillars) {
    if (pillar.hp <= 0) continue;
    const nearestX = Math.min(pillar.x + pillar.w, Math.max(pillar.x, wizard.x));
    const nearestY = Math.min(pillar.y + pillar.h, Math.max(pillar.y, wizard.y));
    const dx = wizard.x - nearestX;
    const dy = wizard.y - nearestY;
    const dist = Math.hypot(dx, dy);
    if (dist >= WIZARD_RADIUS) continue;
    if (dist === 0) {
      wizard.y = pillar.y + pillar.h + WIZARD_RADIUS;
      continue;
    }
    wizard.x = nearestX + (dx / dist) * WIZARD_RADIUS;
    wizard.y = nearestY + (dy / dist) * WIZARD_RADIUS;
  }
  clampWizard(wizard);
}

function updateWizard(
  combat: CombatState,
  intent: Intent,
  step: number,
  archetype: Archetype,
): void {
  const { wizard } = combat;
  // Intent is a normalized direction (fixed speed above deadzone, spec 06);
  // keyboard diagonals arrive pre-normalized from the input driver.
  wizard.x += intent.moveX * archetype.moveSpeed * step;
  wizard.y += intent.moveY * archetype.moveSpeed * step;
  clampWizard(wizard);
  resolveWizardPillars(wizard, combat.pillars);

  // Auto-cast north is always on (spec 04); Space hold-to-cast needs no key.
  wizard.castTimer -= step;
  if (wizard.castTimer <= 0) {
    wizard.castTimer += archetype.castInterval;
    if (combat.wizardBolts.length < WIZARD_PROJECTILE_CAP) {
      combat.wizardBolts.push({
        x: wizard.x,
        y: wizard.y - WIZARD_RADIUS,
        vy: -WIZARD_BOLT_SPEED,
        side: 'wizard',
      });
    }
  }
}

/** Classic sidle: drift across the room, step south + reverse on edge hit. */
function updateFormation(combat: CombatState, step: number): void {
  if (combat.demons.length === 0) return;
  // Item 6 adds the per-incursion drift multiplier and thin-formation
  // speed-up; item 4 moves at the unscaled base speed.
  const dx = combat.formationDir * FORMATION_BASE_SPEED * step;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const demon of combat.demons) {
    if (demon.x < minX) minX = demon.x;
    if (demon.x > maxX) maxX = demon.x;
  }
  if (minX + dx < ROOM_LEFT || maxX + dx > ROOM_RIGHT) {
    combat.formationDir = combat.formationDir === 1 ? -1 : 1;
    for (const demon of combat.demons) {
      demon.y += FORMATION_STEP_DOWN;
    }
    return;
  }
  for (const demon of combat.demons) {
    demon.x += dx;
  }
}

/** Demons spit hellfire south (spec 02); rate scaling arrives in item 6. */
function updateHellfireSpawns(combat: CombatState, step: number): void {
  combat.fireTimer -= step;
  if (combat.fireTimer > 0 || combat.demons.length === 0) return;
  combat.fireTimer += FORMATION_BASE_FIRE_INTERVAL;
  const shooter = combat.demons[Math.floor(Math.random() * combat.demons.length)];
  combat.hellfire.push({
    x: shooter.x,
    y: shooter.y + 12,
    vy: HELLFIRE_SPEED,
    side: 'hellfire',
  });
}

function boltHitsPillar(bolt: Bolt, pillar: Pillar): boolean {
  if (pillar.hp <= 0) return false;
  const nearestX = Math.min(pillar.x + pillar.w, Math.max(pillar.x, bolt.x));
  const nearestY = Math.min(pillar.y + pillar.h, Math.max(pillar.y, bolt.y));
  return Math.hypot(bolt.x - nearestX, bolt.y - nearestY) <= BOLT_RADIUS;
}

/**
 * Move projectiles; pillars block both sides (spec 02) — a blocked bolt is
 * consumed and chips 1 HP-cell off the pillar. Bolt-vs-demon / hellfire-
 * vs-wizard hits and off-south-line breach are item 5.
 */
function updateBolts(combat: CombatState, step: number): void {
  for (const bolt of [...combat.wizardBolts, ...combat.hellfire]) {
    bolt.y += bolt.vy * step;
  }
  const blocks = (bolt: Bolt): boolean => {
    if (bolt.y < ROOM_TOP - 24 || bolt.y > ROOM_BOTTOM + 24) return true;
    for (const pillar of combat.pillars) {
      if (boltHitsPillar(bolt, pillar)) {
        pillar.hp -= 1;
        return true;
      }
    }
    return false;
  };
  combat.wizardBolts = combat.wizardBolts.filter((bolt) => !blocks(bolt));
  combat.hellfire = combat.hellfire.filter((bolt) => !blocks(bolt));
}

/**
 * Advance room combat one fixed step. No-op without demons is fine (lord
 * fights replace the list in item 10); damage/scoring lands in item 5.
 */
export function updateCombat(
  combat: CombatState,
  intent: Intent,
  step: number,
  archetype: Archetype = DEFAULT_ARCHETYPE,
): void {
  updateWizard(combat, intent, step, archetype);
  updateFormation(combat, step);
  updateHellfireSpawns(combat, step);
  updateBolts(combat, step);
}
