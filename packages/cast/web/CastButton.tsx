import { useEffect, useMemo, useState } from 'react';
import { getCaster, type CasterView } from './sender';
import { onCastScreen } from './receiver';

/**
 * "Show on TV" button. Show it to the host's device AND on a host display (`you.host || you.screen`), in the lobby and during the game:
 * either one can start the cast. It hides itself on the Chromecast receiver and in any frame, so the TV never offers to cast to itself.
 * (Track Record, 2026-10-10.) Shown wherever Cast can work (Chrome on a computer or Android); Chrome's own
 * device picker says when no TV is found. Elsewhere (iPhone, Safari, Firefox) a short note says why there is no button and
 * points at AirPlay / Join as Display (wording as of 2026-10-10 in all three games).
 */
export function CastButton({ game, code, className = '', noteClassName = '' }: { game: string; code: string; className?: string; noteClassName?: string }) {
  const { caster, setCode } = useMemo(() => getCaster(game), [game]);
  useEffect(() => { setCode(code); }, [setCode, code]);
  const [v, setV] = useState<CasterView>(caster.view());
  useEffect(() => caster.subscribe(setV), [caster]);
  useEffect(() => { if (v.state === 'casting') caster.sync(); }, [caster, v.state]);
  if (onCastScreen() || v.state === 'loading') return null;
  if (v.state === 'unsupported') return <small className={noteClassName} data-testid="cast-note">Show on TV needs Chrome on a computer or Android phone. On iPhone or iPad, use Screen Mirroring (AirPlay) to an Apple TV, or open play.0801564.xyz on the TV and choose Join as Display.</small>;
  const casting = v.state === 'casting';
  return (
    <button type="button" className={className} data-testid="cast-btn" onClick={() => (casting ? caster.stop() : void caster.start())} disabled={v.state === 'connecting'}>
      {casting ? `Casting${v.device ? ` to ${v.device}` : ''} · stop` : v.state === 'connecting' ? 'Connecting…' : 'Show on TV'}
    </button>
  );
}
