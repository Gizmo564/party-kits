import type { ReactNode } from 'react';

export interface MusicCredit {
  title: string; by: string;
  /** the artist's site, shown in brackets after the name */
  url?: string;
  /** a licence that asks for attribution (Kevin MacLeod's tracks are CC BY 4.0) */
  license?: { name: string; url: string };
}

export const CREATOR_LINE = 'Created, designed, illustrated and built by Tanner Nelson';
export const AUDIO_LIBRARY_NOTE = 'Music and sound effects are from the YouTube Audio Library.';
const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * Who made this game: a collapsed "Credits" panel shown on the game-over screen (ResultsScreen's `credits` prop, or drop it anywhere).
 * Identical shape in Track Record, Sandwich Slam and Chameleon (markup, class names, the creator line and the YouTube Audio Library note);
 * only the music list and game-specific lines differ, so they are data here.
 *
 *   <Credits music={[{ title: 'Survival Mode', by: 'Blue Deer' }]} extra={[<>Song previews: <a href="https://www.deezer.com">Deezer</a></>]} />
 */
export function Credits({ music = [], extra = [], creator = CREATOR_LINE, note = AUDIO_LIBRARY_NOTE }: { music?: MusicCredit[]; extra?: ReactNode[]; creator?: string; note?: string | null }) {
  return (
    <details className="credits panel" data-testid="credits">
      <summary><b>Credits</b></summary>
      <div className="credits-body">
        <p><b>{creator}</b></p>
        {music.length ? <p><b>Music</b></p> : null}
        {music.map((m) => (
          <p key={m.title}>
            “{m.title}” by {m.by}
            {m.url ? <> (<a href={m.url} {...ext}>{host(m.url)}</a>)</> : null}
            {m.license ? <><br />Licensed under Creative Commons: {m.license.name}: <a href={m.license.url} {...ext}>{host(m.license.url)}</a></> : null}
          </p>
        ))}
        {extra.map((x, i) => <p key={i}>{x}</p>)}
        {note ? <p>{note}</p> : null}
      </div>
    </details>
  );
}
