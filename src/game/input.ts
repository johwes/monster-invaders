// Normalized input intent (specs 04/06). Keyboard + touch drivers fill
// this; entities read it and never check raw keys (spec 06).
// Driver implementations arrive with PROGRESS item 3.

export interface Intent {
  /** Normalized direction vector (fixed speed above deadzone). */
  moveX: number;
  moveY: number;
  /** Hold-to-cast (Space); auto-cast is always on. */
  casting: boolean;
  /** Hold-to-channel Sunbeam when equipped. */
  beam: boolean;
  /** Cast the equipped active spell (Q/E). */
  spell1: boolean;
}

export function createNeutralIntent(): Intent {
  return { moveX: 0, moveY: 0, casting: false, beam: false, spell1: false };
}
