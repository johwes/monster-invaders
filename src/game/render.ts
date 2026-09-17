// Canvas rendering (spec 05). Room, sprites, HUD, and screens arrive
// with PROGRESS item 11; this stub draws the scaffold placeholder so
// the boot path in main.ts is verifiable today.

import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from './constants.ts';
import type { Screen } from './state.ts';

export function drawScaffoldScreen(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
): void {
  ctx.fillStyle = '#14101c';
  ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);

  ctx.fillStyle = '#e8e0d0';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Wizard's Ward", REFERENCE_WIDTH / 2, REFERENCE_HEIGHT / 2 - 24);

  ctx.fillStyle = '#8f86a3';
  ctx.font = '20px sans-serif';
  ctx.fillText(
    `scaffold — screen: ${screen}`,
    REFERENCE_WIDTH / 2,
    REFERENCE_HEIGHT / 2 + 28,
  );
}
