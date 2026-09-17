// Combatants: room movement, auto-cast, formation, projectiles, pillars,
// damage + scoring collision (specs 02/04/06, PROGRESS items 4-5), plus the
// mana + Hold spell layer (item 7: regen/banish mana, per-spell cooldowns
// through cost/cd/regen mults, auto-north root zones, mana-empty cue),
// plus the six-boon set (item 9: Ward max-HP via state.ts, Arcane Power
// cast/bolt-count curve, Haste move/bolt speed, Homing Skulls homing +
// splash, Sunbeam heat/cooldown channel that suppresses casts + skulls,
// Familiar flank drakes with aimed bolts — all under the ~40 wizard-
// projectile cap), plus the demon lord (item 10: every-5th-incursion boss
// with spread/aimed/summon patterns, Hold slows 50% never roots, no
// pillars, 500 x tier souls, draft on banish).
// Gameplay reads the normalized `Intent` and never checks raw keys.
// Breach-ends-run, ward HP + blink invulnerability, and souls scoring all
// live here.
// Per-incursion scaling (composition via incursions.ts, drift/fire-rate
// off CombatState.incursion) is wired.
//
// `archetype` stays a stub extension point with one default wizard: all
// starting stats (move speed, cast interval, ward HP) are read through it.

import {
  BEAM_TICK_INTERVAL,
  BOLT_RADIUS,
  DEMON_RADIUS,
  FAMILIAR_FIRE_INTERVAL,
  FAMILIAR_LERP_RATE,
  FAMILIAR_OFFSET_X,
  FAMILIAR_OFFSET_Y,
  FORMATION_COL_GAP,
  FORMATION_ROW_GAP,
  FORMATION_START_Y,
  FORMATION_STEP_DOWN,
  HELLFIRE_SPEED,
  LORD_BASE_SPEED,
  LORD_RADIUS,
  LORD_SPAWN_Y,
  LORD_SUMMON_CAP,
  PARTICLE_CAP,
  PILLARS,
  PORTAL_MOUTH,
  ROOM_BOTTOM,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  SKULL_LIFE,
  SKULL_RADIUS,
  SKULL_SPEED,
  SKULL_SPLASH_RADIUS,
  WARD_LINE_Y,
  WIZARD_BOLT_SPEED,
  WIZARD_INVULN_DURATION,
  WIZARD_PROJECTILE_CAP,
  WIZARD_RADIUS,
  WIZARD_START,
  ZONE_CAP,
} from './constants.ts';
import type { Intent } from './input.ts';
import {
  demonHpForKind,
  demonKindAt,
  demonSoulsForKind,
  driftSpeedForIncursion,
  fireIntervalForIncursion,
  formationLayout,
  isLordIncursion,
  lordAttackIntervalForTier,
  lordHpForTier,
  lordSoulsForTier,
  lordTierForIncursion,
  thinSpeedMultiplier,
} from './incursions.ts';
import {
  DEFAULT_MODIFIERS,
  effectiveCooldown,
  effectiveCost,
  effectiveRegen,
  HOLD,
  HOLD_LORD_SLOW,
  holdRankDef,
  MANA_MAX,
  MANA_PER_BANISH,
  MANA_REGEN,
  type CostModifiers,
  type SpellRank,
} from './spells.ts';

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

// ---------------------------------------------------------------------------
// Boon set tuning (spec 03, locked in PROGRESS item 9). All numbers below
// are the v1 tuning: Arcane 0.35→~0.16s with double at L2 / triple at L4,
// Haste +25%/level with +20% bolt speed at L2, skulls 1.2/0.9/0.7s x 1/1/2
// with 60px splash, sunbeam 2s-on/3s-cd (L1) and 3s-on/2s-cd (L2, wider),
// familiars 0.5s aimed bolts. Caps mirror boons.ts (Ward 3 / Arcane 4 /
// Haste 2 / Skulls 3 / Sunbeam 2 / Familiar 2).
// ---------------------------------------------------------------------------

export const ARCANE_CAP = 4;
export const HASTE_CAP = 2;
export const SKULL_CAP = 3;
export const SUNBEAM_CAP = 2;
export const FAMILIAR_CAP_LEVELS = 2;

/**
 * Arcane Power cast-interval multipliers per stack (index = level 0-4).
 * With the default 0.35s base: 0.35 / 0.28 / ~0.23 / ~0.19 / ~0.16s.
 * Multipliers (not absolutes) so custom archetype bases scale along.
 */
export const ARCANE_CAST_MULT = [1.0, 0.8, 0.65, 0.55, 0.46];

/** Wizard bolts per volley per Arcane level (L2 double, L4 triple-spread). */
export const ARCANE_BOLT_COUNT = [1, 1, 2, 2, 3];

/** Effective auto-cast interval for an Arcane level over an archetype base. */
export function castIntervalForArcane(baseInterval: number, arcaneLevel: number): number {
  const level = Math.min(ARCANE_CAP, Math.max(0, Math.floor(arcaneLevel)));
  return baseInterval * ARCANE_CAST_MULT[level];
}

/** Bolts per volley for an Arcane level (base damage stays 1, spec 03). */
export function boltCountForArcane(arcaneLevel: number): number {
  const level = Math.min(ARCANE_CAP, Math.max(0, Math.floor(arcaneLevel)));
  return ARCANE_BOLT_COUNT[level];
}

/** Effective wizard move speed for a Haste level over an archetype base. */
export function moveSpeedForHaste(baseSpeed: number, hasteLevel: number): number {
  const level = Math.min(HASTE_CAP, Math.max(0, Math.floor(hasteLevel)));
  return baseSpeed * (1 + 0.25 * level);
}

/** Haste L2 also grants +20% wizard bolt speed (spec 03). */
export function wizardBoltSpeedForHaste(hasteLevel: number): number {
  return WIZARD_BOLT_SPEED * (Math.floor(hasteLevel) >= 2 ? 1.2 : 1.0);
}

/** Skull volley interval per Homing-Skulls level (index 0-3; 0 = none). */
export const SKULL_INTERVALS = [Infinity, 1.2, 0.9, 0.7];
/** Skulls per volley per level (spec 03: 1 / 1 / 2). */
export const SKULL_COUNTS = [0, 1, 1, 2];

