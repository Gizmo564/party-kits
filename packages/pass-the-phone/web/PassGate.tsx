import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { confirm, initialGate, isCovered, recover, DEFAULT_IDLE_COVER_MS } from './pass-gate-state';
import type { GateState } from './pass-gate-state';

/**
 * Pass-the-phone gate. Wrap the part of your game that shows private information:
 *
 *   <PassGate turnKey={`${state.turn}:${state.current}`} isPrivatePhase={state.phase === 'listen'}
 *             saved={savedGate} onChange={(g) => save({ state, gate: g })}
 *             cover={(ready) => <MyCover name={player.name} onReady={ready} />}>
 *     <MyHandScreen />
 *   </PassGate>
 *
 * The cover is yours (avatar, "Pass the phone to Ann", what happened since their last turn, a Ready button);
 * the gate only decides when to show it. It re-covers by itself if the tab is hidden (phone locked or app switched)
 * or after `idleCoverMs` with no touches, so a hand is never left open on a phone that was put down.
 */
export function PassGate({ turnKey, isPrivatePhase, cover, children, saved, onChange, idleCoverMs = DEFAULT_IDLE_COVER_MS, onReady }: {
  turnKey: string;
  isPrivatePhase: boolean;
  cover: (ready: () => void) => ReactNode;
  children: ReactNode;
  saved?: GateState | null;
  onChange?: (g: GateState) => void;
  idleCoverMs?: number;
  /** called when the player taps ready (start the clip, play the whoosh, unlock audio...) */
  onReady?: () => void;
}) {
  const [gate, setGate] = useState<GateState>(() => initialGate(saved));
  const set = (g: GateState) => { setGate(g); onChange?.(g); };
  const covered = isCovered(gate, turnKey, isPrivatePhase);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // cover again when the tab is hidden
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'hidden' && isPrivatePhase) set(recover()); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [isPrivatePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // cover again after a stretch with no touches
  useEffect(() => {
    if (!idleCoverMs || covered || !isPrivatePhase) return;
    const bump = () => { clearTimeout(idle.current); idle.current = setTimeout(() => set(recover()), idleCoverMs); };
    bump();
    const evs = ['pointerdown', 'keydown'] as const;
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => { clearTimeout(idle.current); evs.forEach((e) => window.removeEventListener(e, bump)); };
  }, [covered, isPrivatePhase, idleCoverMs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (covered) return <>{cover(() => { onReady?.(); set(confirm(gate, turnKey)); })}</>;
  return <>{children}</>;
}
