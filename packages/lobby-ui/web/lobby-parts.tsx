import { useState, type ReactNode } from 'react';
import type { MemberInfo } from '@gizmo564/room-server/server/protocol';
import { Avatar, LOOK_COUNT } from './avatars';
import { ColorPicker } from './controls';
import { Qr } from './Qr';

/** The big room code, the join address, and a QR. Show the QR on a host display and while the room waits for a host. */
export function CodePanel({ code, joinUrl, showQr = false, qrSize = 160, tv = false }: { code: string; joinUrl: string; showQr?: boolean; qrSize?: number; /** a TV: nothing to tap, so no Copy link button */ tv?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(joinUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => undefined); };
  return (
    <section className="panel codepanel">
      <small className="muted">Join with this code</small>
      <div className="bigcode" data-testid="room-code" aria-label={`Room code ${code.split('').join(' ')}`}>{code}</div>
      <small className="muted">{joinUrl.replace(/^https?:\/\//, '')}</small>
      {showQr ? <Qr text={joinUrl} size={qrSize} /> : null}
      {tv ? null : <button type="button" className="btn small" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>}
    </section>
  );
}

export interface PlayerListProps {
  members: readonly MemberInfo[];
  meId: string;
  /** the viewer is the host: show remove / make host buttons */
  hostControls?: { onKick: (id: string) => void; onMakeHost: (id: string) => void; canKick: boolean };
  max?: number;
  /** extra per-player chip (team, role...) */
  extra?: (m: MemberInfo) => ReactNode;
  /** a TV: players fill a grid that fits the screen without scrolling; no buttons, no "display attached" line */
  tv?: boolean;
}

/** Players (and a line of watchers). Bots show a BOT chip, away players are dimmed. */
export function PlayerList({ members, meId, hostControls, max, extra, tv = false }: PlayerListProps) {
  const players = members.filter((m) => m.role === 'player' && !m.screen);
  const watchers = members.filter((m) => m.role === 'spectator' && !m.screen);
  const screens = members.filter((m) => m.screen);
  return (
    <section className={`panel${tv ? ' playerpanel' : ''}`}>
      <h2>Players <small className="muted">({players.length}{max ? `/${max}` : ''})</small></h2>
      <div className={`players${tv ? ' tvplayers' : ''}`} data-testid="players">
        {players.map((p) => (
          <div className={`player-row${p.away || !p.connected ? ' away' : ''}`} key={p.id} data-testid="member">
            <Avatar name={p.name} color={p.color} size={tv ? 40 : 34} look={p.avatar} />
            <b className="grow">{p.name}{p.host ? ' (host)' : ''}{p.id === meId ? ' (you)' : ''}</b>
            {p.bot ? <span className="chip">BOT</span> : null}
            {extra?.(p)}
            {!p.connected && !p.bot ? <span className="muted">offline</span> : p.away ? <span className="muted">away</span> : null}
            {hostControls && p.id !== meId ? (
              <span className="row nowrap">
                {!p.bot && p.connected ? <button type="button" className="btn small" onClick={() => hostControls.onMakeHost(p.id)} aria-label={`Make ${p.name} the host`}>Make host</button> : null}
                {hostControls.canKick ? <button type="button" className="btn small danger" onClick={() => hostControls.onKick(p.id)} aria-label={`Remove ${p.name}`}>Remove</button> : null}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {watchers.length ? <p className="muted">Watching: {watchers.map((w) => w.name).join(', ')}</p> : null}
      {screens.length && !tv ? <p className="muted">{screens.length === 1 ? 'A display is attached.' : `${screens.length} displays are attached.`}</p> : null}
    </section>
  );
}

/** "You": name, face, color. `children` is where a game adds its own fields (team, role). */
export function ProfileEditor({ me, members, colors, lookCount = LOOK_COUNT, onProfile, children }: {
  me: MemberInfo; members: readonly MemberInfo[]; colors: readonly string[]; lookCount?: number;
  onProfile: (patch: { name?: string; color?: string; avatar?: number }) => void; children?: ReactNode;
}) {
  const [name, setName] = useState(me.name);
  const taken = members.filter((m) => m.id !== me.id).map((m) => m.color);
  return (
    <section className="panel">
      <h2>You</h2>
      <input className="field" aria-label="Your name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== me.name && onProfile({ name: name.trim() })} />
      {lookCount > 0 ? (
        <div className="looks" role="radiogroup" aria-label="Your face">
          {Array.from({ length: lookCount }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={me.avatar === i} aria-label={`Face ${i + 1}`} className={`lookbtn${me.avatar === i ? ' on' : ''}`} onClick={() => onProfile({ avatar: i })}>
              <Avatar name={me.name} color={me.color} size={38} look={i} />
            </button>
          ))}
        </div>
      ) : null}
      <ColorPicker colors={colors} value={me.color} taken={taken} onPick={(c) => onProfile({ color: c })} />
      {children}
    </section>
  );
}
