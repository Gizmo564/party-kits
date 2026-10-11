import { useEffect, useState } from 'react';
import type { AudioKit } from './audio';

/** Play one looping track while mounted. `undefined` leaves the music to a child screen; `null` is silence. */
export function useMusic(audio: AudioKit, name: string | null | undefined): void {
  useEffect(() => { if (name === undefined) return; audio.music(name); return () => audio.music(null); }, [audio, name]);
}

/**
 * Follow the room: music plays on this device only if the server made it the music device (Snapshot.you.music), and not at all
 * while the player has muted. Pass `you.music` straight from the snapshot.
 */
export function useMusicDevice(audio: AudioKit, isMusicDevice: boolean): void {
  useEffect(() => { audio.setOutput(isMusicDevice); }, [audio, isMusicDevice]);
}

export function MusicButton({ audio, className = 'btn small' }: { audio: AudioKit; className?: string }) {
  const [off, setOff] = useState(audio.isMuted());
  useEffect(() => audio.subscribe(() => setOff(audio.isMuted())), [audio]);
  return <button type="button" className={className} aria-pressed={!off} data-testid="music-toggle" onClick={() => { audio.setMuted(!off); void audio.unlock(); }}>{off ? 'Sound: off' : 'Sound: on'}</button>;
}
