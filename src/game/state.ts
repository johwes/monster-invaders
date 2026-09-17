// Run state machine shells (specs 02/06).
// Full transitions (menu -> incursion -> draft -> ... -> gameover, tactical
// pause) arrive with PROGRESS item 2; this file only names the screens.

export type Screen = 'menu' | 'run' | 'gameover';

export interface RunState {
  screen: Screen;
  /** Displayed as souls banished; numeric `score` in code (spec 02). */
  score: number;
  /** Current incursion number (1-based once a run starts). */
  incursion: number;
}

export function createInitialState(): RunState {
  return { screen: 'menu', score: 0, incursion: 0 };
}
