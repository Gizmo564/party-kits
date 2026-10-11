import { useEffect, useState } from 'react';
import { roomStore } from '@gizmo564/room-client/web';
import { PassCover, PassGate, type GateState } from '@gizmo564/pass-the-phone/web';
import { ResultsScreen, RulesButton } from '@gizmo564/rules-results/web';
import { Avatar } from '@gizmo564/lobby-ui/web';
import { track } from '@gizmo564/platform/web/analytics';
import { PLAYER_COLORS, act, defaultSettings, start, tick, view, type LuckyState } from '@game/engine';
import { audio } from '../audio';
import { RULES } from '../rules';
import { GameCredits } from '../credits';
import { Hand } from './Play';
import { RevealPanel, Table } from './Table';
import type { MemberInfo } from '@gizmo564/room-server/server';

const SAVE_KEY = '__SLUG__-local';
interface Saved { names: string[]; state: LuckyState; gate: GateState | null }
/** is there a pass-and-play game to resume? (the front menu uses this) */
export const hasLocalGame = (): boolean => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };
const load = (): Saved | null => { try { const t = localStorage.getItem(SAVE_KEY); return t ? (JSON.parse(t) as Saved) : null; } catch { return null; } };
const store = (s: Saved | null) => { try { if (s) { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); roomStore('__SLUG__').rememberLocalGame(); } else localStorage.removeItem(SAVE_KEY); } catch { /* private mode: no resume */ } };

const asMembers = (names: string[]): MemberInfo[] =>
  names.map((name, i) => ({ id: `p${i}`, name, color: PLAYER_COLORS[i % PLAYER_COLORS.length], avatar: i, role: 'player', connected: true, host: i === 0 }));

/** Everyone shares one phone. The cover hides each hand until its owner taps "show my turn". */
export function Local({ onLeave }: { onLeave: () => void }) {
  const [saved, setSaved] = useState<Saved | null>(load);
  const [names, setNames] = useState(['', '']);
  const [error, setError] = useState('');
  useEffect(() => store(saved), [saved]);

  const begin = () => {
    const clean = names.map((n, i) => n.trim() || `Player ${i + 1}`);
    const r = start({ seats: clean.map((_, i) => ({ id: `p${i}` })), settings: defaultSettings(), seed: crypto.getRandomValues(new Uint32Array(1))[0], now: Date.now() });
    if (!r.ok) { setError(r.error); return; }
    track('game_created');
    setSaved({ names: clean, state: r.value, gate: null });
  };
  const leave = () => { store(null); onLeave(); };

  if (!saved) {
    return (
      <div className="page">
        <div className="row between"><button className="btn small" onClick={onLeave}>Back</button><h1 className="h-lg">Pass the phone</h1><span /></div>
        <section className="panel">
          {names.map((n, i) => (
            <input key={i} className="field" value={n} maxLength={20} placeholder={`Player ${i + 1}`} aria-label={`Player ${i + 1} name`} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <div className="row">
            <button className="btn small" disabled={names.length >= 6} onClick={() => setNames([...names, ''])}>Add player</button>
            <button className="btn small" disabled={names.length <= 2} onClick={() => setNames(names.slice(0, -1))}>Remove player</button>
          </div>
        </section>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <button className="btn accent big" onClick={begin} data-testid="local-start">Start</button>
      </div>
    );
  }

  const { state, names: ns } = saved;
  const members = asMembers(ns);
  const update = (next: LuckyState) => setSaved({ ...saved, state: next });

  if (state.phase === 'over') {
    const v = view(state, null);
    const rows = members.map((m) => ({ id: m.id, name: m.name, color: m.color, avatar: m.avatar, score: v.scores[m.id] ?? 0 }));
    return <ResultsScreen rows={rows} isHost onAgain={() => setSaved(null)} onLeave={leave} credits={<GameCredits />} />;
  }

  // simultaneous play on one phone: the next seat that has not played yet takes the phone
  const seat = state.seats.find((id) => state.picks[id] === null);
  const who = members.find((m) => m.id === seat);
  const pub = view(state, null);

  if (state.phase === 'reveal' && state.last) {
    return (
      <div className="page">
        <Table view={pub} members={members} total={1} timer={false} />
        <RevealPanel reveal={state.last} members={members} />
        <button className="btn accent big" onClick={() => { audio.sfx('flip'); const t = tick(state, state.endsAt ?? Date.now()); if (t) update(t.state); }} data-testid="next-round">{state.round + 1 >= state.rounds ? 'See results' : 'Next round'}</button>
      </div>
    );
  }
  if (!seat || !who) return null;

  return (
    <PassGate
      turnKey={`${state.round}:${seat}`} isPrivatePhase saved={saved.gate} onChange={(g) => setSaved((s) => (s ? { ...s, gate: g } : s))} onReady={() => audio.sfx('whoosh')}
      cover={(ready) => (
        <PassCover name={who.name} color={who.color} look={who.avatar} onReady={ready}
          since={[`Round ${state.round + 1} of ${state.rounds}`]}
          menu={<><button className="btn small" onClick={leave}>Leave</button><RulesButton sections={RULES} /></>} />
      )}
    >
      <div className="page">
        <div className="row"><Avatar name={who.name} color={who.color} size={40} look={who.avatar} /><b>{who.name}</b></div>
        <Table view={pub} members={members} total={1} timer={false} />
        <Hand view={view(state, seat)} onPick={(card) => {
          const r = act(state, seat, { type: 'pick', card }, { now: Date.now(), seed: 0 });
          if (r.ok) { audio.sfx('lock'); update(r.value.state); } else setError(r.error);
        }} />
        {error ? <p className="err" role="alert">{error}</p> : null}
      </div>
    </PassGate>
  );
}
