export interface Note { f: number; t: number; d: number; type?: OscillatorType; v?: number; slide?: number }

/** The shared effect set (from Track Record). Games may add or replace names; recordings in /sounds/<name>.mp3 override any of them. */
export const DEFAULT_SFX: Record<string, Note[]> = {
  tap: [{ f: 520, t: 0, d: 0.05, type: 'square', v: 0.05 }],
  lock: [{ f: 330, t: 0, d: 0.07, type: 'square', v: 0.06 }, { f: 495, t: 0.07, d: 0.1, type: 'square', v: 0.06 }],
  flip: [{ f: 700, t: 0, d: 0.06, type: 'triangle', v: 0.07, slide: 300 }],
  good: [{ f: 523, t: 0, d: 0.09, v: 0.08 }, { f: 659, t: 0.09, d: 0.09, v: 0.08 }, { f: 784, t: 0.18, d: 0.18, v: 0.08 }],
  bad: [{ f: 220, t: 0, d: 0.14, type: 'sawtooth', v: 0.06 }, { f: 165, t: 0.14, d: 0.22, type: 'sawtooth', v: 0.06 }],
  token: [{ f: 988, t: 0, d: 0.06, type: 'square', v: 0.05 }, { f: 1319, t: 0.06, d: 0.12, type: 'square', v: 0.05 }],
  steal: [{ f: 880, t: 0, d: 0.08, type: 'sawtooth', v: 0.06 }, { f: 440, t: 0.08, d: 0.08, type: 'sawtooth', v: 0.06 }, { f: 880, t: 0.16, d: 0.14, type: 'sawtooth', v: 0.06 }],
  win: [523, 659, 784, 1047, 784, 1047].map((f, i) => ({ f, t: i * 0.11, d: 0.16, v: 0.08 })),
  whoosh: [{ f: 400, t: 0, d: 0.18, type: 'triangle', v: 0.04, slide: 900 }],
  buzz: [{ f: 150, t: 0, d: 0.12, type: 'sawtooth', v: 0.07 }, { f: 300, t: 0.04, d: 0.16, type: 'square', v: 0.05 }],
  tick: [{ f: 1200, t: 0, d: 0.03, type: 'square', v: 0.04 }],
  join: [{ f: 660, t: 0, d: 0.07, type: 'triangle', v: 0.06 }, { f: 880, t: 0.07, d: 0.1, type: 'triangle', v: 0.06 }],
};
export const SFX_NAMES = Object.keys(DEFAULT_SFX);
