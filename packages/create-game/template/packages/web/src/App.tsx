import { useState } from 'react';
import { clearJoinParams, parseJoinLink } from '@gizmo564/room-client/web';
import { ROSTER } from '@game/engine';
import { Home } from './screens/Home';
import { Entry } from './screens/Entry';
import { Online } from './screens/Online';
import { Local } from './screens/Local';

export type Route =
  | { kind: 'home' }
  | { kind: 'entry'; joinCode: string }
  | { kind: 'online'; code: string; role: 'player' | 'audience' | 'display'; name: string }
  | { kind: 'local' };

/** What a /?room=CODE link does (same in all three live games): a display or audience link goes straight in; a link with a name joins as that
 *  player; a bare code asks for a name first. */
function firstRoute(): Route {
  const link = parseJoinLink(typeof location === 'undefined' ? '' : location.search, ROSTER);
  if (!link.code) return { kind: 'home' };
  clearJoinParams();
  if (link.role === 'display') return { kind: 'online', code: link.code, role: 'display', name: 'Display' };
  if (link.role === 'audience') return { kind: 'online', code: link.code, role: 'audience', name: link.name || 'Audience' };
  if (link.name) return { kind: 'online', code: link.code, role: 'player', name: link.name };
  return { kind: 'entry', joinCode: link.code };
}

export function App() {
  const [route, setRoute] = useState<Route>(firstRoute);
  const home = () => setRoute({ kind: 'home' });
  if (route.kind === 'online') return <Online key={route.code + route.role} code={route.code} role={route.role} name={route.name} onLeave={home} />;
  if (route.kind === 'entry') return <Entry joinCode={route.joinCode} onGo={setRoute} onBack={home} />;
  if (route.kind === 'local') return <Local onLeave={home} />;
  return <Home onGo={setRoute} />;
}
