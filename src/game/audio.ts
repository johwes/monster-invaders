// Synthesized WebAudio SFX (spec 05). Full synth module arrives with
// PROGRESS item 11; this stub only tracks mute state so boot can wire
// the persisted preference early.

import { loadMuted, saveMuted } from './storage.ts';

export type SfxName =
  | 'cast'
  | 'banish'
  | 'ward-hit'
  | 'incursion-clear'
  | 'draft-boon'
  | 'lord-roar'
  | 'game-over'
  | 'hold-cast'
  | 'mana-empty';

export interface Audio {
  muted: boolean;
  setMuted(muted: boolean): void;
  /** No-op until item 11; context must resume on first user gesture. */
  play(_name: SfxName): void;
  resume(): void;
}

export function createAudio(): Audio {
  let muted = loadMuted();
  return {
    get muted(): boolean {
      return muted;
    },
    setMuted(next: boolean): void {
      muted = next;
      saveMuted(next);
    },
    play(_name: SfxName): void {
      // TODO(item 11): oscillator-based synth per spec 05.
    },
    resume(): void {
      // TODO(item 11): resume AudioContext on user gesture.
    },
  };
}
