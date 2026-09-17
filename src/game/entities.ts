// Combatants: room movement, auto-cast, formation, projectiles, pillars,
// damage + scoring collision (specs 02/04/06, PROGRESS items 4-5). Gameplay
// reads the normalized `Intent` and never checks raw keys. Breach-ends-run,
// ward HP + blink invulnerability, and souls scoring all live here;
// mana/cooldowns arrive with item 7; demon lords with item 10.
// Per-incursion scaling (composition via incursions.ts, drift/fire-rate
// off CombatState.incursion) is wired.
//
// `archetype` stays a stub extension point with one default wizard: all
// starting stats (move speed, cast interval, ward HP) are read through it.

import {
  BOLT_RADIUS,
  DEMON_RADIUS,
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
  WARD_LINE_Y,
  WIZARD_BOLT_SPEED,
  WIZARD_INVULN_DURATION,
  WIZARD_PROJECTILE_CAP,
  WIZARD_RADIUS,
  WIZARD_START,
} from './constants.ts';
import type { Intent } from './input.ts';
import {
  demonHpForKind,
  demonKindAt,
  demonSoulsForKind,
  driftSpeedForIncursion,
  fireIntervalForIncursion,
  formationLayout,
  thinSpeedMultiplier,
} from './incursions.ts';
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
  /**
   * Seconds of hit invulnerability left (spec 02: 1s + blink). Ticks down
   * on the fixed clock, so tactical pause freezes it with everything else.
   */
  invulnTimer: number;
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
  /** Incursion this combat was built for — drives drift/fire-rate scaling. */
  incursion: number;
  /** Formation size at spawn — denominator for the thin speed-up. */
  initialDemons: number;
  /**
   * True once the wizard has taken a hit this incursion. Reset by
   * `createCombat`; read at clear time for the no-hit bonus (spec 02).
   */
  tookHit: boolean;
}

/**
 * Fixed-step outcome for the run state machine (spec 02): souls banished
 * this step, plus terminal flags. `breached` (any demon at/past the ward
 * line) and `wizardDead` (ward HP depleted) both end the run; `cleared`
 * (formation empty, not breached) advances to the draft.
 */
export interface CombatResult {
  souls: number;
  breached: boolean;
  cleared: boolean;
  wizardDead: boolean;
}

