import { useEffect, useState, type ReactNode } from 'react';

function useViewport() {
  const read = () => ({ w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 720 : window.innerHeight });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

/** The scale that fits a `designW` x `designH` box inside the window (never above `max`, so a phone is not blown up past 1x by default). */
export const stageScale = (winW: number, winH: number, designW: number, designH: number, max = Infinity): number =>
  Math.max(0.1, Math.min(winW / designW, winH / designH, max));

/**
 * Lay the game out once at a fixed design size and scale it to the window, centred. This is how a TV shows the same
 * table the phones show without a tiny phone layout in the corner.
 */
export function Stage({ designW = 1280, designH = 720, max, children }: { designW?: number; designH?: number; max?: number; children: ReactNode }) {
  const { w, h } = useViewport();
  const s = stageScale(w, h, designW, designH, max);
  return (
    <div className="stage" data-testid="stage">
      <div className="stage-box" style={{ width: designW, height: designH, transform: `translate(${(w - designW * s) / 2}px, ${(h - designH * s) / 2}px) scale(${s})` }}>
        {children}
      </div>
    </div>
  );
}
