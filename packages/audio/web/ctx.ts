// One shared AudioContext for effects (and decoded samples).
let ctx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}
/** Call from a tap: browsers keep audio suspended until the user touches the page. */
export async function unlockAudioContext(): Promise<void> {
  try { const c = audioCtx(); if (c.state === 'suspended') await c.resume(); } catch { /* no audio available (tests, old browsers): the game still works without sound */ }
}
/** tests only */
export const _resetCtx = () => { ctx = null; };
