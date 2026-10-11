import { useEffect, useState } from 'react';
import { AUTO, type Jukebox } from './jukebox';

/** Where the choice goes when this device is only a remote control for another one (the host's phone steering the TV). */
export interface JukeboxRemote {
  track: string;
  /** null = the TV's own level */
  volume: number | null;
  onTrack(id: string): void;
  onVolume(v: number): void;
  /** shown under the title, e.g. "Plays on the TV" */
  note?: string;
}

export interface JukeboxPanelProps {
  jukebox: Jukebox;
  /** with this, the panel steers a shared setting instead of this device's own sound */
  remote?: JukeboxRemote;
  title?: string;
  className?: string;
  defaultOpen?: boolean;
  /** which house class the song buttons wear */
  buttonClass?: string;
  activeClass?: string;
}

/** A button that rolls out the song list (Auto first) and a volume slider. */
export function JukeboxPanel({ jukebox, remote, title = 'Jukebox', className = '', defaultOpen = false, buttonClass = 'btn small', activeClass = 'accent' }: JukeboxPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [, bump] = useState(0);
  useEffect(() => jukebox.subscribe(() => bump((n) => n + 1)), [jukebox]);
  useEffect(() => { if (open && jukebox.tracks().length === 0) void jukebox.load(); }, [open, jukebox]);

  const tracks = jukebox.tracks();
  const selected = remote ? remote.track : jukebox.selected();
  const volume = remote ? (remote.volume ?? jukebox.volume()) : jukebox.volume();
  const pick = (id: string) => { if (remote) remote.onTrack(id); else { void jukebox.audio.unlock(); jukebox.select(id); } };
  const setVol = (v: number) => { if (remote) remote.onVolume(v); else jukebox.setVolume(v); };
  const current = selected === AUTO ? 'Auto' : (tracks.find((t) => t.id === selected)?.name ?? 'Auto');

  return (
    <div className={`jukebox ${open ? 'open' : ''} ${className}`.trim()} data-testid="jukebox">
      <button type="button" className={buttonClass} aria-expanded={open} aria-controls="jukebox-panel" data-testid="jukebox-toggle" onClick={() => setOpen(!open)}>
        <span aria-hidden>♪</span> {title}{open ? '' : `: ${current}`}
      </button>
      {open && (
        <div id="jukebox-panel" className="jukebox-panel" role="group" aria-label={title} data-testid="jukebox-panel">
          {remote?.note && <p className="jukebox-note">{remote.note}</p>}
          <div className="jukebox-list">
            <button type="button" className={`${buttonClass} ${selected === AUTO ? activeClass : ''}`.trim()} aria-pressed={selected === AUTO} data-testid="jukebox-track-auto" onClick={() => pick(AUTO)}>Auto</button>
            {tracks.map((t) => (
              <button key={t.id} type="button" className={`${buttonClass} ${selected === t.id ? activeClass : ''}`.trim()} aria-pressed={selected === t.id} data-testid={`jukebox-track-${t.id}`} onClick={() => pick(t.id)}>{t.name}</button>
            ))}
          </div>
          {tracks.length === 0 && <p className="jukebox-note">Songs are not available right now. Auto still works.</p>}
          <label className="jukebox-volume">
            <span>Volume</span>
            <input type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} aria-label="Music volume" data-testid="jukebox-volume" onChange={(e) => setVol(Number(e.target.value) / 100)} />
            <span className="jukebox-pct" aria-hidden>{Math.round(volume * 100)}%</span>
          </label>
        </div>
      )}
    </div>
  );
}
