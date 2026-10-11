/** Player colors the server hands out; a member's color is one of these hex strings and is sent to every client as-is. */
export const PLAYER_COLORS = [
  '#ff9fb2', '#8fd0ff', '#b9e08a', '#ffd85e', '#c7a8f2', '#ffb27a', '#7fe0cf', '#f4a1e0',
  '#f2e18a', '#9fb4ff', '#ffa6a0', '#a8e6a1', '#e0b8ff', '#ffc98f', '#8fe3e8', '#e6a8c8',
] as const;

/** First color nobody in the room uses; wraps around when the room is bigger than the palette. */
export function freeColor(taken: Iterable<string>, palette: readonly string[] = PLAYER_COLORS, fallbackIndex = 0): string {
  const used = new Set(taken);
  return palette.find((c) => !used.has(c)) ?? palette[fallbackIndex % palette.length];
}
