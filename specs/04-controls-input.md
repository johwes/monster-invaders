# 04 — Controls and Input

Must be playable on desktop and on a phone/tablet browser. Top-down room,
8-way wizard movement across the whole room, bolts auto-fire north;
Hold fires as an auto-north zone.

## Desktop (keyboard)

- Move: arrows or `WASD` in 8 directions (diagonals normalized to base speed),
  clamped to the room interior (portal mouth excluded).
- Cast: bolts auto-fire north continuously (no key needed); `Space` also works
  as hold-to-cast. Sunbeam uses the same key when equipped.
- Spell: `Q` (or `E` alias) casts the equipped active spell (Hold). Fails with
  `mana-empty` cue if mana/cooldown block it.
- Draft: `1/2/3` selects card, `Enter` confirms if focused.
- Pause: `P` or `Esc`. Mute: `M`.

## Touch / mobile (two schemes, one active at a time)

- **Default: floating virtual joystick** — thumb-down in the lower 60% of the
  room spawns the stick base; drag sets direction. Fixed speed in stick
  direction (no magnitude scaling); deadzone ~0.25 of ~60px base radius,
  then full speed. Smoothing on release. Stick must not swallow taps on the
  spell/pause buttons.
- **Fallback: relative-drag** — drag anywhere in the room moves the wizard
  1:1 with finger offset + smoothing. Kept as a settings toggle
  (menu + pause overlay); joystick is the default.
- Both schemes feed the same normalized `intent { moveX, moveY }` (see 06).
- **Cast:** auto-cast always ON (no cast button needed), firing north.
- **Spell button:** dedicated on-screen button (≥56px, right side) with mana-cost
  label and cooldown sweep; disabled look when unaffordable/on cooldown.
  Sunbeam (if equipped instead): same button becomes hold-to-channel.
- **Pause button:** always visible (≥48px top corner). Draft cards are
  full-width tap targets (≥48px), no hover states.
- Prevent page scroll/zoom during play: `touch-action: none`, viewport
  `maximum-scale=1`, wake-lock optional.

## Canvas scaling

- Reference resolution 960×540, letterboxed with `contain` scaling.
- Support portrait: room narrows, formation columns shrink (8 max),
  HUD moves to top bar. Game logic uses reference units, not raw pixels.
- Minimum usable: 320×480 portrait. Test Chrome mobile emulation + one real device.
  Test both touch schemes on device.

## Pause (tactical + coffee breaks)

- Full freeze: demons, projectiles, timers, mana regen, and cooldowns all stop.
- Manual pause on `P`/`Esc`/pause button; auto-pause on `blur`/`visibilitychange`.
  Manual pause overlays resume/restart/quit-to-menu.
- Draft screen counts as paused (no demon updates, no timers, no regen).
- No order-queueing while paused in v1.
