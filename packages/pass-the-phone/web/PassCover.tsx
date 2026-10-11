import type { ReactNode } from 'react';
import { Avatar } from '@gizmo564/lobby-ui/web/avatars';

/**
 * The cover screen for <PassGate cover={...}>: who is next, what happened since their last turn, and one big button.
 * It may show PUBLIC facts only (names, counts), never a hand. `menu` is where Leave / Rules / table view go.
 */
export function PassCover({ name, color, look, since = [], readyLabel, onReady, menu, heading, note, avatarSize = 96, className = '', sinceTitle = 'Since your last turn', avatar, readyClassName = 'btn accent big' }: {
  name: string; color: string; look?: number; since?: string[]; readyLabel?: string; onReady: () => void; menu?: ReactNode;
  /** the headline (default "Pass the phone to <name>") */ heading?: string;
  /** a line under the headline ("Hands stay hidden until Ann taps below.") */ note?: ReactNode;
  avatarSize?: number;
  /** added to the wrapper's class (a game's own backdrop) */ className?: string;
  sinceTitle?: string;
  /** replaces the face (a game with its own avatars) */ avatar?: ReactNode;
  /** classes of the big button (default "btn accent big") */ readyClassName?: string;
}) {
  return (
    <div className={`cover ${className}`.trim()} data-testid="cover">
      {avatar ?? <Avatar name={name} color={color} size={avatarSize} look={look} />}
      <h1>{heading ?? `Pass the phone to ${name}`}</h1>
      {note ? <p className="muted" style={{ margin: 0 }}>{note}</p> : null}
      {since.length ? (
        <section className="panel" aria-label={sinceTitle}>
          <h2>{sinceTitle}</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{since.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>
      ) : null}
      <button className={readyClassName} onClick={onReady} data-testid="cover-ready">{readyLabel ?? `I'm ${name}: show my turn`}</button>
      {menu ? <div className="row">{menu}</div> : null}
    </div>
  );
}
