/**
 * Per-viewer views. The rule all three games follow: the server never sends the full state. For every connection it
 * builds a view for THAT seat (or `null` for a spectator / host display) with every secret replaced by a placeholder.
 * Do not build a second "display view": a display is a spectator, so it cannot leak what a spectator cannot see.
 */
export type Seat = number | null;

/** A face-down stand-in for a card or value the viewer may not see. Keeps array lengths (so counts stay visible). */
export const hidden = <T extends { id?: unknown }>(n: number, make: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => make(i));

/** Return `real` only to its owner (or to everyone once `reveal` is true); everyone else gets `placeholder`. */
export function onlyFor<T, P>(viewer: Seat, owner: number, real: T, placeholder: P, reveal = false): T | P {
  return reveal || (viewer !== null && viewer === owner) ? real : placeholder;
}
