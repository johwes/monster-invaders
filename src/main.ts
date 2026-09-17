// Boot, canvas sizing, and screen switching (spec 06).
// Item 2 wires the run state machine: menu -> incursion -> draft -> … ->
// gameover, with tactical pause (P/Esc/button, blur auto-pause) freezing
// demons/projectiles/mana/cooldowns/particles via the loop's isPaused hook.
// Item 3 adds the normalized input drivers (keyboard + floating-joystick /
// relative-drag touch, spell/pause buttons, M mute) from game/input.ts.

import './style.css';
import {
  MAX_DPR,
  REFERENCE_HEIGHT,
  REFERENCE_WIDTH,
} from './game/constants.ts';
import { createInput } from './game/input.ts';
import { createLoop } from './game/loop.ts';
import { drawJoystickOverlay, drawScaffoldScreen, hitButtonAt } from './game/render.ts';
import { loadMuted, saveMuted } from './game/storage.ts';
import {
  chooseDraftCard,
  completeIncursion,
  createInitialState,
  isUpdateFrozen,
  pauseGame,
  quitToMenu,
  resumeGame,
  startRun,
  advanceSim,
  triggerGameOver,
} from './game/state.ts';

/** CSS-pixel scale that letterboxes the reference space (`contain`). */
let viewScale = 1;

function resize(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  viewScale = Math.min(
    window.innerWidth / REFERENCE_WIDTH,
    window.innerHeight / REFERENCE_HEIGHT,
  );

  canvas.width = Math.max(1, Math.round(REFERENCE_WIDTH * viewScale * dpr));
  canvas.height = Math.max(1, Math.round(REFERENCE_HEIGHT * viewScale * dpr));
  canvas.style.width = `${Math.round(REFERENCE_WIDTH * viewScale)}px`;
  canvas.style.height = `${Math.round(REFERENCE_HEIGHT * viewScale)}px`;
}

