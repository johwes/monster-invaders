// Canvas rendering (spec 05): room, sprites, HUD, screens, and juice.
// PROGRESS item 11 owns this file's presentation pass: HUD (souls,
// incursion, ward pips, mana bar with cost tick, spell cooldown sweep,
// boon icons, lord HP bar, sunbeam heat meter), menu/draft/pause/gameover
// screens, and juice (shake, hit flash, banish bursts, banners, Hold
// pulse) with particles capped at ~200 in entities.ts.

import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from './constants.ts';
import {
  BOLT_RADIUS,
  DEMON_RADIUS,
  LORD_RADIUS,
  PORTAL_MOUTH,
  ROOM_BOTTOM,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  SKULL_RADIUS,
  WARD_LINE_Y,
  WIZARD_RADIUS,
} from './constants.ts';
import type { CombatState, Demon } from './entities.ts';
import {
  beamRectForWizard,
  cooldownRemaining,
  DEFAULT_ARCHETYPE,
  holdCooldownTotal,
  holdManaCost,
  SHAKE_DURATION,
  SHAKE_MAGNITUDE,
  SUNBEAM_COOLDOWNS,
  SUNBEAM_MAX_ON,
} from './entities.ts';
import type { JoystickVisual, TouchScheme } from './input.ts';
import { HOLD, MANA_MAX } from './spells.ts';
import { bannerVisible, type RunState } from './state.ts';

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
 * is equipped instead. Shows the mana-cost label, a cooldown sweep, and a
 * dimmed look when unaffordable, on cooldown, or with no spell (item 7);
 * full art polish arrives with item 11.
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
  { id: 'draft-0', x: 230, y: 168, w: 500, h: 84 },
  { id: 'draft-1', x: 230, y: 264, w: 500, h: 84 },
  { id: 'draft-2', x: 230, y: 360, w: 500, h: 84 },
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

