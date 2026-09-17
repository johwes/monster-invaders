// Canvas rendering (spec 05). Room, sprites, HUD, and screens arrive
// with PROGRESS item 11; this file paints the item-2 screen shells for the
// run state machine (menu / incursion / draft / gameover + tactical-pause
// overlay) so transitions and the freeze are verifiable before real art lands.

import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from './constants.ts';
import type { RunState } from './state.ts';

export interface ButtonRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pause button: always visible mid-incursion, >=48px (spec 04). */
export const PAUSE_BUTTON: ButtonRect = {
  id: 'pause',
  x: REFERENCE_WIDTH - 64,
  y: 16,
  w: 48,
  h: 48,
};

const MENU_BEGIN: ButtonRect = { id: 'begin', x: 380, y: 340, w: 200, h: 56 };

const DRAFT_CARDS: ButtonRect[] = [
  { id: 'draft-0', x: 230, y: 180, w: 500, h: 64 },
  { id: 'draft-1', x: 230, y: 256, w: 500, h: 64 },
  { id: 'draft-2', x: 230, y: 332, w: 500, h: 64 },
];

const PAUSE_OVERLAY_BUTTONS: ButtonRect[] = [
  { id: 'resume', x: 380, y: 250, w: 200, h: 52 },
  { id: 'restart', x: 380, y: 312, w: 200, h: 52 },
  { id: 'quit-menu', x: 380, y: 374, w: 200, h: 52 },
];

const GAMEOVER_BUTTONS: ButtonRect[] = [
  { id: 'restart', x: 330, y: 340, w: 140, h: 52 },
  { id: 'quit-menu', x: 490, y: 340, w: 140, h: 52 },
];

/** Tap targets for the current screen; main.ts hit-tests pointer input. */
export function getButtonsForState(state: RunState): ButtonRect[] {
  switch (state.screen) {
    case 'menu':
      return [MENU_BEGIN];
    case 'incursion':
      if (state.paused) return [...PAUSE_OVERLAY_BUTTONS];
      return [PAUSE_BUTTON];
    case 'draft':
      return [...DRAFT_CARDS];
    case 'gameover':
      return [...GAMEOVER_BUTTONS];
  }
}

export function hitButtonAt(
  state: RunState,
  x: number,
  y: number,
): string | null {
  for (const button of getButtonsForState(state)) {
    if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
      return button.id;
    }
  }
  return null;
}

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

function paintButton(ctx: CanvasRenderingContext2D, button: ButtonRect, label: string): void {
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(button.x, button.y, button.w, button.h);
  ctx.strokeStyle = '#6f5fd0';
  ctx.lineWidth = 2;
  ctx.strokeRect(button.x, button.y, button.w, button.h);
  ctx.fillStyle = '#e8e0d0';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, button.x + button.w / 2, button.y + button.h / 2);
}

function paintMenuShell(ctx: CanvasRenderingContext2D): void {
  paintTitle(
    ctx,
    "Wizard's Ward",
    'menu — placeholder shell',
    'Enter / Space / Begin: start incursion 1',
  );
  paintButton(ctx, MENU_BEGIN, 'Begin');
}

function paintRunShell(ctx: CanvasRenderingContext2D, state: RunState): void {
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
    `Incursion ${state.incursion}`,
    `run — placeholder shell (t=${state.runTime.toFixed(1)}s, souls ${state.score})`,
    'C: clear → draft (placeholder) · X: breach → gameover · P/Esc: pause',
  );

  // Pause button (always visible mid-incursion).
  paintButton(ctx, PAUSE_BUTTON, 'II');

  if (state.paused) {
    ctx.fillStyle = 'rgba(10, 8, 16, 0.72)';
    ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
    paintTitle(
      ctx,
      'Paused',
      'freeze: demons, timers, mana, cooldowns',
      'P / Esc / Enter: resume',
    );
    const labels: Record<string, string> = {
      resume: 'Resume',
      restart: 'Restart',
      'quit-menu': 'Menu',
    };
    for (const button of PAUSE_OVERLAY_BUTTONS) {
      paintButton(ctx, button, labels[button.id] ?? button.id);
    }
  }
}

function paintDraftShell(ctx: CanvasRenderingContext2D, state: RunState): void {
  ctx.fillStyle = 'rgba(10, 8, 16, 0.72)';
  ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  paintTitle(
    ctx,
    `Incursion ${state.incursion} clear`,
    'draft — pick 1 of 3 (placeholder cards, real pool in item 8)',
    '1 / 2 / 3 or tap a card → next incursion',
  );
  DRAFT_CARDS.forEach((card, index) => {
    paintButton(ctx, card, `Card ${index + 1} (${index + 1})`);
  });
}

function paintGameoverShell(ctx: CanvasRenderingContext2D, state: RunState): void {
  paintTitle(
    ctx,
    'The ward falls…',
    `gameover — souls ${state.score}, reached incursion ${state.incursion}`,
    'Enter: restart · Esc: menu',
  );
  const labels: Record<string, string> = {
    restart: 'Restart',
    'quit-menu': 'Menu',
  };
  for (const button of GAMEOVER_BUTTONS) {
    paintButton(ctx, button, labels[button.id] ?? button.id);
  }
}

export function drawScaffoldScreen(
  ctx: CanvasRenderingContext2D,
  state: RunState,
): void {
  paintBackground(ctx);
  switch (state.screen) {
    case 'menu':
      paintMenuShell(ctx);
      break;
    case 'incursion':
      paintRunShell(ctx, state);
      break;
    case 'draft':
      paintDraftShell(ctx, state);
      break;
    case 'gameover':
      paintGameoverShell(ctx, state);
      break;
  }
}
