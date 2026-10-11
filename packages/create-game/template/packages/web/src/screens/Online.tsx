import { useEffect } from 'react';
import { ConnectionBanner, NapNotice, RoomGone, roomStore, useRoom } from '@gizmo564/room-client/web';
import { HostPanel, LobbyScreen, type SectionDef } from '@gizmo564/lobby-host/web';
import { ResultsScreen, RulesButton, Tutorial } from '@gizmo564/rules-results/web';
import { DisplayShell, Stage } from '@gizmo564/host-display/web';
import { MusicButton, useMusicDevice } from '@gizmo564/audio/web';
import { CastButton, isCastReceiver } from '@gizmo564/cast/web';
import { Qr } from '@gizmo564/lobby-ui/web/Qr';
import { ROSTER, EMOJIS, LIMITS, type LuckyAction, type LuckySettings, type LuckyView } from '@game/engine';
import { audio } from '../audio';
import { RULES, TOUR } from '../rules';
import { GameCredits } from '../credits';
import { Hand } from './Play';
import { RevealPanel, Table, emojiOf } from './Table';

const GAME = '__SLUG__';

const SECTIONS: SectionDef<LuckySettings>[] = [{
  title: 'Game',
  fields: [
    { key: 'rounds', kind: 'stepper', label: 'Rounds', min: LIMITS.rounds[0], max: LIMITS.rounds[1] },
    { key: 'pickSeconds', kind: 'stepper', label: 'Seconds to pick', min: LIMITS.pickSeconds[0], max: LIMITS.pickSeconds[1], step: 2 },
    { key: 'revealSeconds', kind: 'stepper', label: 'Seconds to show the result', min: LIMITS.revealSeconds[0], max: LIMITS.revealSeconds[1] },
  ],
}];

export function Online({ code, role, name, onLeave }: { code: string; role: 'player' | 'audience' | 'display'; name: string; onLeave: () => void }) {
  const display = role === 'display';
  const { snap, status, error, send, napUntil, endedReason, leave: tellRoom } = useRoom<LuckySettings, LuckyView, LuckyAction>({
    game: GAME, code, opts: { name: name || undefined, spectate: role === 'audience', screen: display, cast: display ? isCastReceiver() : undefined },
  });
  useMusicDevice(audio, !!snap?.you.music);
  useEffect(() => { if (!display && role === 'player') roomStore(GAME).rememberRoom(code); }, [code, display, role]);

  const leave = () => { tellRoom(); roomStore(GAME).forgetRoom(); onLeave(); };   // tellRoom: a leaving host passes hosting on
  if (status === 'missing' || status === 'ended') return <RoomGone status={status} reason={endedReason} onLeave={leave} />;
  const banners = <><NapNotice until={napUntil} /><ConnectionBanner status={status} /></>;
  if (!snap) return <div className="page">{banners}<p className="muted center-text">Joining {code}…</p></div>;

  const me = snap.members.find((m) => m.id === snap.you.id);
  const joinUrl = ROSTER.shareUrl(code);
  // shown by the Cast button when casting fails: a link + QR to the TV view, so the TV's own browser (or a laptop on it) can open it
  const tvUrl = `${location.origin}/?room=${code}&role=display`;
  const castFallback = <div className="center-col"><Qr text={tvUrl} size={140} /><small className="muted">{tvUrl.replace(/^https?:\/\//, '')}</small></div>;
  const v = snap.view;

  // ---- lobby ----
  if (!snap.started) {
    return (
      <>
        {banners}
        <LobbyScreen
          snap={snap} send={send} error={error} onLeave={leave} joinUrl={joinUrl}
          minPlayers={2} maxPlayers={6} sections={SECTIONS} bots avatarLooks={21}
          onJoinSound={() => audio.sfx('join')}
          playerExtra={(m) => (emojiOf(m) ? <span aria-hidden>{emojiOf(m)}</span> : null)}
          profileExtra={
            <div className="row" role="group" aria-label="Badge">
              {EMOJIS.map((e) => (
                <button key={e} className="btn small emoji-btn" aria-pressed={emojiOf(me) === e} onClick={() => send({ type: 'profile', data: { emoji: e } })}>{e}</button>
              ))}
            </div>
          }
        >
          {snap.you.host || display ? <CastButton game={GAME} code={code} className="btn" fallback={castFallback} /> : null}
        </LobbyScreen>
      </>
    );
  }
  if (!v) return <div className="page">{banners}</div>;

  // ---- results ----
  if (snap.over) {
    const rows = snap.members.filter((m) => m.role === 'player' && !m.screen).map((m) => ({ id: m.id, name: m.name, color: m.color, avatar: m.avatar, score: v.scores[m.id] ?? 0 }));
    return <>{banners}<ResultsScreen rows={rows} meId={snap.you.id} isHost={snap.you.host} onAgain={() => send({ type: 'again' })} onLeave={leave} onEnd={() => send({ type: 'end' })} credits={<GameCredits />} />{error ? <p className="err" role="alert">{error}</p> : null}</>;
  }

  const table = <Table view={v} members={snap.members} meId={snap.you.id} total={snap.settings.pickSeconds * 1000} />;
  const reveal = v.phase === 'reveal' && v.last ? <RevealPanel reveal={v.last} members={snap.members} /> : null;

  // ---- TV ----
  if (display) {
    return (
      <Stage>
        {banners}
        <DisplayShell code={code} joinUrl={joinUrl} title="__NAME__" right={<CastButton game={GAME} code={code} className="btn small" />}>
          {/* a TV has nobody to tap: it never waits on a button. Rounds move on by the server's timers; the host's phone starts and restarts the game */}
          <div className="display-table">{table}{reveal ?? <section className="panel center-col"><h2>Waiting for everyone to play…</h2></section>}</div>
        </DisplayShell>
      </Stage>
    );
  }

  // ---- phone ----
  return (
    <div className="page">
      {banners}
      <Tutorial game={GAME} steps={TOUR} sound={() => audio.sfx('tap')} />
      <div className="row between">
        <button className="btn small" onClick={leave}>Leave</button>
        <div className="row"><MusicButton audio={audio} /><RulesButton sections={RULES} /></div>
      </div>
      {snap.you.host ? (
        <details className="panel hostpanel" data-testid="host-controls">
          <summary>Host controls</summary>
          {/* everything the TV cannot do lives here: Show on TV, where the music plays, who is here. Add the game's own buttons as children */}
          <HostPanel snap={snap} send={send} cast={<CastButton game={GAME} code={code} className="btn small" fallback={castFallback} />} onUnlock={() => void audio.unlock()} />
        </details>
      ) : null}
      {table}
      {reveal}
      {v.hand ? <Hand view={v} onPick={(card) => { audio.sfx('lock'); send({ type: 'act', action: { type: 'pick', card } }); }} /> : <p className="muted center-text">You are watching.</p>}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </div>
  );
}
