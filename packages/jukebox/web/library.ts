// The shared song list. One small JSON file on the music host (music.0801564.xyz/tracks.json) names every song, so adding or
// renaming a song never needs a game to be rebuilt:
//   { "tracks": [ { "id": "chameleon-lobby", "name": "Lobby Groove", "file": "tracks/chameleon-lobby.mp3" } ] }
// `file` is relative to the host. A copy of the last good list is kept in localStorage so the jukebox still has songs
// after a flaky load; with no list at all the jukebox simply offers Auto.

export interface Track { id: string; name: string; url: string }

export const DEFAULT_MUSIC_BASE = 'https://music.0801564.xyz/';
const CACHE_KEY = 'jukebox-library-v1';
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Turn the host's JSON into tracks; anything malformed is dropped rather than throwing. */
export function parseLibrary(json: unknown, base: string = DEFAULT_MUSIC_BASE): Track[] {
  const list = (json as { tracks?: unknown } | null)?.tracks;
  if (!Array.isArray(list)) return [];
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const t of list) {
    const r = t as { id?: unknown; name?: unknown; file?: unknown };
    if (typeof r.id !== 'string' || !ID.test(r.id) || seen.has(r.id)) continue;
    if (typeof r.file !== 'string' || !r.file) continue;
    let url: string;
    try { url = new URL(r.file, base).toString(); } catch { continue; }
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : r.id;
    seen.add(r.id);
    out.push({ id: r.id, name, url });
  }
  return out;
}

export interface LibraryOptions { base?: string; fetchImpl?: typeof fetch }

/** Fetch the list; fall back to the last good copy, then to nothing. */
export async function fetchLibrary(opts: LibraryOptions = {}): Promise<Track[]> {
  const base = opts.base ?? DEFAULT_MUSIC_BASE;
  const f = opts.fetchImpl ?? fetch;
  try {
    const r = await f(new URL('tracks.json', base).toString(), { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const json: unknown = await r.json();
    const tracks = parseLibrary(json, base);
    if (tracks.length) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch { /* ignore */ } }
    return tracks;
  } catch {
    try { return parseLibrary(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'), base); } catch { return []; }
  }
}
