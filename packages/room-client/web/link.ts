// The links a game opens with. The shared join page (play.0801564.xyz) sends players to `<game origin>/?room=CODE`;
// a host's QR/"open on TV" link adds `&role=display`; a name can ride along as `&name=`.
//   ?room=ABCD               join as a player        (code is checked against the game's own roster)
//   ?room=ABCD&role=display  open as a TV screen
//   ?room=ABCD&role=audience join as a spectator (what play.0801564.xyz sends; Track Record, Sandwich Slam and Chameleon all read it).
//                            `role=watch` is accepted as an older spelling of the same thing.
// Anything invalid is ignored, never thrown: a bad link just lands on the entry screen.
import type { Roster } from '@gizmo564/join-codes/engine/roster';

export type JoinRole = 'player' | 'audience' | 'display';
export interface JoinLink { code: string | null; role: JoinRole; name: string }

export function parseJoinLink(search: string, roster: Pick<Roster, 'isMyCode'>): JoinLink {
  const q = new URLSearchParams(search);
  const raw = (q.get('room') ?? q.get('c') ?? '').trim().toUpperCase();
  const role = q.get('role');
  return {
    code: roster.isMyCode(raw) ? raw : null,
    role: role === 'display' ? 'display' : role === 'audience' || role === 'watch' ? 'audience' : 'player',
    name: (q.get('name') ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20),
  };
}

/** Remove the join parameters from the address bar once they are consumed (so a refresh does not re-join as a stranger). */
export function clearJoinParams(): void {
  try {
    const u = new URL(location.href);
    for (const k of ['room', 'c', 'role', 'name']) u.searchParams.delete(k);
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
  } catch { /* old browser: harmless */ }
}
