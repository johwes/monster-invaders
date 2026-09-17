// Canvas rendering (spec 05). Room, sprites, HUD, and screens arrive
// with PROGRESS item 11; this file paints the item-1 screen shells —
// one distinct placeholder per screen — so boot + loop + scaling are
// verifiable before the real presentation lands.

import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from './constants.ts';
import type { Screen } from './state.ts';

function paintBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#14101c';
  ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
}

function paintTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  hint: string,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#e8e0d0';
  ctx.font = '48px sans-serif';
  ctx.fillText(title, REFERENCE_WIDTH / 2, REFERENCE_HEIGHT / 2 - 40);

  ctx.fillStyle = '#8f86a3';
  ctx.font = '20px sans-serif';
  ctx.fillText(subtitle, REFERENCE_WIDTH / 2, REFERENCE_HEIGHT / 2 + 12);

  ctx.fillStyle = '#5f5878';
  ctx.font = '16px sans-serif';
  ctx.fillText(hint, REFERENCE_WIDTH / 2, REFERENCE_HEIGHT / 2 + 48);
}

function paintMenuShell(ctx: CanvasRenderingContext2D): void {
  paintTitle(
    ctx,
    "Wizard's Ward",
    'menu — placeholder shell',
    'Enter / Space / tap: muster (placeholder)',
  );
}

function paintRunShell(ctx: CanvasRenderingContext2D): void {
  // Empty-room outline only: real floor, portal, pillars, and ward line
  // arrive with items 4/11. Geometry here is a placeholder frame.
  ctx.strokeStyle = '#3a3348';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, REFERENCE_WIDTH - 48, REFERENCE_HEIGHT - 48);

  // Portal mouth (north) placeholder.
  ctx.fillStyle = '#b3541e';
  ctx.fillRect(REFERENCE_WIDTH / 2 - 150, 24, 300, 12);

  // Ward line (south) placeholder.
  ctx.fillStyle = '#6f5fd0';
  ctx.fillRect(48, REFERENCE_HEIGHT - 72, REFERENCE_WIDTH - 96, 3);

  paintTitle(
    ctx,
    'Incursion 0',
    'run — placeholder shell (no demons yet)',
    'Enter / Space / tap: fall back (placeholder)',
  );
}

function paintGameoverShell(ctx: CanvasRenderingContext2D): void {
  paintTitle(
    ctx,
    'The ward falls…',
    'gameover — placeholder shell',
    'Enter / Space / tap: return to menu (placeholder)',
  );
}

export function drawScaffoldScreen(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
): void {
  paintBackground(ctx);
  switch (screen) {
    case 'menu':
      paintMenuShell(ctx);
      break;
    case 'run':
      paintRunShell(ctx);
      break;
    case 'gameover':
      paintGameoverShell(ctx);
      break;
  }
}