/** Sunbeam max channel time per level (index 0-2; heat meter, spec 03). */
export const SUNBEAM_MAX_ON = [0, 2, 3];
/** Sunbeam forced cooldown after a full heat burn per level. */
export const SUNBEAM_COOLDOWNS = [0, 3, 2];
/** Sunbeam beam width per level (L2 wider, spec 03). */
export const SUNBEAM_WIDTHS = [0, 24, 40];

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
  /**
   * Seconds of Hold root left. Refreshed while the demon's center is inside
   * an active zone; ticks down on the fixed clock (pause freezes it).
   * Rooted demons (`holdTimer > 0`) skip formation drift and step-down but
   * still spit hellfire — Hold pins movement, not attacks.
   */
  holdTimer: number;
}

/**
 * Demon lord (spec 02, item 10): one large multi-HP boss on every 5th
 * incursion. Drifts horizontally near the portal and cycles three attack
 * patterns (hellfire spread, aimed burst, summon minions) on a tier-scaled
 * timer. Hold never roots the lord — zones slow its drift 50% instead
 * (`HOLD_LORD_SLOW`), attacks continue while slowed. Contact/bolt damage
 * is 1, like normal demons.
 */
export interface DemonLord {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Lord tier = `floor(incursion / 5)` (min 1); drives HP/souls/patterns. */
  tier: number;
  /** Shared-drift style direction: +1 east, -1 west. */
  dir: 1 | -1;
  /** Countdown to the next pattern in the spread → aimed → summon cycle. */
  attackTimer: number;
  /** Index into the 3-pattern rotation (advances after every attack). */
  patternIndex: number;
}

export type BoltSide = 'wizard' | 'hellfire';

export interface Bolt {
  x: number;
  y: number;
  /** Velocity: wizard bolts fly north (negative vy); spread and familiar
   * bolts add vx for angled/aimed flight. Hellfire flies south. */
  vx: number;
  /** Signed vertical velocity: negative flies north, positive south. */
  vy: number;
  side: BoltSide;
}

/**
 * Homing skull (spec 03): seeks the nearest live demon, 1 damage on direct
 * hit plus 1 splash to every other demon within 60px. Fizzles (never
 * spawns) when no demon is live; strays expire after `SKULL_LIFE`.
 */
export interface Skull {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Bound imp-drake (spec 03): invulnerable, flanks the wizard at
 * ±`FAMILIAR_OFFSET_X` (position lerps each step to avoid jitter), and
 * auto-casts aimed 1-damage bolts every 0.5s at its nearest demon.
 */
export interface Familiar {
  x: number;
  y: number;
  /** Flank side: -1 left, +1 right. */
  side: -1 | 1;
  fireTimer: number;
}

export interface Pillar {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

/**
 * Active Hold zone (spec 06: an entity with TTL). Axis-aligned rect
 * projected auto-north of the wizard at cast time; it does not follow the
 * wizard afterwards. Re-casting while zones are live adds a fresh zone, and
 * any demon covered by a zone has its root refreshed to that zone's
 * remaining TTL (spec 03: re-rooting refreshes duration).
 */
export interface HoldZone {
  /** Top-left corner in reference units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Seconds until the zone expires; ticks down on the fixed clock. */
  ttl: number;
  /** Full duration at cast time (render pulse + refresh reference). */
  duration: number;
  /** Hold rank that cast it (1-based; drives zone size). */
  rank: number;
}

/** How long a failed cast flashes the mana bar (visual `mana-empty` cue). */
export const MANA_EMPTY_CUE_DURATION = 0.5;

/** Screen shake after a ward hit (seconds; render reads the remainder). */
export const SHAKE_DURATION = 0.35;
/** Shake offset at full strength (px, reference units). */
export const SHAKE_MAGNITUDE = 7;

/**
 * Juice particle (spec 05): banish bursts, Hold shackle sparks, ward-hit
 * debris. Pure visuals — no collision. Ticked on the fixed clock inside
 * `updateCombat`, so tactical pause freezes them with everything else.
 * Spawn path enforces `PARTICLE_CAP` (~200, spec 05/06).
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left; render fades the particle as it runs out. */
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface CombatState {
  wizard: Wizard;
  demons: Demon[];
  /** Live demon lord, or null on normal incursions / once banished. */
  lord: DemonLord | null;
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
  /**
   * Cost/cooldown/regen multipliers (spec 03 discount hooks, default 1.0).
   * Future boons/equipment adjust these; spell costs, cooldowns, and mana
   * regen always read through them. Item 8 owns run-level persistence.
   */
  modifiers: CostModifiers;
  /**
   * Equipped Hold rank: 0 = no spell equipped (spec 02 starting kit; the
   * draft in item 8 grants ranks), 1-2 = Hold L1/L2. Use `setHoldRank`.
   */
  holdRank: number;
  /** Per-spell cooldowns left, keyed by spell id (`hold`). Ticks down on
   * the fixed clock, so tactical pause freezes them with everything else. */
  cooldowns: Record<string, number>;
  /** Live Hold zones (cap `ZONE_CAP`; oldest is replaced past the cap). */
  zones: HoldZone[];
  /**
   * Seconds of `mana-empty` cue left (spec 04): set on any failed cast
   * (no spell, on cooldown, or insufficient mana) with no lockout. Render
   * flashes the mana bar while positive; the synth tap lands in item 11.
   */
  manaEmptyTimer: number;
  // -- Boon set (item 9): stacks granted by the draft, applied by
  // `applyBoonLevels` (state.ts calls it after every draft pick and at run
  // start). Runtime clocks below tick on the fixed clock, so tactical pause
  // freezes them with everything else.
  /** Arcane Power stacks (0-4): cast interval + bolt count. */
  arcaneLevel: number;
  /** Haste stacks (0-2): wizard move speed + L2 bolt speed. */
  hasteLevel: number;
  /** Homing Skulls stacks (0-3): volley interval + count. */
  skullLevel: number;
  /** Sunbeam stacks (0-2): channel heat/cooldown/width. 0 = not equipped. */
  sunbeamLevel: number;
  /** Familiar count (0-2): bound drakes in `familiars`. */
  familiarLevel: number;
  /** Countdown to the next skull volley (suppressed while beaming). */
  skullTimer: number;
  /** Live homing skulls; counts toward `WIZARD_PROJECTILE_CAP` with bolts. */
  skulls: Skull[];
  /** Bound familiars (length always equals `familiarLevel`). */
  familiars: Familiar[];
  /** True while the sunbeam channel is live (suppresses casts + skulls). */
  beamActive: boolean;
  /** Heat spent in the current channel (cap = `SUNBEAM_MAX_ON[level]`). */
  beamOnTime: number;
  /** Forced cooldown after a full heat burn (0 = ready to channel). */
  beamCooldown: number;
  /** Damage-tick accumulator for the live beam. */
  beamTick: number;
  /** Live juice particles (capped at `PARTICLE_CAP`; oldest yield past it). */
  particles: Particle[];
  /**
   * Seconds of screen shake + red hit-flash left. Set on every landed
   * ward hit (`damageWizard`); render scales the offset/vignette off the
   * remainder. Ticks down on the fixed clock (pause freezes it).
   */
  shakeTimer: number;
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
        holdTimer: 0,
      });
    }
  }
  return demons;
}

