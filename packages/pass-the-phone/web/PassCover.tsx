import type { ReactNode } from 'react';
import { Avatar } from '@gizmo564/lobby-ui/web/avatars';

/**
 * The cover screen for <PassGate cover={...}>: who is next, what happened since their last turn, and one big button.
 * It may show PUBLIC facts only (names, counts), never a hand. `menu` is where Leave / Rules / table view go.
 */
export function PassCover({ name, color, look, since = [], readyLabel, onReady, menu }: {
  name: string; color: string; look?: number; since?: string[]; readyLabel?: string; onReady: () => void; menu?: ReactNode;
}) {
  return (
    <div className="cover" data-testid="cover">
      <Avatar name={name} color={color} size={96} look={look} />
      <h1>Pass the phone to {name}</h1>
      {since.length ? (
        <section className="panel" aria-label="Since your last turn">
          <h2>Since your last turn</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{since.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>
      ) : null}
      <button className="btn accent big" onClick={onReady} data-testid="cover-ready">{readyLabel ?? `I'm ${name}: show my turn`}</button>
      {menu ? <div className="row">{menu}</div> : null}
    </div>
  );
}
