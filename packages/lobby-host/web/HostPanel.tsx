import type { ReactNode } from 'react';
import { Hint } from '@gizmo564/lobby-ui/web/collapse';
import type { ClientMsg, Snapshot } from '@gizmo564/room-server/server/protocol';

/**
 * "Where the music plays": the host picks the phone or the TV. Only shown to the host, and only while a TV is connected
 * (without one the host's phone is the only choice). Track Record's Host controls tab and Chameleon's lobby have the same panel.
 * `onUnlock` runs on the tap that moves the music to this phone, so the browser lets it play (pass `() => audio.unlock()`).
 */
export function MusicWhere({ snap, send, onUnlock }: { snap: Snapshot<any, any>; send: (m: ClientMsg<any, any>) => void; onUnlock?: () => void }) {
  if (!snap.you.host || !snap.members.some((m) => m.screen && m.connected)) return null;
  const here = snap.you.music;
  return (
    <section className="panel" data-testid="music-where">
      <h2>Where the music plays
        <Hint label="About where the music plays">{here
          ? 'Songs play from this phone. The TV shows the game with the sound off.'
          : 'Sound plays from the TV. If casting makes it choppy, play it from this phone instead (a Bluetooth speaker works well).'}</Hint>
      </h2>
      <div className="row">
        <button type="button" className={`btn small${here ? ' primary' : ''}`} aria-pressed={here} onClick={() => { onUnlock?.(); send({ type: 'music', on: true }); }}>This phone</button>
        <button type="button" className={`btn small${here ? '' : ' primary'}`} aria-pressed={!here} onClick={() => send({ type: 'music', on: false })}>The TV</button>
      </div>
    </section>
  );
}

/**
 * The host's controls during a game, for the host's phone only (a TV never has buttons): Show on TV, where the music plays,
 * the game's own buttons (`children`: skip, next turn, end round...), and who is here with Make host / Remove.
 * Put it in a tab or a collapsible panel; the starter game uses a <details>.
 */
export function HostPanel({ snap, send, cast, children, onUnlock }: {
  snap: Snapshot<any, any>; send: (m: ClientMsg<any, any>) => void;
  /** the CastButton, so this kit does not depend on the cast kit */
  cast?: ReactNode; children?: ReactNode; onUnlock?: () => void;
}) {
  if (!snap.you.host) return null;
  const people = snap.members.filter((m) => !m.screen && m.id !== snap.you.id && !m.bot);
  return (
    <div className="stack" data-testid="host-panel">
      {cast ? <div className="row">{cast}</div> : null}
      <MusicWhere snap={snap} send={send} onUnlock={onUnlock} />
      {children}
      {people.length ? (
        <section className="panel">
          <h2>Who’s here</h2>
          {people.map((m) => (
            <div className="player-row" key={m.id}>
              <b className="grow">{m.name}{m.role === 'spectator' ? ' (watching)' : ''}{m.connected ? '' : ' · offline'}</b>
              {m.connected && m.role === 'player' ? <button type="button" className="btn small" onClick={() => send({ type: 'makeHost', id: m.id })} aria-label={`Make ${m.name} the host`}>Make host</button> : null}
              <button type="button" className="btn small danger" onClick={() => send({ type: 'kick', id: m.id })} aria-label={`Remove ${m.name}`}>Remove</button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
