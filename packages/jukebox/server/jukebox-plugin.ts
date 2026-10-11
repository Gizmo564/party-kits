// RoomPlugin: the room's shared jukebox choice. The host sends { type: 'jukebox', track?, volume? }; everyone's snapshot then
// carries it in `plugins.jukebox`, and the device that plays the room's music (usually the TV) follows it.
// `track` is 'auto' (the game's own music) or a song id from the music host's list; `volume` is 0..1 or null (the device's own).
import type { BaseRoom, Member, RoomPlugin } from '@gizmo564/room-server/server/base-room';
import type { ClientMsg } from '@gizmo564/room-server/server/protocol';

export interface JukeboxState { track: string; volume: number | null }
export type JukeboxMsg = { type: 'jukebox'; track?: string; volume?: number | null };

const TRACK = /^(auto|[a-z0-9][a-z0-9-]{0,63})$/;

export function jukeboxPlugin(): RoomPlugin {
  let state: JukeboxState = { track: 'auto', volume: null };
  return {
    id: 'jukebox',
    save: () => state,
    load(data) {
      const d = data as Partial<JukeboxState> | null;
      if (d && typeof d.track === 'string' && TRACK.test(d.track)) state = { track: d.track, volume: typeof d.volume === 'number' ? Math.min(1, Math.max(0, d.volume)) : null };
    },
    onMessage(_room: BaseRoom, me: Member, msg: ClientMsg): string | null | undefined {
      const m = msg as unknown as { type?: string } & JukeboxMsg;
      if (m.type !== 'jukebox') return undefined;
      if (!me.host) return 'only the host can change the music';
      const next = { ...state };
      if (m.track !== undefined) {
        if (typeof m.track !== 'string' || !TRACK.test(m.track)) return 'unknown song';
        next.track = m.track;
      }
      if (m.volume !== undefined) {
        if (m.volume !== null && (typeof m.volume !== 'number' || !Number.isFinite(m.volume))) return 'bad volume';
        next.volume = m.volume === null ? null : Math.min(1, Math.max(0, m.volume));
      }
      state = next;
      return null;
    },
    publicData: () => state,
  };
}

/** Read the shared choice out of a snapshot (`snap.plugins`). Missing or malformed means Auto. */
export function jukeboxFromPlugins(plugins: Record<string, unknown> | undefined): JukeboxState {
  const d = plugins?.jukebox as Partial<JukeboxState> | undefined;
  const track = typeof d?.track === 'string' && TRACK.test(d.track) ? d.track : 'auto';
  const volume = typeof d?.volume === 'number' && Number.isFinite(d.volume) ? Math.min(1, Math.max(0, d.volume)) : null;
  return { track, volume };
}
