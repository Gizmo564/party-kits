// The jukebox: the shared song list wired into a game's audio kit. The game keeps its own music logic (lobby, playing,
// results...). "Auto" means exactly that; picking a song makes it play instead, for as long as the game wants music.
import type { AudioKit } from '@gizmo564/audio/web';
import { fetchLibrary, type LibraryOptions, type Track } from './library';

export const AUTO = 'auto';
/** the name a song has inside the audio kit */
export const audioName = (id: string) => `jb:${id}`;

export interface Jukebox {
  audio: AudioKit;
  tracks(): Track[];
  /** 'auto' or a track id */
  selected(): string;
  /** 0..1, what the slider should show */
  volume(): number;
  /** load (or reload) the song list from the music host */
  load(): Promise<void>;
  /** replace the song list (tests, or a game with its own list) */
  setTracks(tracks: Track[]): void;
  /** play this song instead of the game's music; 'auto' goes back to the game's own */
  select(id: string): void;
  setVolume(v: number): void;
  /** follow a room's shared choice (the host's pick): the TV calls this whenever the snapshot changes */
  apply(shared: { track: string; volume: number | null }): void;
  subscribe(fn: () => void): () => void;
}

export function createJukebox(audio: AudioKit, opts: LibraryOptions = {}): Jukebox {
  let tracks: Track[] = [];
  let selected = AUTO;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((f) => f());
  audio.subscribe(emit);       // a volume change from anywhere moves the slider

  const known = (id: string) => tracks.some((t) => t.id === id);
  const pushOverride = () => audio.setOverride(selected !== AUTO && known(selected) ? audioName(selected) : null);

  const jb: Jukebox = {
    audio,
    tracks: () => tracks,
    selected: () => selected,
    volume: () => audio.getVolume(),
    setTracks(next) {
      tracks = next;
      for (const t of tracks) audio.addTrack(audioName(t.id), t.url);
      pushOverride(); emit();
    },
    async load() { jb.setTracks(await fetchLibrary(opts)); },
    select(id) { selected = id; pushOverride(); emit(); },
    setVolume(v) { audio.setVolume(v); },
    apply(shared) {
      if (shared.track !== selected) { selected = shared.track; pushOverride(); emit(); }
      if (shared.volume !== null && Math.abs(shared.volume - audio.getVolume()) > 0.005) audio.setVolume(shared.volume);
    },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
  return jb;
}
