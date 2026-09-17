// Synthesized WebAudio SFX (spec 05, PROGRESS item 11). No audio assets:
// arcane chimes, crackles, and deep bells via oscillators only.
// Mute persists in `localStorage` (`ww.muted`, guarded try/catch).
// The context is created lazily and resumed on first user gesture
// (mobile autoplay policy) — callers must call `resume()` from
// pointer/key handlers; `play` before that is a silent no-op.

import { loadMuted, saveMuted } from './storage.ts';

export type SfxName =
  | 'cast'
  | 'banish'
  | 'ward-hit'
  | 'incursion-clear'
  | 'draft-boon'
  | 'portal-surge'
  | 'lord-roar'
  | 'game-over'
  | 'hold-cast'
  | 'mana-empty';

export interface Audio {
  muted: boolean;
  setMuted(muted: boolean): void;
  /** Schedule one synthesized effect; silent when muted or pre-gesture. */
  play(_name: SfxName): void;
  /** Create/resume the context. Call from user-gesture handlers. */
  resume(): void;
}

interface ToneOpts {
  /** Start frequency (Hz). */
  freq: number;
  /** End frequency (Hz); glides when different. */
  freqEnd?: number;
  /** Seconds. */
  dur: number;
  /** Oscillator shape. */
  type: OscillatorType;
  /** Peak gain (0-1). */
  gain: number;
  /** Delay from now (seconds), for arpeggios. */
  delay?: number;
}

/**
 * Minimum gap between repeats of spammy effects. Auto-cast fires ~3/s
 * and mass banishes land on the same step — without throttling the mixer
 * would stack dozens of overlapping voices.
 */
const THROTTLE_MS: Partial<Record<SfxName, number>> = {
  cast: 140,
  banish: 70,
};

export function createAudio(): Audio {
  let muted = loadMuted();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const lastPlay = new Map<SfxName, number>();

  function ensureContext(): boolean {
    if (ctx !== null) return true;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor === undefined) return false;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(opts: ToneOpts): void {
    if (ctx === null || master === null) return;
    try {
      const now = ctx.currentTime + (opts.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type;
      osc.frequency.setValueAtTime(Math.max(20, opts.freq), now);
      if (opts.freqEnd !== undefined && opts.freqEnd !== opts.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + opts.dur);
      }
      // Fast attack, exponential decay to silence (no clicks).
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + opts.dur + 0.05);
    } catch {
      // A failed voice must never break the game loop.
    }
  }

  return {
    get muted(): boolean {
      return muted;
    },
    setMuted(next: boolean): void {
      muted = next;
      saveMuted(next);
    },
    play(name: SfxName): void {
      if (muted) return;
      const nowMs = performance.now();
      const throttle = THROTTLE_MS[name] ?? 0;
      if (throttle > 0) {
        const last = lastPlay.get(name) ?? -Infinity;
        if (nowMs - last < throttle) return;
        lastPlay.set(name, nowMs);
      }
      if (!ensureContext() || ctx === null || ctx.state !== 'running') return;
      switch (name) {
        case 'cast':
          // Soft arcane tick (auto-cast fires constantly — keep it quiet).
          tone({ freq: 640 + Math.random() * 80, freqEnd: 880, dur: 0.08, type: 'triangle', gain: 0.05 });
          break;
        case 'banish':
          // Crackling pop: pitch-drop snap.
          tone({ freq: 520, freqEnd: 170, dur: 0.12, type: 'sine', gain: 0.12 });
          break;
        case 'ward-hit':
          // Harsh ward crack.
          tone({ freq: 150, freqEnd: 70, dur: 0.25, type: 'sawtooth', gain: 0.2 });
          tone({ freq: 90, freqEnd: 50, dur: 0.3, type: 'square', gain: 0.08 });
          break;
        case 'incursion-clear':
          // Rising triad chime.
          tone({ freq: 523, dur: 0.18, type: 'sine', gain: 0.14 });
          tone({ freq: 659, dur: 0.18, type: 'sine', gain: 0.14, delay: 0.09 });
          tone({ freq: 784, dur: 0.3, type: 'sine', gain: 0.16, delay: 0.18 });
          break;
        case 'draft-boon':
          // Single bright chime.
          tone({ freq: 880, freqEnd: 1320, dur: 0.3, type: 'sine', gain: 0.12 });
          break;
        case 'portal-surge':
          // Swelling portal hum rising into the incursion.
          tone({ freq: 180, freqEnd: 520, dur: 0.5, type: 'sine', gain: 0.14 });
          tone({ freq: 90, freqEnd: 260, dur: 0.5, type: 'triangle', gain: 0.08 });
          break;
        case 'lord-roar':
          // Deep demon-lord roar.
          tone({ freq: 75, freqEnd: 42, dur: 0.8, type: 'sawtooth', gain: 0.24 });
          tone({ freq: 150, freqEnd: 60, dur: 0.6, type: 'square', gain: 0.07 });
          break;
        case 'game-over':
          // Falling bell for the fallen ward.
          tone({ freq: 330, freqEnd: 110, dur: 0.9, type: 'sine', gain: 0.18 });
          tone({ freq: 165, freqEnd: 55, dur: 0.9, type: 'triangle', gain: 0.1, delay: 0.05 });
          break;
        case 'hold-cast':
          // Deep bell + fifth partial for the rune circle.
          tone({ freq: 196, dur: 0.6, type: 'sine', gain: 0.18 });
          tone({ freq: 294, dur: 0.5, type: 'sine', gain: 0.08 });
          break;
        case 'mana-empty':
          // Dull tap — failure cue, never a lockout.
          tone({ freq: 120, dur: 0.06, type: 'square', gain: 0.07 });
          break;
      }
    },
    resume(): void {
      if (!ensureContext() || ctx === null) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {
          // Autoplay policy rejections are routine pre-gesture; the next
          // gesture retries.
        });
      }
    },
  };
}