/** Map a pointer event to 960×540 reference units. */
function toReferenceUnits(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * REFERENCE_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * REFERENCE_HEIGHT,
  };
}

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (canvas === null) return;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const state = createInitialState();
  const input = createInput();
  let muted = loadMuted();
  /** Spell-button press flash (input edge proof until items 7/11). */
  let spellFlashUntil = 0;

  function toggleMute(): void {
    muted = !muted;
    saveMuted(muted);
  }

  const loop = createLoop({
    update(step): void {
      // Item 3 advances input smoothing on the fixed clock; item 4 ticks
      // room combat (wizard, formation, projectiles, pillars) through the
      // same gate, so the isPaused freeze below covers them all.
      input.update(step);
      if (input.consumeSpellPress()) {
        // No spell effect until item 7 — flash the button to prove the
        // Q/E/tap edge reached the game through the normalized intent.
        spellFlashUntil = performance.now() + 160;
      }
      advanceSim(state, step, input.getIntent());
    },
    render(): void {
      // Movement capture only mid-incursion while unpaused; buttons and
      // draft/menu input stay live through the state handler below.
      input.setMoveCaptureEnabled(state.screen === 'incursion' && !state.paused);
      // Re-derive the transform every frame: DPR can change without a
      // resize (e.g. window dragged across monitors).
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      ctx.setTransform(viewScale * dpr, 0, 0, viewScale * dpr, 0, 0);
      drawScaffoldScreen(ctx, state, {
        touchScheme: input.getTouchScheme(),
        muted,
        spellFlash: performance.now() < spellFlashUntil,
      });
      drawJoystickOverlay(ctx, input.getJoystick());
    },
    isPaused(): boolean {
      // Full freeze: menu/draft/gameover never tick, and tactical pause
      // drops pending loop time so resume continues cleanly.
      return isUpdateFrozen(state);
    },
  });

  function handleButton(id: string, pointerId?: number): void {
    switch (id) {
      case 'begin':
      case 'restart':
        startRun(state);
        break;
      case 'pause':
        pauseGame(state, 'manual');
        break;
      case 'resume':
        resumeGame(state);
        break;
      case 'quit-menu':
        quitToMenu(state);
        break;
      case 'spell':
        // Tap edge for the equipped spell (item 7 consumes it); the hold
        // doubles as the Sunbeam channel while the finger stays down.
        input.queueSpellPress();
        if (pointerId !== undefined) input.beginSpellHold(pointerId);
        break;
      case 'touch-scheme':
        input.toggleTouchScheme();
        break;
      case 'mute-toggle':
        toggleMute();
        break;
      case 'draft-0':
        chooseDraftCard(state, 0);
        break;
      case 'draft-1':
        chooseDraftCard(state, 1);
        break;
      case 'draft-2':
        chooseDraftCard(state, 2);
        break;
    }
  }

  window.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (event.repeat) return;
    const key = event.key;

    // Global mute (spec 04); persisted via storage.ts for item 11 audio.
    if (key === 'm' || key === 'M') {
      toggleMute();
      return;
    }

    if (state.screen === 'menu') {
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        startRun(state);
      }
      return;
    }

    if (state.screen === 'incursion') {
      if (state.paused) {
        if (key === 'p' || key === 'P' || key === 'Escape' || key === 'Enter' || key === ' ') {
          event.preventDefault();
          resumeGame(state);
        } else if (key === 'r' || key === 'R') {
          startRun(state);
        } else if (key === 'q' || key === 'Q') {
          // Quit-to-menu shortcut exists only while the pause overlay is
          // up; unpaused `Q` stays reserved for the Hold spell (item 7).
          quitToMenu(state);
        }
        return;
      }
      if (key === 'p' || key === 'P' || key === 'Escape') {
        event.preventDefault();
        pauseGame(state, 'manual');
      } else if (key === 'c' || key === 'C') {
        // Placeholder until items 5-6 detect real clears.
        completeIncursion(state);
      } else if (key === 'x' || key === 'X') {
        // Placeholder until item 5 detects real death/breach.
        triggerGameOver(state);
      }
      return;
    }

    if (state.screen === 'draft') {
      if (key === '1') chooseDraftCard(state, 0);
      else if (key === '2') chooseDraftCard(state, 1);
      else if (key === '3') chooseDraftCard(state, 2);
      else if (key === 'Enter') chooseDraftCard(state, 0);
      return;
    }

    if (state.screen === 'gameover') {
      if (key === 'Enter' || key === ' ' || key === 'r' || key === 'R') {
        event.preventDefault();
        startRun(state);
      } else if (key === 'Escape') {
        quitToMenu(state);
      }
    }
  });

  canvas.addEventListener('pointerdown', (event: PointerEvent): void => {
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a drag-continuity nicety; play on without it.
    }
    const point = toReferenceUnits(canvas, event);
    const hit = hitButtonAt(state, point.x, point.y);
    if (hit !== null) {
      // Buttons win over movement so the stick never swallows taps on
      // the spell/pause buttons (spec 04/06).
      handleButton(hit, event.pointerId);
      return;
    }
    if (state.screen === 'incursion' && !state.paused) {
      input.beginMovePointer(event.pointerId, point.x, point.y);
    }
  });

  canvas.addEventListener('pointermove', (event: PointerEvent): void => {
    const point = toReferenceUnits(canvas, event);
    input.updateMovePointer(event.pointerId, point.x, point.y);
  });

  function releasePointer(event: PointerEvent): void {
    input.endMovePointer(event.pointerId);
    input.endSpellHold(event.pointerId);
  }

  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  // Auto-pause on blur / tab-hide (spec 04); only mid-incursion matters.
  window.addEventListener('blur', (): void => {
    pauseGame(state, 'blur');
  });
  document.addEventListener('visibilitychange', (): void => {
    if (document.hidden) pauseGame(state, 'blur');
  });

  window.addEventListener('resize', (): void => {
    resize(canvas);
  });
  resize(canvas);
  loop.start();
}

boot();