export function createPillars(): Pillar[] {
  return PILLARS.map((p) => ({ ...p }));
}

/** Build the demon lord for an incursion (centered under the portal). */
export function createDemonLord(incursion: number): DemonLord {
  const tier = lordTierForIncursion(incursion);
  const hp = lordHpForTier(tier);
  return {
    x: (ROOM_LEFT + ROOM_RIGHT) / 2,
    y: LORD_SPAWN_Y,
    hp,
    maxHp: hp,
    tier,
    dir: 1,
    attackTimer: lordAttackIntervalForTier(tier),
    patternIndex: 0,
  };
}

export function createCombat(
  incursion: number,
  archetype: Archetype = DEFAULT_ARCHETYPE,
): CombatState {
  const lordFight = isLordIncursion(incursion);
  const demons = lordFight ? [] : createDemons(incursion);
  const lord = lordFight ? createDemonLord(incursion) : null;
  return {
    wizard: createWizard(archetype),
    demons,
    lord,
    wizardBolts: [],
    hellfire: [],
    // Lord fights have no pillars (spec 02); the next normal incursion
    // rebuilds fresh cover in its own `createCombat`, so nothing restores.
    pillars: lordFight ? [] : createPillars(),
    formationDir: 1,
    fireTimer: fireIntervalForIncursion(incursion),
    incursion,
    initialDemons: demons.length,
    tookHit: false,
    modifiers: { ...DEFAULT_MODIFIERS },
    // Spec 02 starting kit: bolt, no spell equipped. Item 8's draft grants
    // Hold ranks via `setHoldRank` (same setter the checks below use).
    holdRank: 0,
    cooldowns: {},
    zones: [],
    manaEmptyTimer: 0,
    // Item 9: no boons equipped at spawn; state.ts layers the run build on
    // top via `applyBoonLevels` (fresh combat per incursion, build persists).
    arcaneLevel: 0,
    hasteLevel: 0,
    skullLevel: 0,
    sunbeamLevel: 0,
    familiarLevel: 0,
    skullTimer: 0,
    skulls: [],
    familiars: [],
    beamActive: false,
    beamOnTime: 0,
    beamCooldown: 0,
    beamTick: 0,
    particles: [],
    shakeTimer: 0,
  };
}

/** Equip a Hold rank (0 = unequipped), clamped to `0..HOLD.cap`. */
export function setHoldRank(combat: CombatState, rank: number): void {
  if (!Number.isFinite(rank)) return;
  combat.holdRank = Math.min(HOLD.cap, Math.max(0, Math.floor(rank)));
}

/**
 * Layer the run's boon stacks onto fresh combat (called by state.ts after
 * every draft pick and at run start). Clamps to caps, (re)builds the
 * familiar flank to match, and parks runtime clocks idle — levels only
 * change between incursions, so mid-fight beam/skull state never migrates.
 */
export function applyBoonLevels(
  combat: CombatState,
  build: { arcane: number; haste: number; skulls: number; sunbeam: number; familiar: number },
): void {
  const clamp = (value: number, cap: number): number =>
    Number.isFinite(value) ? Math.min(cap, Math.max(0, Math.floor(value))) : 0;
  combat.arcaneLevel = clamp(build.arcane, ARCANE_CAP);
  combat.hasteLevel = clamp(build.haste, HASTE_CAP);
  combat.skullLevel = clamp(build.skulls, SKULL_CAP);
  combat.sunbeamLevel = clamp(build.sunbeam, SUNBEAM_CAP);
  combat.familiarLevel = clamp(build.familiar, FAMILIAR_CAP_LEVELS);
  combat.skullTimer = 0;
  combat.beamActive = false;
  combat.beamOnTime = 0;
  combat.beamCooldown = 0;
  combat.beamTick = 0;
  syncFamiliars(combat);
}

/** Rebuild the familiar flank to match `familiarLevel` (cap 2, spec 03). */
function syncFamiliars(combat: CombatState): void {
  const wanted = combat.familiarLevel;
  while (combat.familiars.length < wanted) {
    const side: -1 | 1 = combat.familiars.length === 0 ? -1 : 1;
    combat.familiars.push({
      x: combat.wizard.x + side * FAMILIAR_OFFSET_X,
      y: combat.wizard.y + FAMILIAR_OFFSET_Y,
      side,
      fireTimer: FAMILIAR_FIRE_INTERVAL,
    });
  }
  combat.familiars.length = wanted;
}

/** Banish-burst tint per demon kind (matches the render palette). */
const DEMON_BURST_COLORS: Record<DemonKind, string> = {
  imp: '#b3372e',
  cackler: '#c26a1b',
  brute: '#7e1f3d',
  bat: '#8f86a3',
};

/**
 * Spawn a radial juice burst. Past `PARTICLE_CAP` the oldest particles
 * yield to the fresh ones, so the count never exceeds the cap (spec 05).
 */
export function spawnBurst(
  combat: CombatState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
  life = 0.5,
  size = 3,
): void {
  for (let i = 0; i < count; i += 1) {
    if (combat.particles.length >= PARTICLE_CAP) combat.particles.shift();
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.65);
    combat.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      size: size * (0.7 + Math.random() * 0.6),
      color,
    });
  }
}

