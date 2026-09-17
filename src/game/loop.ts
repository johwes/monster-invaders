// Fixed-timestep loop (spec 06): 60 Hz updates decoupled from render.
// Frame delta is clamped (tab-switch safe) and steps-per-frame are capped
// (spiral-of-death safe). While paused, updates are skipped entirely —
// demons, projectiles, mana, cooldowns, and particles all freeze — while
// render keeps painting so overlays stay live.

import {
  FIXED_STEP,
  MAX_FRAME_DELTA,
  MAX_STEPS_PER_FRAME,
} from './constants.ts';

export interface LoopHooks {
  update(step: number): void;
  render(): void;
  /** Return true to freeze updates (render still runs). */
  isPaused?: () => boolean;
}

export interface Loop {
  start(): void;
  stop(): void;
  /** Total fixed updates executed — verification aid. */
  getUpdateCount(): number;
}

export function createLoop(hooks: LoopHooks): Loop {
  let rafId = 0;
  let running = false;
  let last = 0;
  let accumulator = 0;
  let updateCount = 0;
  /** Tolerance for step-boundary checks: keeps float dust from making
   * the sim lag systematically behind wall time. */
  const STEP_EPSILON = 1e-9;

  function frame(now: number): void {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    let delta = (now - last) / 1000;
    last = now;
    if (!(delta >= 0)) delta = 0;
    if (delta > MAX_FRAME_DELTA) delta = MAX_FRAME_DELTA;

    if (hooks.isPaused?.() ?? false) {
      // Full freeze: drop pending time so resume continues cleanly.
      accumulator = 0;
      hooks.render();
      return;
    }

    accumulator += delta;
    let steps = 0;
    while (accumulator + STEP_EPSILON >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      hooks.update(FIXED_STEP);
      updateCount += 1;
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    // Drop leftover beyond the per-frame budget instead of spiralling.
    if (accumulator + STEP_EPSILON >= FIXED_STEP) accumulator = 0;

    hooks.render();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      last = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
    },
    getUpdateCount(): number {
      return updateCount;
    },
  };
}
