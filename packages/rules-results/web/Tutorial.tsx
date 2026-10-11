import { useState } from 'react';

export interface TourStep { title: string; body: string }

const key = (game: string) => `${game}-tour-done`;
export const tourSeen = (game: string): boolean => { try { return localStorage.getItem(key(game)) === '1'; } catch { return true; } };
export const resetTour = (game: string): void => { try { localStorage.removeItem(key(game)); } catch { /* storage blocked */ } };

/**
 * A short click-through shown once, the first time a player starts a game. `steps` is the whole content.
 * Pass `force` to show it again (the "How to play" button). If storage is blocked it counts as seen, so it never nags.
 */
export function Tutorial({ game, steps, force = false, onDone, sound }: { game: string; steps: TourStep[]; force?: boolean; onDone?: () => void; sound?: () => void }) {
  const [open, setOpen] = useState(() => force || !tourSeen(game));
  const [i, setI] = useState(0);
  if (!open || steps.length === 0) return null;
  const done = () => { try { localStorage.setItem(key(game), '1'); } catch { /* it may show again, which is harmless */ } setOpen(false); onDone?.(); };
  const s = steps[i];
  const last = i === steps.length - 1;
  return (
    <div className="modal-back tour-back" data-testid="tour">
      <div className="modal panel tour" role="dialog" aria-modal="true" aria-label="Quick tour">
        <small className="muted">Quick tour · {i + 1} of {steps.length}</small>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="tour-dots" aria-hidden>{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="row between">
          <button className="btn small" onClick={done} data-testid="tour-skip">Skip</button>
          <span className="row">
            {i > 0 ? <button className="btn small" onClick={() => { setI(i - 1); sound?.(); }}>Back</button> : null}
            <button className="btn accent" onClick={() => { if (last) done(); else { setI(i + 1); sound?.(); } }} data-testid="tour-next">{last ? 'Got it' : 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
