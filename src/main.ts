// Boot, canvas sizing, and screen switching (spec 06).
// Item 1 wires the fixed-timestep loop: 60 Hz updates with clamped delta,
// logic in 960x540 reference units, render scaled with DPR capped at 2.
// Screen transitions here are placeholders cycled by key/tap — the real
// run state machine arrives with PROGRESS item 2.

import './style.css';
import {
  MAX_DPR,
  REFERENCE_HEIGHT,
  REFERENCE_WIDTH,
} from './game/constants.ts';
import { createLoop } from './game/loop.ts';
import { drawScaffoldScreen } from './game/render.ts';
import { createInitialState } from './game/state.ts';

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

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (canvas === null) return;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const state = createInitialState();

  const loop = createLoop({
    update(_step): void {
      // TODO(item 2+): advance the run simulation here. No entities yet —
      // the 60 Hz tick itself is the item-1 deliverable.
    },
    render(): void {
      // Re-derive the transform every frame: DPR can change without a
      // resize (e.g. window dragged across monitors).
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      ctx.setTransform(viewScale * dpr, 0, 0, viewScale * dpr, 0, 0);
      drawScaffoldScreen(ctx, state.screen);
    },
  });

  // TODO(item 2): replace with the menu -> incursion -> gameover machine.
  const cycleScreen = (): void => {
    state.screen =
      state.screen === 'menu'
        ? 'run'
        : state.screen === 'run'
          ? 'gameover'
          : 'menu';
  };
  window.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cycleScreen();
    }
  });
  canvas.addEventListener('click', cycleScreen);

  window.addEventListener('resize', (): void => {
    resize(canvas);
  });
  resize(canvas);
  loop.start();
}

boot();
