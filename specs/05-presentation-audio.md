# 05 — Presentation and Audio

## Art direction

Dark-magic dungeon, top-down: stone floor, glowing portal, rune pillars,
robed wizard, horned demons — all drawn with canvas primitives.
No image/font assets in v1.

- Palette: charcoal stone, ember orange portal glow, arcane violet wizard,
  blood-red/ash demons, bone-white HUD. Keep contrast high for mobile legibility.
- Juice (cheap, high-value): screen shake on ward hit, hit flash,
  banish-burst particles, incursion-clear banner, Hold rune-circle pulse.
  Cap particles (~200) for perf.

## Screens and HUD

- **Menu:** title ("Wizard's Ward"), high score, controls hint, touch-scheme toggle
  (joystick/drag), Begin button, mute toggle.
- **HUD:** souls (left), high score (center or right), incursion number, ward HP
  pips, mana bar with cost tick for Hold, spell button with cooldown sweep,
  active boon icons with levels, demon lord HP bar on lord fights.
- **Draft:** dimmed room + 3 cards labeled Boon/Spell (name, level pips, one-line
  effect with cost/cooldown/duration for spells). Must show what changes
  (e.g. "Cast interval 0.35→0.28s", "Hold 3s→4s").
- **Hold zone:** glowing rune circle projected auto-north of the wizard for its
  duration; held demons show shackle tint. Fails (no mana/cooldown) flash the
  mana bar instead of casting.
- **Pause / game over:** resume/restart/menu; pause overlay notes the freeze
  covers demons, timers, mana, and cooldowns. Game over shows souls banished,
  NEW BEST badge if applicable, and restart + menu buttons. Flavor: "The ward falls…"
- **Virtual joystick:** code-drawn base + knob at thumb-down point, fading when idle;
  never under spell/pause buttons.

## Audio (WebAudio, synthesized)

- Required SFX: cast, banish pop, ward hit, incursion clear, draft boon,
  portal surge / demon lord roar, game over, plus hold-cast (deep bell),
  mana-empty (dull tap). Arcane chimes, crackles, and deep bells via
  oscillators — no sci-fi bleeps.
- No audio assets; a tiny synth module (`audio.ts`) with mute persisted
  in `localStorage`. Audio context must resume on first user gesture
  (mobile autoplay policy).