/** Integrate particles on the fixed clock (pause freezes them). */
function updateParticles(combat: CombatState, step: number): void {
  const damp = Math.max(0, 1 - 3 * step);
  const live: Particle[] = [];
  for (const p of combat.particles) {
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.vx *= damp;
    p.vy *= damp;
    p.life -= step;
    if (p.life > 0) live.push(p);
  }
  combat.particles = live;
}

/** Wizard-owned projectiles in flight (bolts incl. familiar bolts + skulls). */
export function wizardProjectileCount(combat: CombatState): number {
  return combat.wizardBolts.length + combat.skulls.length;
}

/** Seconds left on a spell's cooldown (0 when ready). */
export function cooldownRemaining(combat: CombatState, spellId: string): number {
  return Math.max(0, combat.cooldowns[spellId] ?? 0);
}

/** Effective mana cost of the equipped Hold rank (0 when unequipped). */
export function holdManaCost(combat: CombatState): number {
  const rank = holdRankDef(combat.holdRank);
  return rank === null ? 0 : effectiveCost(rank.cost, combat.modifiers);
}

/** Full effective cooldown of the equipped Hold rank (0 when unequipped). */
export function holdCooldownTotal(combat: CombatState): number {
  const rank = holdRankDef(combat.holdRank);
  return rank === null ? 0 : effectiveCooldown(rank.cooldown, combat.modifiers);
}

export type HoldCastResult = 'cast' | 'no-spell' | 'on-cooldown' | 'no-mana';

/**
 * Project the Hold zone auto-north of the wizard: centered on the wizard's
 * x (clamped so the zone stays in the room), sitting just north of the
 * wizard so it never covers them. The zone is static once cast.
 */
export function holdZoneForWizard(wizard: Wizard, rank: SpellRank, rankIndex: number): HoldZone {
  const y1 = wizard.y - WIZARD_RADIUS - 8;
  const x = Math.min(
    ROOM_RIGHT - rank.zoneW,
    Math.max(ROOM_LEFT, wizard.x - rank.zoneW / 2),
  );
  return {
    x,
    y: y1 - rank.zoneH,
    w: rank.zoneW,
    h: rank.zoneH,
    ttl: rank.duration,
    duration: rank.duration,
    rank: rankIndex,
  };
}

/**
 * Cast the equipped spell from the normalized `spell1` edge (spec 04: Q/E
 * or the spell-button tap). Success deducts effective mana, starts the
 * effective per-spell cooldown, and projects the zone. Any failure sets the
 * `mana-empty` cue timer with no lockout. Returns the outcome so callers
 * (and headless checks) can distinguish the three fail reasons.
 */
export function tryCastHold(combat: CombatState): HoldCastResult {
  const rank = holdRankDef(combat.holdRank);
  if (rank === null) {
    combat.manaEmptyTimer = MANA_EMPTY_CUE_DURATION;
    return 'no-spell';
  }
  if (cooldownRemaining(combat, HOLD.id) > 0) {
    combat.manaEmptyTimer = MANA_EMPTY_CUE_DURATION;
    return 'on-cooldown';
  }
  const cost = effectiveCost(rank.cost, combat.modifiers);
  if (combat.wizard.mana < cost) {
    combat.manaEmptyTimer = MANA_EMPTY_CUE_DURATION;
    return 'no-mana';
  }
  combat.wizard.mana = Math.max(0, combat.wizard.mana - cost);
  combat.cooldowns[HOLD.id] = effectiveCooldown(rank.cooldown, combat.modifiers);
  if (combat.zones.length >= ZONE_CAP) {
    // Perf cap, not a cast gate: the oldest zone yields to the fresh cast.
    combat.zones.shift();
  }
  combat.zones.push(holdZoneForWizard(combat.wizard, rank, combat.holdRank));
  const zone = combat.zones[combat.zones.length - 1];
  if (zone !== undefined) {
    // Shackle sparks where the rune circle lands (spec 05 juice).
    spawnBurst(combat, zone.x + zone.w / 2, zone.y + zone.h / 2, '#9d8fff', 10, 160, 0.5, 3);
  }
  return 'cast';
}

/** True while the demon's center sits inside the zone rect. */
export function demonInZone(demon: Demon, zone: HoldZone): boolean {
  return (
    demon.x >= zone.x &&
    demon.x <= zone.x + zone.w &&
    demon.y >= zone.y &&
    demon.y <= zone.y + zone.h
  );
}

/**
 * Tick zones + roots on the fixed clock: zone TTLs decay (expired zones
 * leave), demon hold timers decay, and any demon covered by a live zone
 * has its root refreshed to that zone's remaining TTL. Covered demons stay
 * rooted exactly while cover lasts; a re-cast's fresh TTL re-roots them.
 */
export function updateHold(combat: CombatState, step: number): void {
  for (const zone of combat.zones) {
    zone.ttl -= step;
  }
  combat.zones = combat.zones.filter((zone) => zone.ttl > 0);
  for (const demon of combat.demons) {
    if (demon.holdTimer > 0) {
      demon.holdTimer = Math.max(0, demon.holdTimer - step);
    }
    for (const zone of combat.zones) {
      if (demonInZone(demon, zone) && zone.ttl > demon.holdTimer) {
        demon.holdTimer = zone.ttl;
      }
    }
  }
}

/**
 * Mana + cooldown clocks on the fixed clock (pause freezes them because
 * `updateCombat` never runs while frozen). Regen reads through `regenMult`;
 * the per-banish trickle (+2, flat) lands in `resolveHits` where demons
 * are banished.
 */
