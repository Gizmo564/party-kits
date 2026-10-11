/** Strip control characters and angle brackets, trim, cap the length. Names and guesses from players go through this. */
export const cleanText = (s: string | undefined | null, max: number): string =>
  (s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export const MAX_NAME = 20;
/** A display name, or the fallback when nothing usable was sent. */
export const cleanName = (s: string | undefined | null, fallback: string, max = MAX_NAME): string => cleanText(s, max) || fallback;

/** Clamp to an integer range; non-numbers become the fallback. */
export const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
  return Number.isNaN(n) ? fallback : Math.max(lo, Math.min(hi, n));
};
