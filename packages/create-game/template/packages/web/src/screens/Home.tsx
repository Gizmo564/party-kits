import { useState } from 'react';
import { roomStore } from '@gizmo564/room-client/web';
import { RulesButton } from '@gizmo564/rules-results/web';
import { MusicButton, useMusic } from '@gizmo564/audio/web';
import { ThemePicker } from '@gizmo564/themes/web/ThemePicker';
import { ReturnLink } from '@gizmo564/platform/web/ReturnLink';
import { audio } from '../audio';
import { RULES } from '../rules';
import { GameCredits } from '../credits';
import { hasLocalGame } from './Local';
import type { Route } from '../App';

const GAME = '__SLUG__';

/**
 * The front menu every party game shares: Resume/Rejoin (only when there is something to go back to), Host Online, Pass and Play,
 * How to Play, Sound, and a pointer to play.0801564.xyz for people who are joining (typing codes lives there, not here).
 * Button names are the same in Track Record, Sandwich Slam and Chameleon.
 */
export function Home({ onGo }: { onGo: (r: Route) => void }) {
  useMusic(audio, 'menu');   // front-menu music (Chameleon and Sandwich Slam have one); a missing file is skipped
  const [, force] = useState(0);
  const store = roomStore(GAME);
  const room = store.lastRoom();
  const local = hasLocalGame();
  const resume = local && (!room || store.recent() === 'game')
    ? { label: 'Resume game', run: () => onGo({ kind: 'local' }) }
    : room ? { label: `Rejoin room ${room}`, run: () => onGo({ kind: 'online', code: room, role: 'player', name: '' }) } : null;
  const go = (f: () => void) => () => { void audio.unlock(); f(); force((n) => n + 1); };

  return (
    <div className="page">
      <ReturnLink />
      <div className="center-col">
        <h1 className="display">__NAME__</h1>
        <p className="muted">Play a card in secret. The highest card nobody else played wins the prize.</p>
      </div>
      <div className="stack">
        {resume ? <button className="btn primary big" onClick={go(resume.run)} data-testid="resume">{resume.label}</button> : null}
        <button className="btn accent big" onClick={go(() => onGo({ kind: 'entry', joinCode: '' }))} data-testid="host">Host Online</button>
        <button className="btn primary big" onClick={go(() => onGo({ kind: 'local' }))} data-testid="local">Pass and Play</button>
        <RulesButton sections={RULES} label="How to Play" className="btn" />
        <MusicButton audio={audio} />
        <div className="joinblurb">
          <span>Trying to join a game?</span>
          <a className="btn" href="https://play.0801564.xyz">Go to play.0801564.xyz</a>
        </div>
      </div>
      <GameCredits />   {/* Track Record also shows credits on its front menu; all games show them on game over */}
      <ThemePicker game={GAME} />
    </div>
  );
}