export function createWizard(archetype: Archetype = DEFAULT_ARCHETYPE): Wizard {
  return {
    x: WIZARD_START.x,
    y: WIZARD_START.y,
    hp: archetype.wardHp,
    maxHp: archetype.wardHp,
    mana: MANA_MAX,
    castTimer: 0,
    invulnTimer: 0,
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
      const kind = demonKindAt(incursion, row, col, rows);
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
  const demons = createDemons(incursion);
  return {
    wizard: createWizard(archetype),
    demons,
    wizardBolts: [],
    hellfire: [],
    pillars: createPillars(),
    formationDir: 1,
    fireTimer: fireIntervalForIncursion(incursion),
    incursion,
    initialDemons: demons.length,
    tookHit: false,
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
  // Per-incursion drift multiplier plus the thin-formation speed-up
  // (spec 02): a full late horde sidles well above base, and the last
  // demons move up to 2x faster than their incursion's drift speed.
  const speed =
    driftSpeedForIncursion(combat.incursion) *
    thinSpeedMultiplier(combat.demons.length, combat.initialDemons);
  const dx = combat.formationDir * speed * step;
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

/** Demons spit hellfire south (spec 02); interval tightens per incursion. */
function updateHellfireSpawns(combat: CombatState, step: number): void {
  combat.fireTimer -= step;
  if (combat.fireTimer > 0 || combat.demons.length === 0) return;
  combat.fireTimer += fireIntervalForIncursion(combat.incursion);
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
 * consumed and chips 1 HP-cell off the pillar. Bolt-vs-demon, hellfire-
 * vs-wizard, and contact hits resolve in `resolveHits` below so pillar
 * cover is checked first; the ward-line breach check is `checkBreach`.
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

function circlesHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Deal 1 ward-HP hit to the wizard unless invulnerable or already dead.
 * Sets the 1s blink timer and the incursion's took-hit flag (spec 02).
 * Returns true if the hit landed.
 */
function damageWizard(combat: CombatState): boolean {
  const { wizard } = combat;
  if (wizard.hp <= 0 || wizard.invulnTimer > 0) return false;
  wizard.hp -= 1;
  wizard.invulnTimer = WIZARD_INVULN_DURATION;
  combat.tookHit = true;
  return true;
}

/**
 * Circle collision, both directions (spec 06: circle/AABB is fine).
 * Wizard bolts (1 damage) banish demons for souls; hellfire and demon
 * contact deal 1 ward damage through `damageWizard`. Returns souls gained.
 */
function resolveHits(combat: CombatState): number {
  let souls = 0;

  const survivingBolts: Bolt[] = [];
  for (const bolt of combat.wizardBolts) {
    let hitIndex = -1;
    for (let i = 0; i < combat.demons.length; i += 1) {
      const demon = combat.demons[i];
      if (circlesHit(bolt.x, bolt.y, BOLT_RADIUS, demon.x, demon.y, DEMON_RADIUS)) {
        hitIndex = i;
        break;
      }
    }
    if (hitIndex === -1) {
      survivingBolts.push(bolt);
      continue;
    }
    const demon = combat.demons[hitIndex];
    demon.hp -= 1;
    if (demon.hp <= 0) {
      combat.demons.splice(hitIndex, 1);
      souls += demonSoulsForKind(demon.kind);
    }
  }
  combat.wizardBolts = survivingBolts;

  const survivingHellfire: Bolt[] = [];
  for (const bolt of combat.hellfire) {
    if (
      circlesHit(bolt.x, bolt.y, BOLT_RADIUS, combat.wizard.x, combat.wizard.y, WIZARD_RADIUS)
    ) {
      damageWizard(combat);
      continue;
    }
    survivingHellfire.push(bolt);
  }
  combat.hellfire = survivingHellfire;

  // North roaming risks contact damage (spec 02): demon touch burns 1 ward
  // HP through the same invulnerability gate. Demons survive the bump —
  // the ward line behind them still ends the run.
  for (const demon of combat.demons) {
    if (
      circlesHit(demon.x, demon.y, DEMON_RADIUS, combat.wizard.x, combat.wizard.y, WIZARD_RADIUS)
    ) {
      damageWizard(combat);
      break;
    }
  }

  return souls;
}

/**
 * Breach-ends-run (spec 02): any demon center at/past the ward line ends
 * the run immediately, even if the wizard is roaming north.
 */
function checkBreach(combat: CombatState): boolean {
  for (const demon of combat.demons) {
    if (demon.y >= WARD_LINE_Y) return true;
  }
  return false;
}

/**
 * Advance room combat one fixed step. Returns the step's souls plus
 * terminal flags; the run state machine (state.ts) turns them into
 * score, clear/no-hit bonuses, and game over.
 */
export function updateCombat(
  combat: CombatState,
  intent: Intent,
  step: number,
  archetype: Archetype = DEFAULT_ARCHETYPE,
): CombatResult {
  if (combat.wizard.invulnTimer > 0) {
    combat.wizard.invulnTimer = Math.max(0, combat.wizard.invulnTimer - step);
  }
  updateWizard(combat, intent, step, archetype);
  updateFormation(combat, step);
  updateHellfireSpawns(combat, step);
  updateBolts(combat, step);
  const souls = resolveHits(combat);
  const breached = checkBreach(combat);
  const wizardDead = combat.wizard.hp <= 0;
  // A breached line is never a "clear", even if the last bolt lands first.
  const cleared = !breached && !wizardDead && combat.demons.length === 0;
  return { souls, breached, cleared, wizardDead };
}