function updateMana(combat: CombatState, step: number): void {
  const { wizard } = combat;
  wizard.mana = Math.min(
    MANA_MAX,
    wizard.mana + effectiveRegen(MANA_REGEN, combat.modifiers) * step,
  );
  if (combat.manaEmptyTimer > 0) {
    combat.manaEmptyTimer = Math.max(0, combat.manaEmptyTimer - step);
  }
  for (const spellId of Object.keys(combat.cooldowns)) {
    combat.cooldowns[spellId] = Math.max(0, (combat.cooldowns[spellId] ?? 0) - step);
  }
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
  // keyboard diagonals arrive pre-normalized from the input driver. Haste
  // scales the wizard only (spec 03); familiars lerp to their flank.
  const moveSpeed = moveSpeedForHaste(archetype.moveSpeed, combat.hasteLevel);
  wizard.x += intent.moveX * moveSpeed * step;
  wizard.y += intent.moveY * moveSpeed * step;
  clampWizard(wizard);
  resolveWizardPillars(wizard, combat.pillars);

  // Auto-cast north is always on (spec 04); Space hold-to-cast needs no key.
  // Sunbeam suppresses normal casts while channeling (spec 03) — the timer
  // freezes so the volley resumes cleanly after the channel.
  if (combat.beamActive) return;
  wizard.castTimer -= step;
  if (wizard.castTimer <= 0) {
    wizard.castTimer += castIntervalForArcane(archetype.castInterval, combat.arcaneLevel);
    const count = boltCountForArcane(combat.arcaneLevel);
    const boltSpeed = wizardBoltSpeedForHaste(combat.hasteLevel);
    // Spread pattern: solo center, double parallel, triple with angled
    // wings (base damage stays 1, spec 03). Partial volleys fit the cap.
    const pattern =
      count >= 3
        ? [{ dx: -8, vx: -140 }, { dx: 0, vx: 0 }, { dx: 8, vx: 140 }]
        : count === 2
          ? [{ dx: -8, vx: 0 }, { dx: 8, vx: 0 }]
          : [{ dx: 0, vx: 0 }];
    for (const slot of pattern) {
      if (wizardProjectileCount(combat) >= WIZARD_PROJECTILE_CAP) break;
      combat.wizardBolts.push({
        x: wizard.x + slot.dx,
        y: wizard.y - WIZARD_RADIUS,
        vx: slot.vx,
        vy: -boltSpeed,
        side: 'wizard',
      });
    }
  }
}

/** Classic sidle: drift across the room, step south + reverse on edge hit.
 * Hold-rooted demons sit out: they are excluded from the edge check and
 * neither drift nor step down while `holdTimer` runs. */
function updateFormation(combat: CombatState, step: number): void {
  const mobile = combat.demons.filter((demon) => demon.holdTimer <= 0);
  if (mobile.length === 0) return;
  // Per-incursion drift multiplier plus the thin-formation speed-up
  // (spec 02): a full late horde sidles well above base, and the last
  // demons move up to 2x faster than their incursion's drift speed.
  const speed =
    driftSpeedForIncursion(combat.incursion) *
    thinSpeedMultiplier(combat.demons.length, combat.initialDemons);
  const dx = combat.formationDir * speed * step;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const demon of mobile) {
    if (demon.x < minX) minX = demon.x;
    if (demon.x > maxX) maxX = demon.x;
  }
  if (minX + dx < ROOM_LEFT || maxX + dx > ROOM_RIGHT) {
    combat.formationDir = combat.formationDir === 1 ? -1 : 1;
    for (const demon of mobile) {
      demon.y += FORMATION_STEP_DOWN;
    }
    return;
  }
  for (const demon of mobile) {
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
    vx: 0,
    vy: HELLFIRE_SPEED,
    side: 'hellfire',
  });
}

/** True while the lord's center sits inside any live Hold zone. */
function isLordSlowed(combat: CombatState): boolean {
  const lord = combat.lord;
  if (lord === null) return false;
  for (const zone of combat.zones) {
    if (
      lord.x >= zone.x &&
      lord.x <= zone.x + zone.w &&
      lord.y >= zone.y &&
      lord.y <= zone.y + zone.h
    ) {
      return true;
    }
  }
  return false;
}

/** Hellfire spread fan from the lord (pattern 0): southward, 1 damage. */
function lordFireSpread(combat: CombatState): void {
  const lord = combat.lord;
  if (lord === null) return;
  const wide = lord.tier >= 3;
  const vxs = wide ? [-240, -160, -80, 0, 80, 160, 240] : [-160, -80, 0, 80, 160];
  for (const vx of vxs) {
    combat.hellfire.push({
      x: lord.x,
      y: lord.y + LORD_RADIUS,
      vx,
      vy: HELLFIRE_SPEED,
      side: 'hellfire',
    });
  }
}

/** Aimed burst at the wizard (pattern 1): `min(5, 2 + tier)` bolts. */
function lordFireAimed(combat: CombatState): void {
  const lord = combat.lord;
  if (lord === null) return;
  const dx = combat.wizard.x - lord.x;
  const dy = combat.wizard.y - lord.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return;
  const count = Math.min(5, 2 + lord.tier);
  for (let i = 0; i < count; i += 1) {
    // Slight speed stagger per bolt so the burst strings out instead of
    // stacking on one pixel (still 1 damage each, spec 02).
    const speed = HELLFIRE_SPEED * (1 + 0.12 * (i - (count - 1) / 2));
    combat.hellfire.push({
      x: lord.x,
      y: lord.y + LORD_RADIUS,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      side: 'hellfire',
    });
  }
}

/** Summon minions around the lord (pattern 2), capped at `LORD_SUMMON_CAP`. */
function lordSummonMinions(combat: CombatState): void {
  const lord = combat.lord;
  if (lord === null) return;
  const room = LORD_SUMMON_CAP - combat.demons.length;
  if (room <= 0) return;
  const count = Math.min(lord.tier >= 3 ? 3 : 2, room);
  for (let i = 0; i < count; i += 1) {
    const kind: DemonKind =
      lord.tier >= 2 && i % 3 === 2 ? 'brute' : i % 2 === 0 ? 'imp' : 'cackler';
    const x = Math.min(
      ROOM_RIGHT - DEMON_RADIUS,
      Math.max(ROOM_LEFT + DEMON_RADIUS, lord.x + (i - (count - 1) / 2) * 44),
    );
    combat.demons.push({
      kind,
      x,
      y: Math.min(WARD_LINE_Y - 24, lord.y + 40),
      hp: demonHpForKind(kind),
      holdTimer: 0,
    });
  }
}

/**
 * Lord drift + attack cycle on the fixed clock (pause freezes it because
 * `updateCombat` never runs while frozen). Drift slows 50% inside Hold
 * zones (never rooted); attacks continue while slowed — Hold pins
 * movement, not attacks.
 */