function paintMenuShell(ctx: CanvasRenderingContext2D, state: RunState, ui: ScaffoldUi): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#9d8fff';
  ctx.font = '56px sans-serif';
  ctx.fillText("Wizard's Ward", REFERENCE_WIDTH / 2, 120);

  ctx.fillStyle = '#e8e0d0';
  ctx.font = '20px sans-serif';
  ctx.fillText(
    state.highScore > 0 ? `Best: ${state.highScore} souls` : 'No wards held yet — set a best!',
    REFERENCE_WIDTH / 2,
    172,
  );

  ctx.fillStyle = '#8f86a3';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD / arrows — move · bolts auto-fire north', REFERENCE_WIDTH / 2, 216);
  ctx.fillText('Q — Hold spell · P/Esc — pause · M — mute', REFERENCE_WIDTH / 2, 238);
  ctx.fillText('Touch: thumb-down joystick · tap the spell rune to cast', REFERENCE_WIDTH / 2, 260);
  ctx.fillStyle = '#5f5878';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    'Hold the ward line. Banish every demon before it crosses.',
    REFERENCE_WIDTH / 2,
    288,
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

  // Hold zones (item 7): glowing rune rects projected auto-north at cast
  // time. Over the floor, under combatants; the pulse rides the zone TTL.
  for (const zone of combat.zones) {
    const pulse = 0.16 + 0.06 * Math.sin(zone.ttl * 9);
    ctx.fillStyle = `rgba(111, 95, 208, ${pulse.toFixed(3)})`;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = '#9d8fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(157, 143, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(
      zone.x + zone.w / 2,
      zone.y + zone.h / 2,
      zone.w * 0.28,
      zone.h * 0.28,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

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
    // Held demons show a shackle tint (spec 05).
    if (demon.holdTimer > 0) {
      ctx.strokeStyle = '#9d8fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(demon.x, demon.y, DEMON_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Demon lord (item 10): large horned boss, ember core. Slowed (not
  // rooted) inside Hold zones — the violet ring reads the 50% slow.
  if (combat.lord !== null) {
    const lord = combat.lord;
    ctx.fillStyle = '#d43d2a';
    ctx.beginPath();
    ctx.arc(lord.x, lord.y, LORD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(lord.x, lord.y, 10, 0, Math.PI * 2);
    ctx.fill();
    // Crown horns.
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.moveTo(lord.x - LORD_RADIUS, lord.y - 8);
    ctx.lineTo(lord.x - LORD_RADIUS - 12, lord.y - 28);
    ctx.lineTo(lord.x - LORD_RADIUS + 8, lord.y - 20);
    ctx.moveTo(lord.x + LORD_RADIUS, lord.y - 8);
    ctx.lineTo(lord.x + LORD_RADIUS + 12, lord.y - 28);
    ctx.lineTo(lord.x + LORD_RADIUS - 8, lord.y - 20);
    ctx.fill();
    // Eyes.
    ctx.fillStyle = '#14101c';
    ctx.beginPath();
    ctx.arc(lord.x - 9, lord.y - 4, 3, 0, Math.PI * 2);
    ctx.arc(lord.x + 9, lord.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    let slowed = false;
    for (const zone of combat.zones) {
      if (
        lord.x >= zone.x &&
        lord.x <= zone.x + zone.w &&
        lord.y >= zone.y &&
        lord.y <= zone.y + zone.h
      ) {
        slowed = true;
        break;
      }
    }
    if (slowed) {
      ctx.strokeStyle = '#9d8fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lord.x, lord.y, LORD_RADIUS + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Sunbeam channel (item 9): piercing north column over the wizard.
  // Translucent so demons inside stay readable; full HUD heat meter in 11.
  if (combat.beamActive) {
    const rect = beamRectForWizard(combat.wizard, combat.sunbeamLevel);
    if (rect !== null) {
      ctx.fillStyle = 'rgba(232, 224, 208, 0.35)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
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

  // Homing skulls (item 9): pale seeking circles with hollow eyes.
  for (const skull of combat.skulls) {
    ctx.fillStyle = '#cfc6e8';
    ctx.beginPath();
    ctx.arc(skull.x, skull.y, SKULL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14101c';
    ctx.beginPath();
    ctx.arc(skull.x - 2, skull.y - 1, 1.5, 0, Math.PI * 2);
    ctx.arc(skull.x + 2, skull.y - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Familiars (item 9): bound imp-drakes flanking the wizard.
  for (const familiar of combat.familiars) {
    ctx.fillStyle = '#3fa37a';
    ctx.beginPath();
    ctx.arc(familiar.x, familiar.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.moveTo(familiar.x - 8, familiar.y - 2);
    ctx.lineTo(familiar.x - 13, familiar.y - 8);
    ctx.lineTo(familiar.x - 5, familiar.y - 7);
    ctx.moveTo(familiar.x + 8, familiar.y - 2);
    ctx.lineTo(familiar.x + 13, familiar.y - 8);
    ctx.lineTo(familiar.x + 5, familiar.y - 7);
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

/** Mana bar with the Hold cost tick (spec 05). Failed casts flash the
 * border red while `manaEmptyTimer` runs instead of casting anything. */
const MANA_BAR = { x: 48, y: 508, w: 220, h: 12 };

function paintManaBar(ctx: CanvasRenderingContext2D, state: RunState): void {
  const combat = state.combat;
  if (combat === null) return;
  const frac = Math.min(1, Math.max(0, combat.wizard.mana / MANA_MAX));
  ctx.fillStyle = '#241f33';
  ctx.fillRect(MANA_BAR.x, MANA_BAR.y, MANA_BAR.w, MANA_BAR.h);
  ctx.fillStyle = '#4d7dd1';
  ctx.fillRect(MANA_BAR.x, MANA_BAR.y, MANA_BAR.w * frac, MANA_BAR.h);
  const cost = holdManaCost(combat);
  if (cost > 0) {
    const tickX = MANA_BAR.x + (Math.min(1, cost / MANA_MAX) * MANA_BAR.w);
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(tickX - 1, MANA_BAR.y - 2, 2, MANA_BAR.h + 4);
  }
  ctx.strokeStyle = combat.manaEmptyTimer > 0 ? '#e5484d' : '#3a3348';
  ctx.lineWidth = 2;
  ctx.strokeRect(MANA_BAR.x, MANA_BAR.y, MANA_BAR.w, MANA_BAR.h);
  ctx.fillStyle = '#8f86a3';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`MANA ${Math.floor(combat.wizard.mana)}`, MANA_BAR.x, MANA_BAR.y - 9);
}

/** Juice particles: fading circles over the combatants (spec 05). */
function paintParticles(ctx: CanvasRenderingContext2D, combat: CombatState): void {
  for (const p of combat.particles) {
    const frac = Math.min(1, Math.max(0, p.life / p.maxLife));
    ctx.save();
    ctx.globalAlpha = frac;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.4 + 0.6 * frac)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Center-screen banner with a wall-clock fade (spec 05 juice). */
function paintBanner(ctx: CanvasRenderingContext2D, state: RunState): void {
  const now = performance.now();
  if (!bannerVisible(state, now)) return;
  const alpha = Math.min(1, Math.max(0, (state.bannerUntil - now) / 600));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(state.bannerText).width + 56;
  const x = REFERENCE_WIDTH / 2 - w / 2;
  const y = 92;
  ctx.fillStyle = 'rgba(10, 8, 16, 0.78)';
  ctx.fillRect(x, y, w, 52);
  ctx.strokeStyle = '#9d8fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 52);
  ctx.fillStyle = '#e8e0d0';
  ctx.fillText(state.bannerText, REFERENCE_WIDTH / 2, y + 27);
  ctx.restore();
}

/**
 * Top HUD (spec 05): souls left, incursion center, best right, ward HP
 * pips under the souls, demon lord HP bar on lord fights.
 */
function paintTopHud(ctx: CanvasRenderingContext2D, state: RunState): void {
  const combat = state.combat;
  const best = Math.max(state.highScore, state.score);

  ctx.textBaseline = 'middle';
  ctx.font = '17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e0d0';
  ctx.fillText(`SOULS ${state.score}`, 48, 16);

  ctx.textAlign = 'center';
  ctx.fillStyle = combat?.lord !== null ? '#ff9a7a' : '#8f86a3';
  ctx.fillText(
    combat?.lord !== null
      ? `INCURSION ${state.incursion} — DEMON LORD`
      : `INCURSION ${state.incursion}`,
    REFERENCE_WIDTH / 2,
    16,
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8f86a3';
  ctx.fillText(`BEST ${best}`, REFERENCE_WIDTH - 80, 16);

  // Ward HP pips (spec 05): filled hearts of the ward, hollow when spent.
  if (combat !== null) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5f5878';
    ctx.font = '11px sans-serif';
    ctx.fillText('WARD', 48, 40);
    for (let i = 0; i < combat.wizard.maxHp; i += 1) {
      const cx = 100 + i * 20;
      if (i < combat.wizard.hp) {
        ctx.fillStyle = '#e5484d';
        ctx.beginPath();
        ctx.arc(cx, 40, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#5f5878';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, 40, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Demon lord HP bar (spec 05): top-center bar on lord fights.
  const lord = combat?.lord ?? null;
  if (lord !== null) {
    const barW = 400;
    const barH = 12;
    const barX = REFERENCE_WIDTH / 2 - barW / 2;
    const barY = 28;
    const frac = Math.min(1, Math.max(0, lord.hp / lord.maxHp));
    ctx.fillStyle = '#241f33';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#d43d2a';
    ctx.fillRect(barX, barY, barW * frac, barH);
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e8e0d0';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `DEMON LORD — tier ${lord.tier} · ${Math.max(0, lord.hp)}/${lord.maxHp}`,
      REFERENCE_WIDTH / 2,
      barY + barH + 12,
    );
  }
}

/** One icon per boon slot: letter + level pips, dimmed when unowned. */
function paintBoonIcons(ctx: CanvasRenderingContext2D, combat: CombatState): void {
  const wardLevel = Math.min(
    3,
    Math.max(0, combat.wizard.maxHp - DEFAULT_ARCHETYPE.wardHp),
  );
  const icons: { letter: string; level: number; cap: number }[] = [
    { letter: 'W', level: wardLevel, cap: 3 },
    { letter: 'A', level: combat.arcaneLevel, cap: 4 },
    { letter: 'H', level: combat.hasteLevel, cap: 2 },
    { letter: 'S', level: combat.skullLevel, cap: 3 },
    { letter: 'B', level: combat.sunbeamLevel, cap: 2 },
    { letter: 'F', level: combat.familiarLevel, cap: 2 },
  ];
  icons.forEach((icon, i) => {
    const x = 48 + i * 32;
    const y = 462;
    const owned = icon.level > 0;
    ctx.fillStyle = owned ? '#2a2438' : 'rgba(42, 36, 56, 0.45)';
    ctx.fillRect(x, y, 26, 30);
    ctx.strokeStyle = owned ? '#6f5fd0' : '#3a3348';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 26, 30);
    ctx.fillStyle = owned ? '#e8e0d0' : '#5f5878';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon.letter, x + 13, y + 10);
    for (let p = 0; p < icon.cap; p += 1) {
      ctx.fillStyle = p < icon.level ? '#9d8fff' : '#3a3348';
      ctx.beginPath();
      ctx.arc(x + 6 + p * (icon.cap > 3 ? 4.5 : 6), y + 23, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * Sunbeam heat meter (spec 05 HUD): fills while channeling, drains the
 * forced cooldown after a full burn. Hidden when Sunbeam is unequipped.
 */
const BEAM_METER = { x: 280, y: 508, w: 120, h: 12 };

function paintBeamMeter(ctx: CanvasRenderingContext2D, combat: CombatState): void {
  const level = Math.min(2, Math.max(0, Math.floor(combat.sunbeamLevel)));
  if (level <= 0) return;
  const maxOn = SUNBEAM_MAX_ON[level] || 1;
  const maxCd = SUNBEAM_COOLDOWNS[level] || 1;
  let frac = 0;
  let color = '#3fa37a';
  let label = 'BEAM READY';
  if (combat.beamActive) {
    frac = Math.min(1, combat.beamOnTime / maxOn);
    color = '#e8e0d0';
    label = 'BEAM…';
  } else if (combat.beamCooldown > 0) {
    frac = Math.min(1, combat.beamCooldown / maxCd);
    color = '#e5484d';
    label = `BEAM ${combat.beamCooldown.toFixed(1)}s`;
  }
  ctx.fillStyle = '#241f33';
  ctx.fillRect(BEAM_METER.x, BEAM_METER.y, BEAM_METER.w, BEAM_METER.h);
  ctx.fillStyle = color;
  ctx.fillRect(BEAM_METER.x, BEAM_METER.y, BEAM_METER.w * frac, BEAM_METER.h);
  ctx.strokeStyle = '#3a3348';
  ctx.lineWidth = 2;
  ctx.strokeRect(BEAM_METER.x, BEAM_METER.y, BEAM_METER.w, BEAM_METER.h);
  ctx.fillStyle = '#8f86a3';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, BEAM_METER.x, BEAM_METER.y - 9);
}

/**
 * Spell button (specs 04/05): dedicated ≥56px rune, tap to cast, hold to
 * channel Sunbeam. Shows the Hold rank + mana cost, a cooldown sweep, and
 * a dimmed look when unaffordable, on cooldown, or with no spell equipped.
 */
function paintSpellButton(
  ctx: CanvasRenderingContext2D,
  combat: CombatState | null,
  ui: ScaffoldUi,
): void {
  const b = SPELL_BUTTON;
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = ui.spellFlash ? '#9d8fff' : '#6f5fd0';
  ctx.lineWidth = ui.spellFlash ? 3 : 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (combat !== null && combat.holdRank > 0) {
    const cost = holdManaCost(combat);
    const total = holdCooldownTotal(combat);
    const remaining = cooldownRemaining(combat, HOLD.id);
    const frac = total > 0 ? Math.min(1, remaining / total) : 0;
    const ready = remaining <= 0 && combat.wizard.mana >= cost;
    ctx.fillStyle = ready ? '#e8e0d0' : '#8f86a3';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Hold ${combat.holdRank}`, b.x + b.w / 2, b.y + 20);
    ctx.fillStyle = '#4d7dd1';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${Math.round(cost)} mana`, b.x + b.w / 2, b.y + 42);
    if (!ready) {
      ctx.fillStyle = 'rgba(10, 8, 16, 0.55)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    if (frac > 0) {
      const sweepH = b.h * frac;
      ctx.fillStyle = 'rgba(10, 8, 16, 0.65)';
      ctx.fillRect(b.x, b.y + b.h - sweepH, b.w, sweepH);
    }
    return;
  }
  ctx.fillStyle = '#5f5878';
  ctx.font = '22px sans-serif';
  ctx.fillText('—', b.x + b.w / 2, b.y + 20);
  ctx.font = '11px sans-serif';
  ctx.fillText('no spell', b.x + b.w / 2, b.y + 42);
  ctx.fillStyle = 'rgba(10, 8, 16, 0.55)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

function paintRunShell(ctx: CanvasRenderingContext2D, state: RunState, ui: ScaffoldUi): void {
  // Screen shake (spec 05 juice): the room kicks under a stable HUD.
  // The offset is render-only randomness; the sim stays deterministic.
  ctx.save();
  const shakeFrac =
    state.combat !== null && SHAKE_DURATION > 0
      ? Math.min(1, Math.max(0, state.combat.shakeTimer / SHAKE_DURATION))
      : 0;
  if (shakeFrac > 0) {
    const mag = SHAKE_MAGNITUDE * shakeFrac;
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }
  paintRoom(ctx, state);
  if (state.combat !== null) paintParticles(ctx, state.combat);
  ctx.restore();

  // Ward-hit flash: a red vignette riding the same shake timer.
  if (shakeFrac > 0) {
    ctx.fillStyle = `rgba(229, 72, 77, ${(0.13 * shakeFrac).toFixed(3)})`;
    ctx.fillRect(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  }

  paintTopHud(ctx, state);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#5f5878';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    'Banish every demon before the ward line falls · P/Esc: pause',
    REFERENCE_WIDTH / 2,
    REFERENCE_HEIGHT - 12,
  );

  // Pause button (always visible mid-incursion).
  paintButton(ctx, PAUSE_BUTTON, 'II');

  paintSpellButton(ctx, state.combat, ui);

  paintManaBar(ctx, state);
  if (state.combat !== null) {
    paintBeamMeter(ctx, state.combat);
    paintBoonIcons(ctx, state.combat);
  }

  paintBanner(ctx, state);

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
    'Draft — pick 1 of 3',
    'no skip, no reroll · violet borders are spells',
    '1 / 2 / 3 or tap a card → next incursion',
  );
  state.draftOffers.forEach((offer, index) => {
    const card = DRAFT_CARDS[index];
    if (card === undefined) return;
    // Card base + kind-colored border (violet spells, bone boons).
    ctx.fillStyle = '#2a2438';
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = offer.kind === 'spell' ? '#9d8fff' : '#6f5fd0';
    ctx.lineWidth = 2;
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    const kindLabel = offer.kind === 'spell' ? 'Spell' : 'Boon';
    const pips =
      offer.cap > 0
        ? ` ${'●'.repeat(offer.nextLevel)}${'○'.repeat(Math.max(0, offer.cap - offer.nextLevel))}`
        : '';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e8e0d0';
    ctx.font = '20px sans-serif';
    ctx.fillText(
      `${index + 1}. [${kindLabel}] ${offer.name}${pips}`,
      card.x + 16,
      card.y + 30,
    );
    ctx.fillStyle = '#8f86a3';
    ctx.font = '14px sans-serif';
    ctx.fillText(offer.effect, card.x + 16, card.y + 52);
    ctx.fillStyle = '#4d7dd1';
    ctx.font = '14px sans-serif';
    ctx.fillText(offer.delta, card.x + 16, card.y + 70);
  });
  // The incursion-clear banner rides over the dimmed room (spec 05 juice).
  paintBanner(ctx, state);
}

function paintGameoverShell(ctx: CanvasRenderingContext2D, state: RunState): void {
  const best = Math.max(state.highScore, state.score);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#e8e0d0';
  ctx.font = '48px sans-serif';
  ctx.fillText('The ward falls…', REFERENCE_WIDTH / 2, 150);

  ctx.fillStyle = '#e8e0d0';
  ctx.font = '22px sans-serif';
  ctx.fillText(`Souls banished: ${state.score}`, REFERENCE_WIDTH / 2, 208);

  ctx.fillStyle = '#8f86a3';
  ctx.font = '16px sans-serif';
  ctx.fillText(
    `Best: ${best} · reached incursion ${state.incursion}`,
    REFERENCE_WIDTH / 2,
    238,
  );

  if (state.newBest) {
    ctx.font = '22px sans-serif';
    const label = '✦ NEW BEST ✦';
    const w = ctx.measureText(label).width + 48;
    const x = REFERENCE_WIDTH / 2 - w / 2;
    ctx.fillStyle = '#9d8fff';
    ctx.fillRect(x, 258, w, 44);
    ctx.fillStyle = '#14101c';
    ctx.fillText(label, REFERENCE_WIDTH / 2, 281);
  }

  ctx.fillStyle = '#5f5878';
  ctx.font = '14px sans-serif';
  ctx.fillText('Enter: restart · Esc: menu', REFERENCE_WIDTH / 2, 316);

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
      paintMenuShell(ctx, state, ui);
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
 * point, fading out over ~300ms once the thumb lifts ("fading when idle").
 * The fade is UI-layer wall-clock so it also plays out over the pause
 * overlay; it never touches the sim.
 */
const JOYSTICK_FADE_MS = 300;
let lastStick: JoystickVisual | null = null;
let lastStickSeen = 0;

function paintStick(
  ctx: CanvasRenderingContext2D,
  stick: JoystickVisual,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#6f5fd0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(stick.baseX, stick.baseY, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8f86a3';
  ctx.beginPath();
  ctx.arc(stick.knobX, stick.knobY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawJoystickOverlay(
  ctx: CanvasRenderingContext2D,
  stick: JoystickVisual | null,
): void {
  const now = performance.now();
  if (stick !== null) {
    lastStick = stick;
    lastStickSeen = now;
    paintStick(ctx, stick, 1);
    return;
  }
  if (lastStick !== null && now - lastStickSeen < JOYSTICK_FADE_MS) {
    paintStick(ctx, lastStick, 1 - (now - lastStickSeen) / JOYSTICK_FADE_MS);
  } else {
    lastStick = null;
  }
}
