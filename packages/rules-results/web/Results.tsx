import type { ReactNode } from 'react';
import { Avatar } from '@gizmo564/lobby-ui/web/avatars';

export interface ResultRow { id: string; name: string; color: string; avatar?: number; score: number; detail?: ReactNode }
export interface RankedRow extends ResultRow { place: number; winner: boolean }

/** Sort by score (high first, or low first for golf-style games) and give ties the same place: 1, 1, 3. Everyone on the top place wins. */
export function rankRows(rows: readonly ResultRow[], lowWins = false): RankedRow[] {
  const sorted = [...rows].sort((a, b) => (lowWins ? a.score - b.score : b.score - a.score));
  const top = sorted.length ? sorted[0].score : 0;
  return sorted.map((r, i) => {
    const place = i > 0 && sorted[i - 1].score === r.score ? 0 : i + 1;
    return { ...r, place, winner: r.score === top };
  }).reduce<RankedRow[]>((acc, r, i) => { acc.push({ ...r, place: r.place || acc[i - 1].place }); return acc; }, []);
}

export const winnersLine = (ranked: readonly RankedRow[]): string => {
  const w = ranked.filter((r) => r.winner).map((r) => r.name);
  if (w.length === 0) return 'No winner';
  if (w.length === 1) return `${w[0]} wins!`;
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]} tie!`;
};

/** A ranked list. Use alone mid-game, or inside ResultsScreen. */
export function Scoreboard({ rows, lowWins = false, meId, unit = '' }: { rows: readonly ResultRow[]; lowWins?: boolean; meId?: string; unit?: string }) {
  const ranked = rankRows(rows, lowWins);
  return (
    <ol className="scoreboard" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {ranked.map((r) => (
        <li key={r.id} className="player-row" data-testid="score-row" aria-current={r.id === meId ? 'true' : undefined}>
          <b style={{ minWidth: '2ch' }}>{r.place}</b>
          <Avatar name={r.name} color={r.color} size={34} look={r.avatar} />
          <span className="grow"><b>{r.name}{r.id === meId ? ' (you)' : ''}</b>{r.detail ? <small className="muted"> {r.detail}</small> : null}</span>
          {r.winner ? <span className="chip good">Winner</span> : null}
          <b>{r.score}{unit}</b>
        </li>
      ))}
    </ol>
  );
}

/** The end-of-game screen: headline, ranked scores, and Play again (host) / waiting (everyone else). */
export function ResultsScreen({ rows, lowWins, meId, isHost, onAgain, onLeave, headline, children, credits }: {
  rows: readonly ResultRow[]; lowWins?: boolean; meId?: string; isHost: boolean; onAgain: () => void; onLeave: () => void; headline?: string; children?: ReactNode;
  /** a <Credits/> panel: shown on the game-over screen in all three live games */
  credits?: ReactNode;
}) {
  const ranked = rankRows(rows, lowWins);
  return (
    <div className="page">
      <div className="center-col">
        <h1>{headline ?? winnersLine(ranked)}</h1>
      </div>
      <section className="panel"><Scoreboard rows={rows} lowWins={lowWins} meId={meId} /></section>
      {children}
      {credits}
      <div className="row">
        {isHost ? <button className="btn accent big grow" onClick={onAgain}>Play again</button> : <p className="muted grow center-text">Waiting for the host to start another game…</p>}
        <button className="btn" onClick={onLeave}>Leave</button>
      </div>
    </div>
  );
}
