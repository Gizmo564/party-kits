/**
 * Largest item width that lets `count` items (cards, tiles) plus their gaps fit a W x H box without scrolling.
 * Used to size a hand or a timeline on any screen from a phone to a TV.
 */
export function fitGrid(W: number, H: number, count: number, opts: { slot: number; gap: number; aspect?: number; min?: number; max?: number } = { slot: 22, gap: 8 }) {
  const aspect = opts.aspect ?? 1.3;
  const min = opts.min ?? 46;
  const max = opts.max ?? 150;
  const { slot, gap } = opts;
  const calc = (w: number) => {
    const cols = Math.max(1, Math.floor((W - slot) / (w + slot)));
    const rows = Math.ceil(Math.max(1, count) / cols);
    return { w, h: Math.round(w * aspect), cols, rows, fits: rows * (w * aspect + gap) <= H };
  };
  for (let w = max; w >= min; w -= 2) {
    const r = calc(w);
    if (r.fits) return r;
  }
  return calc(min);
}
