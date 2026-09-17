// Run state machine (specs 02/06): menu -> incursion -> draft -> … -> gameover,
// plus tactical pause. Draft counts as paused (no demon updates, timers,
// mana, or cooldowns); manual pause overlays `incursion`. The fixed-timestep
// loop freezes every update while `isUpdateFrozen()` is true, so demons,
// projectiles, mana, cooldowns, and particles all stop together.

import { createCombat, updateCombat, type CombatState } from './entities.ts';
import type { Intent } from './input.ts';

export type Screen = 'menu' | 'incursion' | 'draft' | 'gameover';

export type PauseReason = 'manual' | 'blur';

export interface RunState {
  screen: Screen;
  /** Tactical-pause overlay; only meaningful while `screen === 'incursion'`. */
  paused: boolean;
  /** Why the pause was entered; null when unpaused. */
  pauseReason: PauseReason | null;
  /** Displayed as souls banished; numeric `score` in code (spec 02). */
  score: number;
  /** Current incursion number (1-based once a run starts). */
  incursion: number;
  /** Sim seconds accrued only while the sim runs — proves the freeze. */
  runTime: number;
  /** Room combat (wizard, demons, projectiles, pillars). Null off-run. */
  combat: CombatState | null;
}

export function createInitialState(): RunState {
  return {
    screen: 'menu',
    paused: false,
    pauseReason: null,
    score: 0,
    incursion: 0,
    runTime: 0,
    combat: null,
  };
}

/** True while fixed updates may advance (unpaused incursion). */
export function isSimRunning(state: RunState): boolean {
  return state.screen === 'incursion' && !state.paused;
}

/**
 * True while the loop must skip fixed updates. Covers tactical pause plus
 * every non-incursion screen (menu/draft/gameover never tick the sim).
 */
export function isUpdateFrozen(state: RunState): boolean {
  return !isSimRunning(state);
}

/** Menu/gameover -> incursion 1 with a fresh run. */
export function startRun(state: RunState): void {
  state.screen = 'incursion';
  state.paused = false;
  state.pauseReason = null;
  state.score = 0;
  state.incursion = 1;
  state.runTime = 0;
  state.combat = createCombat(1);
}

/** Clearing an incursion parks the run on the draft screen (still frozen). */
export function completeIncursion(state: RunState): void {
  if (state.screen !== 'incursion' || state.paused) return;
  state.screen = 'draft';
}

/** Draft pick (0/1/2) advances to the next incursion. Full card logic lands in item 8. */
export function chooseDraftCard(state: RunState, _index: number): void {
  if (state.screen !== 'draft') return;
  state.screen = 'incursion';
  state.incursion += 1;
  state.combat = createCombat(state.incursion);
}

/** Death or ward-line breach ends the run (spec 02). */
export function triggerGameOver(state: RunState): void {
  if (state.screen !== 'incursion' && state.screen !== 'draft') return;
  state.screen = 'gameover';
  state.paused = false;
  state.pauseReason = null;
}

/** Enter tactical pause; only valid mid-incursion. Returns true if entered. */
export function pauseGame(state: RunState, reason: PauseReason = 'manual'): boolean {
  if (state.screen !== 'incursion' || state.paused) return false;
  state.paused = true;
  state.pauseReason = reason;
  return true;
}

/** Leave tactical pause. Returns true if resumed. */
export function resumeGame(state: RunState): boolean {
  if (state.screen !== 'incursion' || !state.paused) return false;
  state.paused = false;
  state.pauseReason = null;
  return true;
}

export function togglePause(state: RunState, reason: PauseReason = 'manual'): void {
  if (state.paused) {
    resumeGame(state);
  } else {
    pauseGame(state, reason);
  }
}

/** Back out to the menu; clears any pause. */
export function quitToMenu(state: RunState): void {
  state.screen = 'menu';
  state.paused = false;
  state.pauseReason = null;
  state.score = 0;
  state.incursion = 0;
  state.runTime = 0;
  state.combat = null;
}

/**
 * Advance sim clocks + room combat; no-op unless the sim is running
 * (freeze-safe: pause/menu/draft/gameover tick nothing).
 */
export function advanceSim(state: RunState, step: number, intent: Intent): void {
  if (!isSimRunning(state) || state.combat === null) return;
  state.runTime += step;
  updateCombat(state.combat, intent, step);
}
