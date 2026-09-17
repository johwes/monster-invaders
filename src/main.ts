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
import { createAudio } from './game/audio.ts';
import { isLordIncursion } from './game/incursions.ts';
import { createInput } from './game/input.ts';
import { createLoop } from './game/loop.ts';
import { drawJoystickOverlay, drawScaffoldScreen, hitButtonAt } from './game/render.ts';
import {
  chooseDraftCard,
  createInitialState,
  isUpdateFrozen,
  pauseGame,
  quitToMenu,
  resumeGame,
  startRun,
  advanceSim,
  type Screen,
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
  const audio = createAudio();
  /** Spell-button press flash (input edge proof until items 7/11). */
  let spellFlashUntil = 0;

  function toggleMute(): void {
    audio.setMuted(!audio.muted);
  }

  /** Entry sting for a fresh incursion: lord roar on boss fights (spec 05). */
  function playIncursionEntry(): void {
    audio.play(isLordIncursion(state.incursion) ? 'lord-roar' : 'portal-surge');
  }

  // SFX poll baseline. `pollSfx` runs after every sim step and fires sounds
  // off deltas (score, HP, zones, bolts, screens), so gameplay code stays
  // free of audio calls and nothing fires while frozen.
  const prev = {
    screen: 'menu' as Screen,
    score: 0,
    hp: 3,
    zones: 0,
    manaEmpty: 0,
    bolts: 0,
  };

  function syncPrev(): void {
    prev.screen = state.screen;
    prev.score = state.score;
    const combat = state.combat;
    prev.hp = combat?.wizard.hp ?? prev.hp;
    prev.zones = combat?.zones.length ?? 0;
    prev.manaEmpty = combat?.manaEmptyTimer ?? 0;
    prev.bolts = combat?.wizardBolts.length ?? 0;
  }

  function pollSfx(): void {
    const combat = state.combat;
    if (combat !== null && state.screen === 'incursion') {
      if (combat.wizardBolts.length > prev.bolts) audio.play('cast');
      if (state.score > prev.score) audio.play('banish');
      if (combat.wizard.hp < prev.hp) audio.play('ward-hit');
      if (combat.zones.length > prev.zones) audio.play('hold-cast');
      if (combat.manaEmptyTimer > 0 && prev.manaEmpty <= 0) audio.play('mana-empty');
    }
    if (state.screen !== prev.screen) {
      if (state.screen === 'draft') audio.play('incursion-clear');
      else if (state.screen === 'gameover') audio.play('game-over');
      else if (state.screen === 'incursion') playIncursionEntry();
    }
    syncPrev();
  }

  function startRunWithSound(): void {
    startRun(state);
    playIncursionEntry();
    syncPrev();
  }

  function pickDraftWithSound(index: number): void {
    const before = state.screen;
    chooseDraftCard(state, index);
    if (state.screen !== before) {
      audio.play('draft-boon');
      playIncursionEntry();
      syncPrev();
    }
  }

  const loop = createLoop({
    update(step): void {
      // Item 3 advances input smoothing on the fixed clock; item 4 ticks
      // room combat (wizard, formation, projectiles, pillars) through the
      // same gate, so the isPaused freeze below covers them all.
      input.update(step);
      // One-shot spell edge (item 7): consume the queued Q/E/tap press and
      // hand it to the sim on exactly this step's intent. Reading
      // `getIntent().spell1` after consuming would always be false, and
      // passing the raw queue through would re-fire across steps.
      const spellPressed = input.consumeSpellPress();
      if (spellPressed) {
        // Button-press flash doubles as the tap-edge proof.
        spellFlashUntil = performance.now() + 160;
      }
      const intent = input.getIntent();
      intent.spell1 = spellPressed;
      advanceSim(state, step, intent);
      pollSfx();
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
        muted: audio.muted,
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
        startRunWithSound();
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
        pickDraftWithSound(0);
        break;
      case 'draft-1':
        pickDraftWithSound(1);
        break;
      case 'draft-2':
        pickDraftWithSound(2);
        break;
    }
  }

  window.addEventListener('keydown', (event: KeyboardEvent): void => {
    // Any key is a user gesture: unlock audio (mobile autoplay policy).
    audio.resume();
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
        startRunWithSound();
      }
      return;
    }

    if (state.screen === 'incursion') {
      if (state.paused) {
        if (key === 'p' || key === 'P' || key === 'Escape' || key === 'Enter' || key === ' ') {
          event.preventDefault();
          resumeGame(state);
        } else if (key === 'r' || key === 'R') {
          startRunWithSound();
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
      }
      return;
    }

    if (state.screen === 'draft') {
      if (key === '1') pickDraftWithSound(0);
      else if (key === '2') pickDraftWithSound(1);
      else if (key === '3') pickDraftWithSound(2);
      else if (key === 'Enter') pickDraftWithSound(0);
      return;
    }

    if (state.screen === 'gameover') {
      if (key === 'Enter' || key === ' ' || key === 'r' || key === 'R') {
        event.preventDefault();
        startRunWithSound();
      } else if (key === 'Escape') {
        quitToMenu(state);
      }
    }
  });

  canvas.addEventListener('pointerdown', (event: PointerEvent): void => {
    event.preventDefault();
    // First touch/click unlocks audio (mobile autoplay policy).
    audio.resume();
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
