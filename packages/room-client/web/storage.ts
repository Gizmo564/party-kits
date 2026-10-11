// Per-game browser storage for the room: the rejoin token for each room code, and the last room the player was in.
// Keys are namespaced by game id so two games on different subdomains (and any future shared origin) never collide.
// Every access is wrapped: private mode / blocked storage must never break play (you just can't rejoin after a reload).
const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const del = (k: string) => { try { localStorage.removeItem(k); } catch { /* private mode */ } };

export function roomStore(game: string) {
  const tokenKey = (code: string) => `${game}-token-${code}`;
  const roomKey = `${game}-room`;
  const recentKey = `${game}-recent`;   // 'room' | 'game': which of the two was used last (Track Record's tr-recent), so the front menu offers the right Resume button
  return {
    savedToken: (code: string): string | undefined => get(tokenKey(code)) ?? undefined,
    saveToken: (code: string, token: string) => set(tokenKey(code), token),
    forgetToken: (code: string) => del(tokenKey(code)),
    rememberRoom: (code: string) => { set(roomKey, code); set(recentKey, 'room'); },
    /** call when a pass-and-play game is saved, so "Resume game" wins over "Rejoin room" */
    rememberLocalGame: () => set(recentKey, 'game'),
    recent: (): 'room' | 'game' | null => { const v = get(recentKey); return v === 'room' || v === 'game' ? v : null; },
    lastRoom: (): string | null => get(roomKey),
    forgetRoom: () => del(roomKey),
  };
}
export type RoomStore = ReturnType<typeof roomStore>;
