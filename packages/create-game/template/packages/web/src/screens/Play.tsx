import type { LuckyView } from '@game/engine';

/** Your hand. Tap a card to play it; once played you wait for the others. */
export function Hand({ view, onPick, disabled }: { view: LuckyView; onPick: (card: number) => void; disabled?: boolean }) {
  const locked = view.myPick !== null;
  return (
    <section className="panel" aria-label="Your hand">
      <b>{view.phase !== 'pick' ? 'Next round soon…' : locked ? 'Played. Waiting for the others…' : 'Pick a card'}</b>
      <div className="card-row">
        {(view.hand ?? []).map((c) => (
          <button key={c} className="play-card" disabled={disabled || view.phase !== 'pick' || locked} onClick={() => onPick(c)} data-testid={`card-${c}`}>{c}</button>
        ))}
        {view.myPick !== null ? <span className="play-card picked" style={{ display: 'grid', placeItems: 'center' }} data-testid="my-pick">{view.myPick}</span> : null}
      </div>
    </section>
  );
}
