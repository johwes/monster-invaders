// Fixed-timestep loop (spec 06). The 60 Hz update, delta clamping, and
// pause-aware skipping arrive with PROGRESS item 1; this file only locks
// the interface main.ts will drive.

export interface LoopHooks {
  update(step: number): void;
  render(): void;
}

export interface Loop {
  start(): void;
  stop(): void;
}

export function createLoop(_hooks: LoopHooks): Loop {
  return {
    start(): void {
      // TODO(item 1): fixed-timestep 60 Hz update + render.
    },
    stop(): void {
      // TODO(item 1): cancel the scheduled frames.
    },
  };
}
