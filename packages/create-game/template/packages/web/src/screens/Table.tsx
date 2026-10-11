import type { MemberInfo } from '@gizmo564/room-server/server';
import { Avatar, TurnTimer } from '@gizmo564/lobby-ui/web';
import type { LuckyView, Reveal } from '@game/engine';

export const emojiOf = (m: MemberInfo | undefined) => (typeof m?.data?.emoji === 'string' ? m.data.emoji : '');

/** The shared table: prize, timer, who has played and the scores. Phones and the TV both show it. */
export function Table({ view, members, meId, total, timer = true }: { view: LuckyView; members: MemberInfo[]; meId?: string; total: number; timer?: boolean }) {
  const players = members.filter((m) => m.role === 'player' && !m.screen);
  return (
    <section className="panel center-col" data-testid="table">
      <small className="muted">Round {view.round + 1} of {view.rounds}</small>
      {view.prize !== null ? <div className="prize" aria-label={`Prize ${view.prize} points`}>🏆 {view.prize}</div> : null}
      {timer && view.phase === 'pick' ? <TurnTimer deadline={view.endsAt} total={total} /> : null}
      <div className="players table-players" style={{ width: '100%' }}>
        {players.map((m) => (
          <div className="player-row" key={m.id}>
            <Avatar name={m.name} color={m.color} size={34} look={m.avatar} />
            <b className="grow">{emojiOf(m)} {m.name}{m.id === meId ? ' (you)' : ''}</b>
            {view.phase === 'pick' ? <span className="chip">{view.locked[m.id] ? 'played' : 'thinking'}</span> : null}
            <b data-testid={`score-${m.id}`}>{view.scores[m.id] ?? 0}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The reveal: every card that was played, cancelled ones struck through, and who took the prize. */
export function RevealPanel({ reveal, members }: { reveal: Reveal; members: MemberInfo[] }) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? '?';
  return (
    <section className="panel center-col" data-testid="reveal">
      <h2>{reveal.winner ? `${name(reveal.winner)} takes ${reveal.prize}` : 'Nobody wins this one'}</h2>
      <div className="reveal-grid">
        {reveal.plays.map((p) => (
          <div className="reveal-cell" key={p.id}>
            <span className={`play-card${p.cancelled ? ' cancelled' : ''}${p.id === reveal.winner ? ' picked' : ''}`} style={{ display: 'grid', placeItems: 'center' }}>{p.card}</span>
            <small>{name(p.id)}{p.cancelled ? ' (matched)' : ''}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
