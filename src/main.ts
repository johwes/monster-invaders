// Boot, canvas sizing, and screen switching (spec 06).
// The fixed-timestep loop and state machine arrive with PROGRESS items
// 1-2; today this mounts the canvas, fits 960x540 reference units with
// DPR capped at 2, and paints the scaffold placeholder.

import './style.css';
import {
  MAX_DPR,
  REFERENCE_HEIGHT,
  REFERENCE_WIDTH,
} from './game/constants.ts';
import { drawScaffoldScreen } from './game/render.ts';
import { createInitialState } from './game/state.ts';

function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const scale = Math.min(
    window.innerWidth / REFERENCE_WIDTH,
    window.innerHeight / REFERENCE_HEIGHT,
  );

  canvas.width = Math.round(REFERENCE_WIDTH * scale * dpr);
  canvas.height = Math.round(REFERENCE_HEIGHT * scale * dpr);
  canvas.style.width = `${Math.round(REFERENCE_WIDTH * scale)}px`;
  canvas.style.height = `${Math.round(REFERENCE_HEIGHT * scale)}px`;

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  return ctx;
}

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (canvas === null) return;

  const state = createInitialState();

  const paint = (): void => {
    const ctx = fitCanvas(canvas);
    if (ctx === null) return;
    drawScaffoldScreen(ctx, state.screen);
  };

  window.addEventListener('resize', paint);
  paint();
}

boot();