function updateDemonLord(combat: CombatState, step: number): void {
  const lord = combat.lord;
  if (lord === null) return;
  const slowed = isLordSlowed(combat);
  const speed =
    LORD_BASE_SPEED * (1 + 0.05 * lord.tier) * (slowed ? HOLD_LORD_SLOW : 1);
  lord.x += lord.dir * speed * step;
  if (lord.x < ROOM_LEFT + LORD_RADIUS) {
    lord.x = ROOM_LEFT + LORD_RADIUS;
    lord.dir = 1;
  } else if (lord.x > ROOM_RIGHT - LORD_RADIUS) {
    lord.x = ROOM_RIGHT - LORD_RADIUS;
    lord.dir = -1;
  }
  lord.attackTimer -= step;
  if (lord.attackTimer > 0) return;
  lord.attackTimer += lordAttackIntervalForTier(lord.tier);
  const pattern = lord.patternIndex % 3;
  lord.patternIndex += 1;
  if (pattern === 0) lordFireSpread(combat);
  else if (pattern === 1) lordFireAimed(combat);
  else lordSummonMinions(combat);
}

/**
 * Banish the live lord: pays `500 x tier` souls plus the flat +2 mana
 * trickle (like any banish), then clears the slot. Callers check
 * `lord.hp <= 0` after dealing damage and fold the return into the step's
 * souls. Returns 0 when no lord is live or it survives.
 */
function banishLordIfDead(combat: CombatState): number {
  const lord = combat.lord;
  if (lord === null || lord.hp > 0) return 0;
  combat.lord = null;
  combat.wizard.mana = Math.min(MANA_MAX, combat.wizard.mana + MANA_PER_BANISH);
  // Lord banish: large ember + bone eruption (spec 05 juice).
  spawnBurst(combat, lord.x, lord.y, '#ff7a2f', 24, 260, 0.8, 4);
  spawnBurst(combat, lord.x, lord.y, '#e8e0d0', 16, 180, 0.6, 3);
  return lordSoulsForTier(lord.tier);
}

/** Nearest live demon to a point (skull homing + familiar aim). */
function nearestDemon(combat: CombatState, x: number, y: number): Demon | null {
  let best: Demon | null = null;
  let bestDist = Infinity;
  for (const demon of combat.demons) {
    const dist = (demon.x - x) * (demon.x - x) + (demon.y - y) * (demon.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = demon;
    }
  }
  return best;
}

/**
 * Nearest live target (demon or lord) to a point for skull homing and
 * familiar aim. Returns world coords plus which side hit; null when
 * nothing is live.
 */
function nearestTarget(
  combat: CombatState,
  x: number,
  y: number,
): { x: number; y: number; isLord: boolean; demon: Demon | null } | null {
  const demon = nearestDemon(combat, x, y);
  const demonDist =
    demon === null ? Infinity : (demon.x - x) * (demon.x - x) + (demon.y - y) * (demon.y - y);
  const lord = combat.lord;
  const lordDist =
    lord === null ? Infinity : (lord.x - x) * (lord.x - x) + (lord.y - y) * (lord.y - y);
  if (demon === null && lord === null) return null;
  if (lord !== null && lordDist <= demonDist) {
    return { x: lord.x, y: lord.y, isLord: true, demon: null };
  }
  if (demon !== null) {
    return { x: demon.x, y: demon.y, isLord: false, demon };
  }
  return null;
}

/** Award souls + the flat +2 mana trickle for one banished demon. */
function banishDemon(combat: CombatState, index: number): number {
  const demon = combat.demons[index];
  combat.demons.splice(index, 1);
  combat.wizard.mana = Math.min(MANA_MAX, combat.wizard.mana + MANA_PER_BANISH);
  // Banish burst: kind-tinted debris + bone-white sparks (spec 05 juice).
  spawnBurst(combat, demon.x, demon.y, DEMON_BURST_COLORS[demon.kind], 8, 200, 0.5, 3);
  spawnBurst(combat, demon.x, demon.y, '#e8e0d0', 4, 140, 0.35, 2);
  return demonSoulsForKind(demon.kind);
}

/** Remove every demon at 0 HP after splash/beam ticks; returns souls gained. */
function sweepBanished(combat: CombatState): number {
  let souls = 0;
  for (let i = combat.demons.length - 1; i >= 0; i -= 1) {
    if (combat.demons[i].hp <= 0) souls += banishDemon(combat, i);
  }
  return souls;
}

/**
 * Skull volley spawns on the fixed clock (spec 03). Suppressed while the
 * sunbeam channels; fizzles (no skull, timer still resets) when no demon
 * or lord is live. Volleys share the ~40 wizard-projectile cap with bolts.
 */
function updateSkullSpawns(combat: CombatState, step: number): void {
  const level = Math.min(SKULL_CAP, Math.max(0, Math.floor(combat.skullLevel)));
  if (level <= 0 || combat.beamActive) return;
  combat.skullTimer -= step;
  if (combat.skullTimer > 0) return;
  combat.skullTimer += SKULL_INTERVALS[level];
  if (combat.demons.length === 0 && combat.lord === null) return;
  const count = SKULL_COUNTS[level];
  for (let i = 0; i < count; i += 1) {
    if (wizardProjectileCount(combat) >= WIZARD_PROJECTILE_CAP) break;
    combat.skulls.push({
      x: combat.wizard.x + (count === 1 ? 0 : i === 0 ? -6 : 6),
      y: combat.wizard.y - WIZARD_RADIUS,
      vx: 0,
      vy: -SKULL_SPEED,
      life: SKULL_LIFE,
    });
  }
}

/**
 * Home skulls onto the nearest live target (demon or lord); on impact deal
 * 1 direct + 1 splash to every other demon within 60px (a lord direct hit
 * splashes nearby minions). Returns souls banished.
 */
