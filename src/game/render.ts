// Canvas rendering (spec 05). Room, sprites, HUD, and screens arrive
// with PROGRESS item 11; this file paints the item-2 screen shells for the
// run state machine (menu / incursion / draft / gameover + tactical-pause
// overlay) so transitions and the freeze are verifiable before real art lands.

import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from './constants.ts';
import {
  BOLT_RADIUS,
  DEMON_RADIUS,
  PORTAL_MOUTH,
  ROOM_BOTTOM,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  WARD_LINE_Y,
  WIZARD_RADIUS,
} from './constants.ts';
import type { Demon } from './entities.ts';
import type { JoystickVisual, TouchScheme } from './input.ts';
import type { RunState } from './state.ts';

export interface ButtonRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Extra UI state the scaffold shells need (touch scheme, mute, spell cue). */
export interface ScaffoldUi {
  touchScheme: TouchScheme;
  muted: boolean;
  /** Highlight the spell button briefly after a spell press. */
  spellFlash: boolean;
}

/** Pause button: always visible mid-incursion, >=48px (spec 04). */
export const PAUSE_BUTTON: ButtonRect = {
  id: 'pause',
  x: REFERENCE_WIDTH - 64,
  y: 16,
  w: 48,
  h: 48,
};

/**
 * Spell button: dedicated on-screen button, >=56px on the right side
 * (spec 04). Tap casts the equipped spell; hold channels Sunbeam when it
 * is equipped instead. Mana-cost label + cooldown sweep arrive with items
 * 7/11; the shell shows the wiring with a press flash.
 */
export const SPELL_BUTTON: ButtonRect = {
  id: 'spell',
  x: REFERENCE_WIDTH - 88,
  y: REFERENCE_HEIGHT - 104,
  w: 64,
  h: 64,
};

const MENU_BEGIN: ButtonRect = { id: 'begin', x: 380, y: 322, w: 200, h: 52 };

/** Touch-scheme toggle (menu + pause overlay, spec 04). */
const MENU_SCHEME_BUTTON: ButtonRect = {
  id: 'touch-scheme',
  x: 380,
  y: 382,
  w: 200,
  h: 44,
};

/** Mute toggle on the menu (spec 05). */
const MENU_MUTE_BUTTON: ButtonRect = {
  id: 'mute-toggle',
  x: 380,
  y: 434,
  w: 200,
  h: 44,
};

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

/** Touch-scheme toggle inside the pause overlay (spec 04). */
const PAUSE_SCHEME_BUTTON: ButtonRect = {
  id: 'touch-scheme',
  x: 380,
  y: 436,
  w: 200,
  h: 44,
};

const GAMEOVER_BUTTONS: ButtonRect[] = [
  { id: 'restart', x: 330, y: 340, w: 140, h: 52 },
  { id: 'quit-menu', x: 490, y: 340, w: 140, h: 52 },
];

