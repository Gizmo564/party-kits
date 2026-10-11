// Test helpers every game's engine tests can call. They check the three promises the room kits rely on:
//   1. determinism      the same seed and the same actions give the same state (so a room can be restored and replayed)
//   2. serializability  the state survives JSON.stringify/parse unchanged (Durable Object storage and snapshots)
//   3. no leaks         a view made for someone else (or for a spectator) never contains a secret
//
// Usage (vitest):
//   import { expectDeterministic, expectJsonSafe, expectNoLeak } from '.../engine-core/contract';
//   expectNoLeak(viewFor(state, spectatorSeat), secretsOf(state));
import { expect } from 'vitest';

export function expectJsonSafe(state: unknown): void {
  const copy = JSON.parse(JSON.stringify(state));
  expect(copy).toEqual(state);
}

/** `run` builds a game from the seed and plays a fixed script; the final states must match. */
export function expectDeterministic<S>(run: (seed: number) => S, seed = 12345): void {
  expect(run(seed)).toEqual(run(seed));
}

/**
 * Every secret (a hidden card id, a secret word) must be absent from the serialized view.
 * Pass distinctive strings: a secret like "1" would match any number in the view.
 */
export function expectNoLeak(view: unknown, secrets: readonly string[]): void {
  const text = JSON.stringify(view);
  for (const s of secrets) expect(text.includes(s), `view leaks "${s}"`).toBe(false);
}
