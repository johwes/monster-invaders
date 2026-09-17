// localStorage persistence (spec 06). Keys are locked; every access is
// guarded with try/catch for private mode (spec 06).

const HIGH_SCORE_KEY = 'ww.highScore';
const MUTED_KEY = 'ww.muted';

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(score)));
  } catch {
    // Private mode: high score simply does not persist.
  }
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Private mode: mute preference simply does not persist.
  }
}
