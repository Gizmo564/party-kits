import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCaster, type CasterView } from './sender';
import { onCastScreen } from './receiver';

/**
 * "Show on TV" button. Show it to the host's device AND on a host display (`you.host || you.screen`), in the lobby and during the game:
 * either one can start the cast. It hides itself on the Chromecast receiver and in any frame, so the TV never offers to cast to itself.
 * (Track Record, 2026-10-10.) Shown wherever Cast can work (Chrome on a computer or Android); Chrome's own
 * device picker says when no TV is found. Elsewhere (iPhone, Safari, Firefox) a greyed-out button shows the reason (AirPlay / Join as Display) on hover.
 * In the 0801564 Games TV app it renders nothing.
 */
/** The 0801564 Games TV app adds "0801564TV" to its user agent. That screen is the TV itself, so it never shows Cast or AirPlay controls. */
const inTvApp = () => typeof navigator !== 'undefined' && /0801564TV/.test(navigator.userAgent || '');

export function CastButton({ game, code, className = '', noteClassName = '', fallback }: { game: string; code: string; className?: string; noteClassName?: string; /** shown when casting fails or no TV is found: the TV link + QR, so the TV's own browser can open it */ fallback?: ReactNode }) {
  const { caster, setCode } = useMemo(() => getCaster(game), [game]);
  useEffect(() => { setCode(code); }, [setCode, code]);
  const [v, setV] = useState<CasterView>(caster.view());
  useEffect(() => caster.subscribe(setV), [caster]);
  useEffect(() => { if (v.state === 'casting') caster.sync(); }, [caster, v.state]);
  if (onCastScreen() || inTvApp() || v.state === 'loading') return null;
  if (v.state === 'unsupported') {
    // Greyed out, with the reason on hover, instead of a paragraph of text.
    return <button type="button" className={className} data-testid="cast-btn-unavailable" aria-disabled="true" style={{ opacity: 0.45, cursor: 'not-allowed' }} onClick={(e) => e.preventDefault()}
      title="Show on TV needs Chrome on a computer or Android phone. On iPhone or iPad, use Screen Mirroring (AirPlay) to an Apple TV, or open play.0801564.xyz on the TV and choose Join as Display.">Show on TV</button>;
  }
  const casting = v.state === 'casting';
  const failed = v.state === 'failed';
  return (<>
    <button type="button" className={className} data-testid="cast-btn" onClick={() => (casting ? caster.stop() : void caster.start())} disabled={v.state === 'connecting'}>
      {casting ? `Casting${v.device ? ` to ${v.device}` : ''} · stop` : v.state === 'connecting' ? 'Connecting…' : failed ? 'Try again' : 'Show on TV'}
    </button>
    {failed ? <small className={noteClassName} data-testid="cast-failed" role="status">Could not cast on this network. Open the link below in the TV's browser, or on that device choose "Use as host screen".</small> : null}
    {failed ? fallback : null}
  </>);
}
