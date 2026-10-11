import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg, Snapshot } from '@gizmo564/room-server/server/protocol';
import { roomInfo } from './api';
import { roomStore } from './storage';

export type NetStatus = 'connecting' | 'open' | 'reconnecting' | 'missing' | 'ended';
export interface RoomOpts {
  name?: string; spectate?: boolean; music?: boolean; screen?: boolean;
  /** this screen is the Google Cast receiver (pass `isCastReceiver()` from the cast kit): it outranks other screens for the music */
  cast?: boolean;
}
/** the part of WebSocket this hook uses (so tests can pass a fake) */
export interface SocketLike {
  readyState: number; send(data: string): void; close(): void;
  onopen: ((ev?: unknown) => void) | null; onmessage: ((ev: { data: unknown }) => void) | null; onclose: ((ev?: unknown) => void) | null;
}
export interface UseRoomConfig {
  /** game id: namespaces the saved token */
  game: string;
  code: string;
  opts: RoomOpts;
  /** tests only */
  socket?: (url: string) => SocketLike;
  /** tests only */
  fetcher?: typeof fetch;
}

const PING_MS = 25_000;
const NAP_POLL_MS = 60_000;

/**
 * One websocket per room. Reconnects by itself and re-sends the saved token so the player keeps their seat.
 *   status  connecting | open | reconnecting | missing (room is gone) | ended (closed by the server: see endedReason)
 *   napUntil  set while the server is asleep until its daily reset (we stop retrying and poll /api/nap once a minute)
 */
export function useRoom<Settings = unknown, View = unknown, Action = unknown>(cfg: UseRoomConfig) {
  const { game, code } = cfg;
  const [snap, setSnap] = useState<Snapshot<Settings, View> | null>(null);
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [error, setError] = useState('');
  const [napUntil, setNapUntil] = useState<number | null>(null);
  const [endedReason, setEndedReason] = useState<'idle' | 'admin' | 'kicked' | 'host' | null>(null);
  const wsRef = useRef<SocketLike | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const haveSnap = useRef(false);

  useEffect(() => {
    const store = roomStore(game);
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    let napping = false;
    let napPoll: ReturnType<typeof setInterval> | undefined;
    haveSnap.current = false;

    const connect = () => {
      const c = cfgRef.current;
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${code}`;
      const ws: SocketLike = c.socket ? c.socket(url) : (new WebSocket(url) as unknown as SocketLike);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        const o = cfgRef.current.opts;
        ws.send(JSON.stringify({ type: 'hello', name: o.name, spectate: o.spectate, music: o.music, screen: o.screen, cast: o.screen ? o.cast : undefined, token: store.savedToken(code) } satisfies ClientMsg));
        clearInterval(ping);
        ping = setInterval(() => ws.readyState === 1 && ws.send('{"type":"ping"}'), PING_MS);
      };
      ws.onmessage = (e) => {
        let m: ServerMsg<Settings, View>;
        try { m = JSON.parse(e.data as string) as ServerMsg<Settings, View>; } catch { return; }
        if (m.type === 'closed') {
          closed = true; clearTimeout(timer); clearInterval(ping);
          if (m.reason === 'kicked') store.forgetToken(code);
          setEndedReason(m.reason); setStatus('ended');
          return;
        }
        if (m.type === 'nap') {
          // the server is asleep until its daily reset: stop reconnecting and check back once a minute
          napping = true; setNapUntil(m.resetAt || Date.now() + 3600e3); clearTimeout(timer);
          if (!napPoll) {
            napPoll = setInterval(() => {
              (cfgRef.current.fetcher ?? fetch)('/api/nap').then((r) => r.json() as Promise<{ level?: string }>).then((n) => {
                if (n.level !== 'asleep') {
                  napping = false; clearInterval(napPoll); napPoll = undefined; setNapUntil(null);
                  if (!closed && (!wsRef.current || wsRef.current.readyState > 1)) connect();
                }
              }).catch(() => undefined);
            }, NAP_POLL_MS);
          }
          return;
        }
        if (napping) { napping = false; setNapUntil(null); }
        if (m.type === 'state') { store.saveToken(code, m.you.token); haveSnap.current = true; setSnap(m); setStatus('open'); setError(''); }
        else if (m.type === 'error') setError(m.message);
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (closed || napping) return;
        setStatus('reconnecting');
        retry++;
        // never got in and keep failing: the room may be gone (idle close, wrong code)
        if (retry > 6 && !haveSnap.current) roomInfo(code, cfgRef.current.fetcher).then((i) => { if (!i.exists) setStatus('missing'); }).catch(() => undefined);
        timer = setTimeout(connect, Math.min(5000, 600 * retry));
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); clearInterval(ping); clearInterval(napPoll); wsRef.current?.close(); };
  }, [code, game]);

  const send = useCallback((m: ClientMsg<Action, Settings>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
    else setError('Reconnecting… try again in a second.');
  }, []);
  const clearError = useCallback(() => setError(''), []);
  /** Call from the Leave button before navigating away: if you host, host (and the music) passes to the next player. Best effort. */
  const leave = useCallback(() => { const ws = wsRef.current; try { if (ws && ws.readyState === 1) ws.send('{"type":"leave"}'); } catch { /* already closed */ } }, []);
  return { snap, status, error, send, clearError, napUntil, endedReason, leave };
}