function updateSkulls(combat: CombatState, step: number): number {
  let souls = 0;
  const live: Skull[] = [];
  for (const skull of combat.skulls) {
    const target = nearestTarget(combat, skull.x, skull.y);
    if (target !== null) {
      const dx = target.x - skull.x;
      const dy = target.y - skull.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        skull.vx = (dx / dist) * SKULL_SPEED;
        skull.vy = (dy / dist) * SKULL_SPEED;
      }
    }
    skull.x += skull.vx * step;
    skull.y += skull.vy * step;
    skull.life -= step;
    if (skull.life <= 0) continue;
    if (
      skull.x < ROOM_LEFT - 24 ||
      skull.x > ROOM_RIGHT + 24 ||
      skull.y < ROOM_TOP - 24 ||
      skull.y > ROOM_BOTTOM + 24
    ) {
      continue;
    }
    // Lord impact first (larger target, often above the minions).
    if (
      combat.lord !== null &&
      circlesHit(skull.x, skull.y, SKULL_RADIUS, combat.lord.x, combat.lord.y, LORD_RADIUS)
    ) {
      combat.lord.hp -= 1;
      for (const demon of combat.demons) {
        const dx = demon.x - combat.lord.x;
        const dy = demon.y - combat.lord.y;
        if (dx * dx + dy * dy <= SKULL_SPLASH_RADIUS * SKULL_SPLASH_RADIUS) {
          demon.hp -= 1;
        }
      }
      souls += sweepBanished(combat);
      souls += banishLordIfDead(combat);
      continue;
    }
    let hit: Demon | null = null;
    for (const demon of combat.demons) {
      if (
        circlesHit(skull.x, skull.y, SKULL_RADIUS, demon.x, demon.y, DEMON_RADIUS)
      ) {
        hit = demon;
        break;
      }
    }
    if (hit === null) {
      live.push(skull);
      continue;
    }
    // Direct hit + splash (consumed either way).
    hit.hp -= 1;
    for (const demon of combat.demons) {
      if (demon === hit) continue;
      const dx = demon.x - hit.x;
      const dy = demon.y - hit.y;
      if (dx * dx + dy * dy <= SKULL_SPLASH_RADIUS * SKULL_SPLASH_RADIUS) {
        demon.hp -= 1;
      }
    }
    souls += sweepBanished(combat);
    souls += banishLordIfDead(combat);
  }
  combat.skulls = live;
  return souls;
}

/** Live beam rect (piercing north column over the wizard), or null unequipped. */
export function beamRectForWizard(
  wizard: Wizard,
  sunbeamLevel: number,
): { x: number; y: number; w: number; h: number } | null {
  const level = Math.min(SUNBEAM_CAP, Math.max(0, Math.floor(sunbeamLevel)));
  if (level <= 0) return null;
  const w = SUNBEAM_WIDTHS[level];
  const x = Math.min(
    ROOM_RIGHT - w,
    Math.max(ROOM_LEFT, wizard.x - w / 2),
  );
  return { x, y: ROOM_TOP, w, h: Math.max(0, wizard.y - ROOM_TOP) };
}

/**
 * Sunbeam heat/cooldown channel (spec 03): holding `beam` (Space or the
 * spell-button hold) lights the beam until the heat budget (`SUNBEAM_MAX_ON`)
 * is spent, which forces the level's cooldown. Releasing early dumps the
 * heat with no cooldown, so tapping never punishes. Unequipped = no beam.
 */
function updateSunbeamChannel(combat: CombatState, intent: Intent, step: number): void {
  const level = Math.min(SUNBEAM_CAP, Math.max(0, Math.floor(combat.sunbeamLevel)));
  if (level <= 0) {
    combat.beamActive = false;
    combat.beamOnTime = 0;
    combat.beamCooldown = 0;
    combat.beamTick = 0;
    return;
  }
  if (combat.beamCooldown > 0) {
    combat.beamCooldown = Math.max(0, combat.beamCooldown - step);
  }
  if (combat.beamActive) {
    if (!intent.beam) {
      combat.beamActive = false;
      combat.beamOnTime = 0;
      combat.beamTick = 0;
      return;
    }
    combat.beamOnTime += step;
    if (combat.beamOnTime >= SUNBEAM_MAX_ON[level]) {
      combat.beamActive = false;
      combat.beamOnTime = 0;
      combat.beamTick = 0;
      combat.beamCooldown = SUNBEAM_COOLDOWNS[level];
    }
    return;
  }
  if (intent.beam && combat.beamCooldown <= 0) {
    combat.beamActive = true;
    combat.beamOnTime = 0;
    combat.beamTick = 0;
  }
}

/**
 * Beam damage ticks while the channel is live: 1 damage per
 * `BEAM_TICK_INTERVAL` to every demon intersecting the beam (piercing),
 * plus the lord when it intersects. Returns souls banished.
 */
function updateBeamDamage(combat: CombatState, step: number): number {
  if (!combat.beamActive) return 0;
  const rect = beamRectForWizard(combat.wizard, combat.sunbeamLevel);
  if (rect === null) return 0;
  combat.beamTick += step;
  let souls = 0;
  const hitsLord = (lord: DemonLord): boolean => {
    const nearestX = Math.min(rect.x + rect.w, Math.max(rect.x, lord.x));
    const nearestY = Math.min(rect.y + rect.h, Math.max(rect.y, lord.y));
    const dx = lord.x - nearestX;
    const dy = lord.y - nearestY;
    return dx * dx + dy * dy <= LORD_RADIUS * LORD_RADIUS;
  };
  while (combat.beamTick >= BEAM_TICK_INTERVAL) {
    combat.beamTick -= BEAM_TICK_INTERVAL;
    for (const demon of combat.demons) {
      const nearestX = Math.min(rect.x + rect.w, Math.max(rect.x, demon.x));
      const nearestY = Math.min(rect.y + rect.h, Math.max(rect.y, demon.y));
      const dx = demon.x - nearestX;
      const dy = demon.y - nearestY;
      if (dx * dx + dy * dy <= DEMON_RADIUS * DEMON_RADIUS) {
        demon.hp -= 1;
      }
    }
    if (combat.lord !== null && hitsLord(combat.lord)) {
      combat.lord.hp -= 1;
    }
    souls += sweepBanished(combat);
    souls += banishLordIfDead(combat);
    if (combat.demons.length === 0 && combat.lord === null) break;
  }
  return souls;
}

