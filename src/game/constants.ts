// Wizard's Ward — canonical reference-space size (specs 02/04/06).
// All gameplay logic uses these units; render scales to fit (see main.ts).

export const REFERENCE_WIDTH = 960;
export const REFERENCE_HEIGHT = 540;

/** Max DPR used when scaling the canvas (perf cap per spec 06). */
export const MAX_DPR = 2;

/** Fixed simulation step: 60 Hz updates, decoupled from render (spec 06). */
export const FIXED_STEP = 1 / 60;

/**
 * Max frame delta consumed per rAF tick (seconds). Larger gaps — e.g. after
 * a tab switch — are clamped so the sim never tries to catch up all of them.
 */
export const MAX_FRAME_DELTA = 0.25;

/**
 * Max fixed steps executed per frame. Leftover accumulator beyond this
 * budget is dropped, so the loop can never spiral (spec 06).
 */
export const MAX_STEPS_PER_FRAME = 5;

// Entity caps (spec 06).
export const WIZARD_PROJECTILE_CAP = 40;
// Boon tuning (spec 03, locked in PROGRESS item 9).
/** Homing skull flight speed (px/s, reference units). */
export const SKULL_SPEED = 360;
export const SKULL_RADIUS = 6;
/** Skull splash radius on impact (spec 03: small splash, 60px). */
export const SKULL_SPLASH_RADIUS = 60;
/** Skull lifetime before it fizzles (safety so stray skulls never leak). */
export const SKULL_LIFE = 5;
/** Familiar auto-cast interval (spec 03: 0.5s, 1 damage). */
export const FAMILIAR_FIRE_INTERVAL = 0.5;
/** Familiar flank offsets from the wizard; positions lerp (spec 03). */
export const FAMILIAR_OFFSET_X = 36;
export const FAMILIAR_OFFSET_Y = 4;
export const FAMILIAR_LERP_RATE = 10;
/** Sunbeam damage tick: 1 damage per tick to each demon in the beam
 * (≈16.7 dps per target ≈ 6x the 0.35s base cast, spec 03). */
export const BEAM_TICK_INTERVAL = 0.06;
export const PARTICLE_CAP = 200;
export const FAMILIAR_CAP = 2;
export const ZONE_CAP = 4;

// Room geometry in 960x540 reference units (spec 02). The wizard roams the
// whole interior; the portal mouth (north) is excluded from movement and
// the ward line (south) is the breach line (breach detection: item 5).
export const ROOM_LEFT = 48;
export const ROOM_RIGHT = 912;
export const ROOM_TOP = 56;
export const ROOM_BOTTOM = 492;

/** Portal mouth rect: demons enter here; the wizard may not enter it. */
export const PORTAL_MOUTH = { x0: 330, x1: 630, y1: 110 };

/** Southern line the wizard defends; any demon crossing it ends the run. */
export const WARD_LINE_Y = 468;

/** Wizard starting ground, south of the ward line (spec 02). */
export const WIZARD_START = { x: 480, y: 476 };

export const WIZARD_RADIUS = 14;
export const DEMON_RADIUS = 14;
export const BOLT_RADIUS = 4;

/** Northbound wizard bolt speed (px/s, reference units). */
export const WIZARD_BOLT_SPEED = 540;
/** Southbound hellfire speed (px/s, reference units). */
export const HELLFIRE_SPEED = 240;

/** Brief invulnerability + blink after the wizard takes a hit (spec 02). */
export const WIZARD_INVULN_DURATION = 1.0;

// Formation movement (spec 02). The drift/fire-rate scaling formulas per
// incursion number arrive with item 6; these are the unscaled base values.
export const FORMATION_BASE_SPEED = 26;
export const FORMATION_STEP_DOWN = 16;
export const FORMATION_BASE_FIRE_INTERVAL = 0.9;
export const FORMATION_COL_GAP = 72;
export const FORMATION_ROW_GAP = 44;
/** Formation spawns just inside the portal (entry point for item 4). */
export const FORMATION_START_Y = 130;

// Rune-pillar cover (spec 02): 3 pillars blocking both sides' projectiles.
// HP-cell model: each blocked bolt deals 1 damage; destroyed pillars stop
// blocking. Demon-lord fights have no pillars and pillars rebuild fresh on
// the next normal incursion (locked in item 10).
export const PILLARS = [
  { x: 208, y: 340, w: 64, h: 24, hp: 3 },
  { x: 448, y: 340, w: 64, h: 24, hp: 3 },
  { x: 688, y: 340, w: 64, h: 24, hp: 3 },
];

// Demon lord (spec 02, locked in PROGRESS item 10): one large boss on every
// 5th incursion. Single lord type in v1 with three attack patterns
// (hellfire spread, aimed burst, summon minions) cycling on a tier-scaled
// timer. Contact/bolt damage is 1, like normal demons.
export const LORD_RADIUS = 28;
/** Lord hover line near the portal (drifts horizontally, never dives). */
export const LORD_SPAWN_Y = 150;
/** Unscaled horizontal drift speed (px/s); tier adds +5%/tier. */
export const LORD_BASE_SPEED = 70;
/** Max summoned minions alive at once (summon excess fizzles). */
export const LORD_SUMMON_CAP = 12;
