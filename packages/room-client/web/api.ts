// The two HTTP calls every game makes before it opens a websocket.

/** Ask the Worker for a new room. Throws a message that is fine to show the player. */
export async function createRoom(fetcher: typeof fetch = fetch): Promise<string> {
  const r = await fetcher('/api/rooms', { method: 'POST' });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string; napping?: boolean };
    throw new Error(j.napping && j.error ? j.error : 'Could not create a room. Try again in a moment.');
  }
  return ((await r.json()) as { code: string }).code;
}

export interface RoomInfo { exists: boolean; started?: boolean; players?: number; maxPlayers?: number }

/** Does this room exist (and has it started)? Throws "Could not reach the game server." when the network is down. */
export async function roomInfo(code: string, fetcher: typeof fetch = fetch): Promise<RoomInfo> {
  try {
    const r = await fetcher(`/api/rooms/${code}`);
    if (r.status === 404) return { exists: false };
    if (!r.ok) throw new Error('bad status');
    return (await r.json()) as RoomInfo;
  } catch { throw new Error('Could not reach the game server.'); }
}