/**
 * Familiars lerp to their wizard flank each step (spec 03: no jitter) and
 * auto-cast aimed 1-damage bolts every 0.5s at their nearest target
 * (demon or lord). Familiars keep firing while the sunbeam channels (only
 * casts + skulls pause) and share the ~40 wizard-projectile cap.
 */
function updateFamiliars(combat: CombatState, step: number): void {
  for (const familiar of combat.familiars) {
    const targetX = combat.wizard.x + familiar.side * FAMILIAR_OFFSET_X;
    const targetY = combat.wizard.y + FAMILIAR_OFFSET_Y;
    const k = Math.min(1, FAMILIAR_LERP_RATE * step);
    familiar.x += (targetX - familiar.x) * k;
    familiar.y += (targetY - familiar.y) * k;
    familiar.fireTimer -= step;
    if (familiar.fireTimer > 0) continue;
    familiar.fireTimer += FAMILIAR_FIRE_INTERVAL;
    const target = nearestTarget(combat, familiar.x, familiar.y);
    if (target === null) continue;
    if (wizardProjectileCount(combat) >= WIZARD_PROJECTILE_CAP) continue;
    const dx = target.x - familiar.x;
    const dy = target.y - familiar.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    combat.wizardBolts.push({
      x: familiar.x,
      y: familiar.y,
      vx: (dx / dist) * WIZARD_BOLT_SPEED,
      vy: (dy / dist) * WIZARD_BOLT_SPEED,
      side: 'wizard',
    });
  }
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
    bolt.x += bolt.vx * step;
    bolt.y += bolt.vy * step;
  }
  const blocks = (bolt: Bolt): boolean => {
    if (bolt.y < ROOM_TOP - 24 || bolt.y > ROOM_BOTTOM + 24) return true;
    // Angled spread / aimed familiar bolts can leave sideways too.
    if (bolt.x < ROOM_LEFT - 24 || bolt.x > ROOM_RIGHT + 24) return true;
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
 * Sets the 1s blink timer and the incursion's took-hit flag (spec 02),
 * plus the screen shake + hit debris (spec 05 juice). Returns true if the
 * hit landed.
 */
function damageWizard(combat: CombatState): boolean {
  const { wizard } = combat;
  if (wizard.hp <= 0 || wizard.invulnTimer > 0) return false;
  wizard.hp -= 1;
  wizard.invulnTimer = WIZARD_INVULN_DURATION;
  combat.tookHit = true;
  combat.shakeTimer = SHAKE_DURATION;
  spawnBurst(combat, wizard.x, wizard.y, '#e5484d', 12, 220, 0.5, 3);
  return true;
}

/**
 * Circle collision, both directions (spec 06: circle/AABB is fine).
 * Wizard bolts (1 damage) banish demons and the lord for souls; each
 * banish also trickles +2 mana (flat, capped at max — spec 03). Hellfire
 * and demon/lord contact deal 1 ward damage through `damageWizard`.
 * Returns souls gained.
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
    if (hitIndex !== -1) {
      const demon = combat.demons[hitIndex];
      demon.hp -= 1;
      if (demon.hp <= 0) {
        souls += banishDemon(combat, hitIndex);
      }
      souls += banishLordIfDead(combat);
      continue;
    }
    if (
      combat.lord !== null &&
      circlesHit(bolt.x, bolt.y, BOLT_RADIUS, combat.lord.x, combat.lord.y, LORD_RADIUS)
    ) {
      combat.lord.hp -= 1;
      souls += banishLordIfDead(combat);
      continue;
    }
    survivingBolts.push(bolt);
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

  // North roaming risks contact damage (spec 02): demon or lord touch
  // burns 1 ward HP through the same invulnerability gate. Demons survive
  // the bump — the ward line behind them still ends the run.
  for (const demon of combat.demons) {
    if (
      circlesHit(demon.x, demon.y, DEMON_RADIUS, combat.wizard.x, combat.wizard.y, WIZARD_RADIUS)
    ) {
      damageWizard(combat);
      break;
    }
  }
  if (
    combat.lord !== null &&
    circlesHit(
      combat.lord.x,
      combat.lord.y,
      LORD_RADIUS,
      combat.wizard.x,
      combat.wizard.y,
      WIZARD_RADIUS,
    )
  ) {
    damageWizard(combat);
  }

  return souls;
}

/**
 * Breach-ends-run (spec 02): any demon — or the lord — at/past the ward
 * line ends the run immediately, even if the wizard is roaming north.
 */
function checkBreach(combat: CombatState): boolean {
  for (const demon of combat.demons) {
    if (demon.y >= WARD_LINE_Y) return true;
  }
  return combat.lord !== null && combat.lord.y >= WARD_LINE_Y;
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
  if (combat.shakeTimer > 0) {
    combat.shakeTimer = Math.max(0, combat.shakeTimer - step);
  }
  updateParticles(combat, step);
  updateMana(combat, step);
  // One-shot spell edge: Q/E or the spell-button tap (spec 04). Consumed
  // here per fixed step; main.ts delivers it on exactly one step via
  // `consumeSpellPress`, so holding Q never multi-casts across steps.
  if (intent.spell1) {
    tryCastHold(combat);
  }
  // Sunbeam channel first: `beamActive` suppresses normal casts + skull
  // spawns below (spec 03); familiars keep firing.
  updateSunbeamChannel(combat, intent, step);
  updateWizard(combat, intent, step, archetype);
  updateHold(combat, step);
  updateFormation(combat, step);
  updateDemonLord(combat, step);
  updateHellfireSpawns(combat, step);
  updateSkullSpawns(combat, step);
  const skullSouls = updateSkulls(combat, step);
  updateFamiliars(combat, step);
  updateBolts(combat, step);
  const beamSouls = updateBeamDamage(combat, step);
  const hitSouls = resolveHits(combat);
  const souls = skullSouls + beamSouls + hitSouls;
  const breached = checkBreach(combat);
  const wizardDead = combat.wizard.hp <= 0;
  // A breached line is never a "clear", even if the last bolt lands first.
  // Lord fights clear only once the lord is banished AND any summoned
  // minions are cleared (spec 02 "banish all demons" extended to the boss).
  const cleared =
    !breached && !wizardDead && combat.demons.length === 0 && combat.lord === null;
  return { souls, breached, cleared, wizardDead };
}
