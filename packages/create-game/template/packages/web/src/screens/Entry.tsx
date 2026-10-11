import { useState } from 'react';
import { createRoom, roomInfo } from '@gizmo564/room-client/web';
import { usePrefillName } from '@gizmo564/platform/web/account';
import { useMusic } from '@gizmo564/audio/web';
import { audio } from '../audio';
import type { Route } from '../App';

const NAME_KEY = '__SLUG__-name';
const loadName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const saveName = (n: string) => { try { if (n) localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ } };

/**
 * Two jobs, one screen (the same split as Track Record, Sandwich Slam and Chameleon):
 *  - no joinCode: "Host Online". Play on this device (you are the host and play the music) or use it as the host screen (a TV).
 *  - joinCode (someone opened a plain /?room=CODE link): just a name, then Join, or Just watch.
 * Typing a code by hand lives on play.0801564.xyz, not here.
 */
export function Entry({ joinCode, onGo, onBack }: { joinCode: string; onGo: (r: Route) => void; onBack: () => void }) {
  const [name, setName] = useState(loadName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const clean = name.trim();
  usePrefillName(name, setName);
  useMusic(audio, 'menu');   // the menu track also plays on the host / join screens (Chameleon: title, host and how-to)

  const host = async (screen: boolean) => {
    setBusy(true); setErr('');
    try {
      await audio.unlock();
      const code = await createRoom();
      saveName(clean);
      onGo({ kind: 'online', code, role: screen ? 'display' : 'player', name: clean || (screen ? 'Display' : 'Host') });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const join = async (watch: boolean) => {
    setBusy(true); setErr('');
    try {
      const info = await roomInfo(joinCode);
      if (!info.exists) { setErr(`No room ${joinCode}. Check the code on the host's screen.`); return; }
      await audio.unlock();
      saveName(clean);
      onGo({ kind: 'online', code: joinCode, role: watch || info.started ? 'audience' : 'player', name: clean });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="row between"><button className="btn small" onClick={onBack}>← Back</button><h1 className="h-lg">{joinCode ? `Join ${joinCode}` : 'Host Online'}</h1><span /></div>
      <section className="panel">
        <h2>Your name</h2>
        <input className="field" aria-label="Your name" placeholder="Name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} data-testid="name" />
      </section>
      {joinCode ? (
        <section className="panel">
          <button className="btn accent big" disabled={busy || !clean} onClick={() => void join(false)} data-testid="join">Join the game</button>
          <button className="btn" disabled={busy} onClick={() => void join(true)} data-testid="watch">Just watch</button>
        </section>
      ) : (
        <section className="panel">
          <p className="muted">Everyone else joins from their own phone at <b>play.0801564.xyz</b>. The first person in is the host.</p>
          <button className="btn primary big" disabled={busy || !clean} onClick={() => void host(false)} data-testid="host-here">Play on this device</button>
          <p className="muted">You play from this phone. Add a TV later with Show on TV.</p>
          <button className="btn big" disabled={busy} onClick={() => void host(true)} data-testid="host-screen">Use as host screen</button>
          <p className="muted">For a TV or laptop. It shows the table while everyone plays from their phones.</p>
        </section>
      )}
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div>
  );
}
