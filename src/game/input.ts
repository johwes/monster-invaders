// Normalized input intent (specs 04/06). Keyboard + touch drivers fill
// this; entities read it and never check raw keys (spec 06).
//
// Drivers (PROGRESS item 3):
// - Keyboard: WASD/arrows move (diagonals normalized), Space hold-to-cast
//   (also the Sunbeam channel key when equipped), Q/E casts the equipped
//   active spell as a one-shot edge (`spell1`).
// - Touch: floating virtual joystick (default) or relative-drag fallback.
//   Both feed the same normalized `moveX/moveY`; there is no cast button
//   because auto-cast is always on. The on-screen spell button is a tap for
//   the `spell1` edge and a hold for the `beam` channel; pause/draft/mute
//   buttons are hit-tested by main.ts via render.ts and never captured as
//   movement, so the stick cannot swallow taps on them.

export interface Intent {
  /** Normalized direction vector (fixed speed above deadzone). */
  moveX: number;
  moveY: number;
  /** Hold-to-cast (Space); auto-cast is always on. */
  casting: boolean;
  /** Hold-to-channel Sunbeam when equipped (Space or spell-button hold). */
  beam: boolean;
  /** Cast the equipped active spell (Q/E or spell-button tap). Edge: the
   * game must consume it via `consumeSpellPress()` once per update. */
  spell1: boolean;
}

export function createNeutralIntent(): Intent {
  return { moveX: 0, moveY: 0, casting: false, beam: false, spell1: false };
}

/** Active touch movement scheme. Joystick is the default (spec 04). */
export type TouchScheme = 'joystick' | 'drag';

/** Floating-joystick base radius in reference units (spec 06: ~60px). */
export const JOYSTICK_BASE_RADIUS = 60;
/** Joystick deadzone as a fraction of the base radius (spec 04/06: ~0.25). */
export const JOYSTICK_DEADZONE = 0.25;
/** Relative-drag deadzone in reference units (jitter filter). */
export const DRAG_DEADZONE = 4;
/**
 * Exponential smoothing rate (per second) applied to the touch movement
 * vector. Covers "smoothing on release": when the thumb lifts, the intent
 * decays to zero instead of snapping. Keyboard snaps via the same path
 * because the rate is fast enough (~40ms time constant) to feel instant.
 */
export const MOVE_SMOOTHING_RATE = 25;

/** Code-drawn joystick state for the render overlay (spec 05). */
export interface JoystickVisual {
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
}

export interface MoveVector {
  x: number;
  y: number;
}

/**
 * Keyboard movement tokens. The manager normalizes raw `event.key` values
 * into these on keydown; this helper maps a held-token set to a normalized
 * direction (diagonals scaled to base speed, spec 04).
 */