/** Tap targets for the current screen; main.ts hit-tests pointer input. */
export function getButtonsForState(state: RunState): ButtonRect[] {
  switch (state.screen) {
    case 'menu':
      return [MENU_BEGIN, MENU_SCHEME_BUTTON, MENU_MUTE_BUTTON];
    case 'incursion':
      if (state.paused) return [...PAUSE_OVERLAY_BUTTONS, PAUSE_SCHEME_BUTTON];
      return [PAUSE_BUTTON, SPELL_BUTTON];
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

function paintMenuShell(ctx: CanvasRenderingContext2D, ui: ScaffoldUi): void {
  paintTitle(
    ctx,
    "Wizard's Ward",
    'menu — placeholder shell',
    'Enter / Space / Begin: start incursion 1',
  );
  paintButton(ctx, MENU_BEGIN, 'Begin');
  paintButton(
    ctx,
    MENU_SCHEME_BUTTON,
    `Touch: ${ui.touchScheme === 'joystick' ? 'Joystick' : 'Drag'}`,
  );
  paintButton(ctx, MENU_MUTE_BUTTON, `Sound: ${ui.muted ? 'Off' : 'On'} (M)`);
}

const DEMON_COLORS: Record<Demon['kind'], string> = {
  imp: '#b3372e',
  cackler: '#c26a1b',
  brute: '#7e1f3d',
  bat: '#8f86a3',
};

/** Room floor, portal, ward line, pillars, and combatants (item 4 art). */
function paintRoom(ctx: CanvasRenderingContext2D, state: RunState): void {
  // Stone floor.
  ctx.fillStyle = '#1d1826';
  ctx.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_RIGHT - ROOM_LEFT, ROOM_BOTTOM - ROOM_TOP);
  ctx.strokeStyle = '#3a3348';
  ctx.lineWidth = 2;
  ctx.strokeRect(ROOM_LEFT, ROOM_TOP, ROOM_RIGHT - ROOM_LEFT, ROOM_BOTTOM - ROOM_TOP);

  // Portal: ember glow spanning the north mouth.
  const portalW = PORTAL_MOUTH.x1 - PORTAL_MOUTH.x0;
  ctx.fillStyle = '#b3541e';
  ctx.fillRect(PORTAL_MOUTH.x0, ROOM_TOP - 8, portalW, 14);
  ctx.fillStyle = 'rgba(179, 84, 30, 0.25)';
  ctx.fillRect(PORTAL_MOUTH.x0 - 12, ROOM_TOP + 6, portalW + 24, 26);

  // Ward line (south).
  ctx.fillStyle = '#6f5fd0';
  ctx.fillRect(ROOM_LEFT, WARD_LINE_Y, ROOM_RIGHT - ROOM_LEFT, 3);

  const combat = state.combat;
  if (combat === null) return;

  // Rune pillars (rubble-dark as they chip).
  for (const pillar of combat.pillars) {
    if (pillar.hp <= 0) continue;
    ctx.fillStyle = pillar.hp >= 3 ? '#4a4360' : pillar.hp === 2 ? '#3d3752' : '#322c46';
    ctx.fillRect(pillar.x, pillar.y, pillar.w, pillar.h);
    ctx.strokeStyle = '#6f5fd0';
    ctx.lineWidth = 2;
    ctx.strokeRect(pillar.x, pillar.y, pillar.w, pillar.h);
    // HP pips: remaining cover cells.
    ctx.fillStyle = '#8f86a3';
    for (let i = 0; i < pillar.hp; i += 1) {
      ctx.beginPath();
      ctx.arc(pillar.x + 14 + i * 18, pillar.y + pillar.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Demons: horned circles.
  for (const demon of combat.demons) {
    ctx.fillStyle = DEMON_COLORS[demon.kind];
    ctx.beginPath();
    ctx.arc(demon.x, demon.y, DEMON_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.moveTo(demon.x - DEMON_RADIUS, demon.y - 4);
    ctx.lineTo(demon.x - DEMON_RADIUS - 6, demon.y - 14);
    ctx.lineTo(demon.x - DEMON_RADIUS + 4, demon.y - 10);
    ctx.moveTo(demon.x + DEMON_RADIUS, demon.y - 4);
    ctx.lineTo(demon.x + DEMON_RADIUS + 6, demon.y - 14);
    ctx.lineTo(demon.x + DEMON_RADIUS - 4, demon.y - 10);
    ctx.fill();
  }

  // Wizard bolts (northbound) and hellfire (southbound).
  for (const bolt of combat.wizardBolts) {
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(bolt.x - 2, bolt.y - BOLT_RADIUS - 4, 4, 10);
  }
  for (const bolt of combat.hellfire) {
    ctx.fillStyle = '#ff7a2f';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, BOLT_RADIUS + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wizard: arcane-violet robe + brim. Blinks while hit-invulnerable
  // (spec 02: 1s blink) — ~10 Hz toggle off the frozen invuln timer.
  const wizard = combat.wizard;
  const blinking = wizard.invulnTimer > 0 && Math.floor(wizard.invulnTimer * 10) % 2 === 0;
  if (!blinking) {
    ctx.fillStyle = '#6f5fd0';
    ctx.beginPath();
    ctx.arc(wizard.x, wizard.y, WIZARD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.arc(wizard.x, wizard.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintRunShell(ctx: CanvasRenderingContext2D, state: RunState, ui: ScaffoldUi): void {
  paintRoom(ctx, state);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8f86a3';
  ctx.font = '16px sans-serif';
  ctx.fillText(
    `Incursion ${state.incursion} — t=${state.runTime.toFixed(1)}s, souls ${state.score} (best ${Math.max(state.highScore, state.score)})`,
    REFERENCE_WIDTH / 2,
    16,
  );
  ctx.fillStyle = '#5f5878';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    'Banish every demon before the ward line falls · P/Esc: pause',
    REFERENCE_WIDTH / 2,
    REFERENCE_HEIGHT - 12,
  );

  // Pause button (always visible mid-incursion).
  paintButton(ctx, PAUSE_BUTTON, 'II');

  // Spell button (tap = cast, hold = channel). Real mana-cost/cooldown
  // rendering arrives with items 7/11; the flash proves the input edge.
  if (ui.spellFlash) {
    ctx.fillStyle = '#6f5fd0';
    ctx.fillRect(SPELL_BUTTON.x, SPELL_BUTTON.y, SPELL_BUTTON.w, SPELL_BUTTON.h);
  }
  paintButton(ctx, SPELL_BUTTON, 'Hold');

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
    paintButton(
      ctx,
      PAUSE_SCHEME_BUTTON,
      `Touch: ${ui.touchScheme === 'joystick' ? 'Joystick' : 'Drag'}`,
    );
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
  const best = Math.max(state.highScore, state.score);
  const badge = state.newBest ? ' — NEW BEST' : '';
  paintTitle(
    ctx,
    'The ward falls…',
    `gameover — souls ${state.score}, best ${best}${badge}, reached incursion ${state.incursion}`,
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
  ui: ScaffoldUi,
): void {
  paintBackground(ctx);
  switch (state.screen) {
    case 'menu':
      paintMenuShell(ctx, ui);
      break;
    case 'incursion':
      paintRunShell(ctx, state, ui);
      break;
    case 'draft':
      paintDraftShell(ctx, state);
      break;
    case 'gameover':
      paintGameoverShell(ctx, state);
      break;
  }
}

/**
 * Code-drawn floating joystick (spec 05): base + knob at the thumb-down
 * point. Drawn only while a joystick drag is active; the idle fade arrives
 * with the item-11 presentation pass.
 */
export function drawJoystickOverlay(
  ctx: CanvasRenderingContext2D,
  stick: JoystickVisual | null,
): void {
  if (stick === null) return;
  ctx.strokeStyle = '#6f5fd0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(stick.baseX, stick.baseY, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8f86a3';
  ctx.beginPath();
  ctx.arc(stick.knobX, stick.knobY, 22, 0, Math.PI * 2);
  ctx.fill();
}
