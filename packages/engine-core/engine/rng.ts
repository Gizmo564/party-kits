/**
 * Small seeded PRNG (mulberry32). State is a plain number so game state stays serializable.
 * Identical in Track Record and Sandwich Slam; this is the shared copy.
 */
export class Rng {
  constructor(public state: number) {}
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Integer in [0, n). */
  int(n: number): number { return Math.floor(this.next() * n); }
  /** Integer in [lo, hi] inclusive. */
  between(lo: number, hi: number): number { return lo + this.int(hi - lo + 1); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  /** In-place Fisher-Yates; returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** A seed for a new game. Use it once when the game is created and store it in the state; replay from the seed. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

/** Derive an independent stream for one purpose (a bot's choice at a given step) without disturbing the main stream. */
export const forkRng = (seed: number, ...salts: number[]): Rng => {
  let s = seed >>> 0;
  for (const x of salts) s = (Math.imul(s ^ (x + 0x9e3779b9), 2654435761) >>> 0) ^ (s >>> 15);
  return new Rng(s >>> 0);
};
