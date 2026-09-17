// Wizard's Ward — canonical reference-space size (specs 02/04/06).
// All gameplay logic uses these units; render scales to fit (see main.ts).

export const REFERENCE_WIDTH = 960;
export const REFERENCE_HEIGHT = 540;

/** Max DPR used when scaling the canvas (perf cap per spec 06). */
export const MAX_DPR = 2;

// Entity caps (spec 06).
export const WIZARD_PROJECTILE_CAP = 40;
export const PARTICLE_CAP = 200;
export const FAMILIAR_CAP = 2;
export const ZONE_CAP = 4;
