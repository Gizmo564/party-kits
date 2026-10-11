import type { NetStatus } from './useRoom';

/** Shown instead of the game when the room cannot be reached or is over. Plain words, one way out. */
export function RoomGone({ status, reason, onLeave }: { status: NetStatus; reason?: 'idle' | 'admin' | 'kicked' | null; onLeave: () => void }) {
  const text =
    status === 'missing' ? 'That room is not here any more. It may have closed after sitting idle, or the code was typed wrong.'
    : reason === 'kicked' ? 'The host removed you from this room.'
    : reason === 'admin' ? 'This room was closed.'
    : 'This room closed after being idle for a while.';
  return (
    <div className="page"><div className="center-col panel" role="alert">
      <h2>Room closed</h2><p className="muted">{text}</p>
      <button className="btn primary block" onClick={onLeave}>Back to start</button>
    </div></div>
  );
}

/** A thin banner for a dropped connection. The game underneath keeps showing its last state. */
export function ConnectionBanner({ status }: { status: NetStatus }) {
  if (status !== 'reconnecting' && status !== 'connecting') return null;
  return <div className="banner" role="status">{status === 'connecting' ? 'Connecting…' : 'Connection lost. Reconnecting…'}</div>;
}

/** The server is paused until its daily reset (Nap Guard). Rooms are safe and pick up afterwards. */
export function NapNotice({ until }: { until: number | null }) {
  if (until === null) return null;
  const when = new Date(until);
  return (
    <div className="banner" role="status">
      The games are napping: the free daily server limit is nearly used up. Your game is paused and safe; it picks up after the daily reset
      (around {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}).
    </div>
  );
}
