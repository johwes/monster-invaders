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
export const PARTICLE_CAP = 200;
export const FAMILIAR_CAP = 2;
export const ZONE_CAP = 4;