export function computeKeyboardMove(held: ReadonlySet<string>): MoveVector {
  let x = 0;
  let y = 0;
  if (held.has('left')) x -= 1;
  if (held.has('right')) x += 1;
  if (held.has('up')) y -= 1;
  if (held.has('down')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.SQRT2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

/**
 * Floating-joystick deflection: offset from the stick base in reference
 * units. Inside the deadzone the intent is zero; above it the intent is a
 * fixed-speed normalized direction (no magnitude scaling, spec 04).
 */
export function applyJoystickDeflection(
  offsetX: number,
  offsetY: number,
  radius: number = JOYSTICK_BASE_RADIUS,
  deadzone: number = JOYSTICK_DEADZONE,
): MoveVector {
  const mag = Math.hypot(offsetX, offsetY);
  if (mag < deadzone * radius || mag === 0) return { x: 0, y: 0 };
  return { x: offsetX / mag, y: offsetY / mag };
}

/**
 * Relative-drag deflection: finger offset from the drag anchor in reference
 * units. Small offsets (at/below the deadzone) are jitter and map to zero;
 * anything larger maps to a fixed-speed normalized direction, matching the
 * normalized `intent` contract in spec 06.
 */
export function applyDragDeflection(
  offsetX: number,
  offsetY: number,
  deadzone: number = DRAG_DEADZONE,
): MoveVector {
  const mag = Math.hypot(offsetX, offsetY);
  if (mag <= deadzone || mag === 0) return { x: 0, y: 0 };
  return { x: offsetX / mag, y: offsetY / mag };
}

export interface InputManager {
  /** Current normalized intent. Neutral while move capture is disabled. */
  getIntent(): Intent;
  /** Returns true once per queued spell press (Q/E or spell-button tap). */
  consumeSpellPress(): boolean;
  /** Advance touch smoothing; call once per fixed update with the step. */
  update(dt: number): void;
  /** True only mid-incursion while unpaused; gates capture + intent. */
  setMoveCaptureEnabled(enabled: boolean): void;
  getTouchScheme(): TouchScheme;
  setTouchScheme(scheme: TouchScheme): void;
  toggleTouchScheme(): TouchScheme;
  /** Route a non-button pointer into the active move driver. */
  beginMovePointer(pointerId: number, x: number, y: number): void;
  updateMovePointer(pointerId: number, x: number, y: number): void;
  endMovePointer(pointerId: number): void;
  /** Spell-button hold (Sunbeam channel); tap edge via `queueSpellPress`. */
  beginSpellHold(pointerId: number): void;
  endSpellHold(pointerId: number): void;
  queueSpellPress(): void;
  isSpellHeld(): boolean;
  /** Non-null while a joystick drag is active (render overlay). */
  getJoystick(): JoystickVisual | null;
  destroy(): void;
}

/** Map a raw `event.key` to a movement token, or null if not a move key. */
function toMoveToken(key: string): string | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

export function createInput(): InputManager {
  const heldKeys = new Set<string>();
  let spaceHeld = false;
  let spellQueued = false;
  let captureEnabled = false;
  let touchScheme: TouchScheme = 'joystick';

  let smoothX = 0;
  let smoothY = 0;

  // Active movement pointer (single-finger steering; a second finger is
  // free for the spell button). Joystick stores base+current; drag stores
  // anchor+current in the same fields.
  let movePointerId: number | null = null;
  let anchorX = 0;
  let anchorY = 0;
  let currentX = 0;
  let currentY = 0;

  let spellHoldId: number | null = null;

  function touchTarget(): MoveVector | null {
    if (movePointerId === null) return null;
    const dx = currentX - anchorX;
    const dy = currentY - anchorY;
    return touchScheme === 'joystick'
      ? applyJoystickDeflection(dx, dy)
      : applyDragDeflection(dx, dy);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const token = toMoveToken(event.key);
    if (token !== null) {
      heldKeys.add(token);
      if (captureEnabled) event.preventDefault();
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      spaceHeld = true;
      if (captureEnabled) event.preventDefault();
      return;
    }
    if ((event.key === 'q' || event.key === 'Q' || event.key === 'e' || event.key === 'E') && !event.repeat) {
      // Edge only while the sim can act on it: while paused `Q` is the
      // quit-to-menu shortcut owned by main.ts, so ignore it here.
      if (captureEnabled) {
        spellQueued = true;
        event.preventDefault();
      }
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    const token = toMoveToken(event.key);
    if (token !== null) {
      heldKeys.delete(token);
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') spaceHeld = false;
  }

  function onBlur(): void {
    // Release held keys so focus loss can never leave movement stuck on.
    // (Pause-on-blur itself is owned by main.ts.)
    heldKeys.clear();
    spaceHeld = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    getIntent(): Intent {
      if (!captureEnabled) return createNeutralIntent();
      return {
        moveX: smoothX,
        moveY: smoothY,
        casting: spaceHeld,
        beam: spaceHeld || spellHoldId !== null,
        spell1: spellQueued,
      };
    },

    consumeSpellPress(): boolean {
      const pressed = spellQueued;
      spellQueued = false;
      return pressed;
    },

    update(dt: number): void {
      const touch = touchTarget();
      let targetX = 0;
      let targetY = 0;
      if (touch !== null) {
        targetX = touch.x;
        targetY = touch.y;
      } else if (captureEnabled) {
        const keys = computeKeyboardMove(heldKeys);
        targetX = keys.x;
        targetY = keys.y;
      }
      const k = 1 - Math.exp(-MOVE_SMOOTHING_RATE * Math.max(0, dt));
      smoothX += (targetX - smoothX) * k;
      smoothY += (targetY - smoothY) * k;
      // Snap tiny residuals so the intent truly rests at zero.
      if (targetX === 0 && targetY === 0 && Math.hypot(smoothX, smoothY) < 0.04) {
        smoothX = 0;
        smoothY = 0;
      }
    },

    setMoveCaptureEnabled(enabled: boolean): void {
      captureEnabled = enabled;
      if (!enabled) {
        movePointerId = null;
        spellHoldId = null;
        spellQueued = false;
      }
    },

    getTouchScheme(): TouchScheme {
      return touchScheme;
    },

    setTouchScheme(scheme: TouchScheme): void {
      if (touchScheme === scheme) return;
      touchScheme = scheme;
      // Re-anchor an in-flight drag so the scheme switch cannot fling the
      // wizard with a stale offset from the other driver.
      if (movePointerId !== null) {
        anchorX = currentX;
        anchorY = currentY;
      }
    },

    toggleTouchScheme(): TouchScheme {
      const next: TouchScheme = touchScheme === 'joystick' ? 'drag' : 'joystick';
      // Reuse the setter for the re-anchor behavior.
      if (next !== touchScheme) {
        touchScheme = next;
        if (movePointerId !== null) {
          anchorX = currentX;
          anchorY = currentY;
        }
      }
      return touchScheme;
    },

    beginMovePointer(pointerId: number, x: number, y: number): void {
      if (!captureEnabled || movePointerId !== null) return;
      movePointerId = pointerId;
      anchorX = x;
      anchorY = y;
      currentX = x;
      currentY = y;
    },

    updateMovePointer(pointerId: number, x: number, y: number): void {
      if (pointerId !== movePointerId) return;
      currentX = x;
      currentY = y;
    },

    endMovePointer(pointerId: number): void {
      if (pointerId !== movePointerId) return;
      movePointerId = null;
    },

    beginSpellHold(pointerId: number): void {
      if (!captureEnabled) return;
      spellHoldId = pointerId;
    },

    endSpellHold(pointerId: number): void {
      if (pointerId !== spellHoldId) return;
      spellHoldId = null;
    },

    queueSpellPress(): void {
      if (captureEnabled) spellQueued = true;
    },

    isSpellHeld(): boolean {
      return spellHoldId !== null;
    },

    getJoystick(): JoystickVisual | null {
      if (touchScheme !== 'joystick' || movePointerId === null) return null;
      const dx = currentX - anchorX;
      const dy = currentY - anchorY;
      const mag = Math.hypot(dx, dy);
      const clamped = mag > JOYSTICK_BASE_RADIUS && mag > 0 ? JOYSTICK_BASE_RADIUS / mag : 1;
      return {
        baseX: anchorX,
        baseY: anchorY,
        knobX: anchorX + dx * clamped,
        knobY: anchorY + dy * clamped,
      };
    },

    destroy(): void {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
