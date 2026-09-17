// Run state machine (specs 02/06): menu -> incursion -> draft -> … -> gameover,
// plus tactical pause. Draft counts as paused (no demon updates, timers,
// mana, or cooldowns); manual pause overlays `incursion`. The fixed-timestep
// loop freezes every update while `isUpdateFrozen()` is true, so demons,
// projectiles, mana, cooldowns, and particles all stop together.

import { createCombat, setHoldRank, updateCombat, type CombatState } from './entities.ts';
import { DEFAULT_ARCHETYPE } from './entities.ts';
import {
  FALLBACK_HEAL_ID,
  FALLBACK_SOULS_AMOUNT,
  FALLBACK_SOULS_ID,
  drawDraftOffers,
  levelOf,
  type BuildLevels,
  type DraftOffer,
} from './boons.ts';
import { clearBonusForIncursion, noHitBonusForIncursion } from './incursions.ts';
import { MANA_MAX } from './spells.ts';
import type { Intent } from './input.ts';
import { loadHighScore, saveHighScore } from './storage.ts';

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
  /** Best run persisted via `ww.highScore` (spec 06). */
  highScore: number;
  /** True when this run set a new best (game-over badge, spec 05). */
  newBest: boolean;
  /** Current incursion number (1-based once a run starts). */
  incursion: number;
  /** Sim seconds accrued only while the sim runs — proves the freeze. */
  runTime: number;
  /** Room combat (wizard, demons, projectiles, pillars). Null off-run. */
  combat: CombatState | null;
  /**
   * Run build: stacks taken per draftable id (`ward`, …, `hold`). Item 8
   * owns this persistence — fresh incursions rebuild combat through it so
   * Hold ranks and Ward max HP survive the draft, while one-shot fallbacks
   * (heal/souls) apply immediately and leave no stacks. Continuous boon
   * behaviors (arcane/haste/skulls/sunbeam/familiar) read these in item 9.
   */
  levels: BuildLevels;
  /** Live pick-1-of-3 offers while `screen === 'draft'`; empty elsewhere. */
  draftOffers: DraftOffer[];
}

export function createInitialState(): RunState {
  return {
    screen: 'menu',
    paused: false,
    pauseReason: null,
    score: 0,
    highScore: loadHighScore(),
    newBest: false,
    incursion: 0,
    runTime: 0,
    combat: null,
    levels: {},
    draftOffers: [],
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
  state.newBest = false;
  state.incursion = 1;
  state.runTime = 0;
  state.levels = {};
  state.draftOffers = [];
  state.combat = createCombat(1);
  applyBuildToCombat(state);
}

/** Clearing an incursion parks the run on the draft screen (still frozen). */
export function completeIncursion(state: RunState): void {
  if (state.screen !== 'incursion' || state.paused) return;
  state.draftOffers = drawDraftOffers(state.levels);
  state.screen = 'draft';
}

/**
 * Rebuild per-incursion combat through the run build: Hold rank is
 * re-equipped, Ward stacks raise max HP, and the wizard's HP/mana carry
 * over from the cleared incursion (draft is paused — no regen — so mana
 * arrives as it was, clamped to max). Called after every draft pick and
 * at run start; item 9 extends it with continuous boon stats.
 */
function applyBuildToCombat(state: RunState): void {
  if (state.combat === null) return;
  const combat = state.combat;
  setHoldRank(combat, levelOf(state.levels, 'hold'));
  const maxHp = DEFAULT_ARCHETYPE.wardHp + levelOf(state.levels, 'ward');
  combat.wizard.maxHp = maxHp;
  combat.wizard.hp = Math.min(maxHp, Math.max(0, combat.wizard.hp));
  combat.wizard.mana = Math.min(MANA_MAX, Math.max(0, combat.wizard.mana));
}

/** Draft pick (0/1/2) applies its card, then advances to the next incursion. */
export function chooseDraftCard(state: RunState, index: number): void {
  if (state.screen !== 'draft') return;
  const offer = state.draftOffers[index];
  if (offer === undefined) return;
  const combat = state.combat;

  if (offer.id === FALLBACK_HEAL_ID) {
    // One-shot: heal 1 up to max (spec 03 fallback), carried to next combat.
    if (combat !== null) {
      combat.wizard.hp = Math.min(combat.wizard.maxHp, combat.wizard.hp + 1);
    }
  } else if (offer.id === FALLBACK_SOULS_ID) {
    state.score += FALLBACK_SOULS_AMOUNT;
  } else {
    state.levels[offer.id] = levelOf(state.levels, offer.id) + 1;
    if (offer.id === 'ward' && combat !== null) {
      // Ward heals 1 on pickup (spec 03); max HP lands in applyBuild below.
      combat.wizard.hp = Math.min(
        DEFAULT_ARCHETYPE.wardHp + levelOf(state.levels, 'ward'),
        combat.wizard.hp + 1,
      );
    }
  }

  // Carry HP/mana across the draft (no regen while paused), then rebuild.
  const carriedHp = combat?.wizard.hp ?? DEFAULT_ARCHETYPE.wardHp;
  const carriedMana = combat?.wizard.mana ?? MANA_MAX;
  state.screen = 'incursion';
  state.incursion += 1;
  state.draftOffers = [];
  state.combat = createCombat(state.incursion);
  if (state.combat !== null) {
    state.combat.wizard.hp = carriedHp;
    state.combat.wizard.mana = carriedMana;
  }
  applyBuildToCombat(state);
}

/** Death or ward-line breach ends the run (spec 02). Persists a new best. */
export function triggerGameOver(state: RunState): void {
  if (state.screen !== 'incursion' && state.screen !== 'draft') return;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    state.newBest = true;
    saveHighScore(state.score);
  }
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

/** Back out to the menu; clears any pause. Keeps the persisted best. */
export function quitToMenu(state: RunState): void {
  state.screen = 'menu';
  state.paused = false;
  state.pauseReason = null;
  state.score = 0;
  state.newBest = false;
  state.incursion = 0;
  state.runTime = 0;
  state.combat = null;
  state.levels = {};
  state.draftOffers = [];
}

/**
 * Advance sim clocks + room combat; no-op unless the sim is running
 * (freeze-safe: pause/menu/draft/gameover tick nothing). Folds the step's
 * souls into the score, then resolves terminal flags: breach or depleted
 * ward HP ends the run, a banished formation pays the clear bonus (+50%
 * no-hit bonus when the wizard was never touched) and parks on draft.
 */
export function advanceSim(state: RunState, step: number, intent: Intent): void {
  if (!isSimRunning(state) || state.combat === null) return;
  state.runTime += step;
  const result = updateCombat(state.combat, intent, step);
  state.score += result.souls;
  if (result.breached || result.wizardDead) {
    triggerGameOver(state);
    return;
  }
  if (result.cleared) {
    state.score += clearBonusForIncursion(state.incursion);
    if (!state.combat.tookHit) {
      state.score += noHitBonusForIncursion(state.incursion);
    }
    completeIncursion(state);
  }
}
