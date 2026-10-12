import { useEffect, useRef, type ReactNode } from 'react';
import { PLAYER_COLORS } from '@gizmo564/engine-core/engine';
import type { ClientMsg, Snapshot } from '@gizmo564/room-server/server/protocol';
import { CodePanel, DeviceGrid, FullscreenButton, LobbyHeader, PlayerList, ProfileEditor, StickyBar, TvLobbyFrame, LOOK_COUNT } from '@gizmo564/lobby-ui/web';
import { SettingsForm, type SectionDef } from './SettingsForm';
import { MusicWhere } from './HostPanel';

export interface LobbyScreenProps<S extends Record<string, any>> {
  snap: Snapshot<S, unknown>;
  send: (m: ClientMsg<any, S>) => void;
  error: string;
  onLeave: () => void;
  /** the link in the QR / code panel: ROSTER.shareUrl(code) */
  joinUrl: string;
  minPlayers: number;
  maxPlayers: number;
  sections: SectionDef<S>[];
  /** a reason the host cannot start yet that only the game knows (teams unbalanced, deck still loading) */
  blockReason?: string | null;
  /** game-specific profile fields (team, role...) rendered inside the "You" panel */
  profileExtra?: ReactNode;
  /** extra chip per player in the list */
  playerExtra?: Parameters<typeof PlayerList>[0]['extra'];
  /** bots on? needs the bots-away plugin on the server */
  bots?: boolean;
  /** play a sound when someone joins: pass sfx('join') */
  onJoinSound?: () => void;
  avatarLooks?: number;
  /** rendered between the player list and the settings (game panels, team toggle...) */
  children?: ReactNode;
  /** TV and sound buttons (Show on TV, Show on wired TV...). On a phone: one row under the players. On a TV: in the top bar beside Full screen. */
  devices?: ReactNode;
  /** fold "You" (name, face, color) to one line until tapped. Default true: the lobby stays short and Start stays in reach */
  profileCollapsed?: boolean;
  startLabel?: string;
}

/**
 * The whole online lobby, assembled from the kit: code + QR, take-control when a room has no host (the first player to join normally is host), players with host
 * controls, your profile, schema-driven settings, and the Start button with a plain-words reason when it is disabled.
 * On a TV (`you.screen`) it is a fixed, no-scroll screen: code, QR and the players with their faces, and nothing to tap. Settings, the profile,
 * Start, bots and the music picker all live on the host's phone.
 * Games with unusual lobbies can still use the parts directly.
 */
export function LobbyScreen<S extends Record<string, any>>(p: LobbyScreenProps<S>) {
  const { snap, send } = p;
  const me = snap.members.find((m) => m.id === snap.you.id)!;
  const hasHost = snap.members.some((m) => m.host);
  const host = snap.you.host;
  const players = snap.members.filter((m) => m.role === 'player' && !m.screen);
  const seen = useRef(snap.members.length);
  useEffect(() => { if (snap.members.length > seen.current) p.onJoinSound?.(); seen.current = snap.members.length; }, [snap.members.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const botCount = players.filter((m) => m.bot).length;
  const enough = players.length >= p.minPlayers;
  const reason = !enough ? `Waiting for at least ${p.minPlayers} player${p.minPlayers === 1 ? '' : 's'}${p.bots ? ' (add a bot?)' : ''}.` : p.blockReason ?? null;

  const tv = me.screen;
  const hostMember = snap.members.find((m) => m.host);
  // ---- a TV: fixed to the window, never scrolls, nothing to tap (everything else is on the host's phone) ----
  if (tv) {
    return (
      <TvLobbyFrame
        buttons={<>{p.devices}<FullscreenButton /></>}
        left={<>
          <CodePanel code={snap.code} joinUrl={p.joinUrl} showQr qrSize={220} tv />
          <p className="muted center-text tvnote">{hostMember ? `${hostMember.name} starts the game from their phone.` : 'Waiting for the first phone to join. Players join at play.0801564.xyz.'}</p>
          {p.children}
        </>}
        right={<PlayerList members={snap.members} meId={me.id} max={p.maxPlayers} extra={p.playerExtra} tv />}
      />
    );
  }

  return (
    <div className="page setup">
      <LobbyHeader onLeave={p.onLeave} />

      <CodePanel code={snap.code} joinUrl={p.joinUrl} showQr={!hasHost} qrSize={160} />

      {p.devices ? <DeviceGrid>{p.devices}</DeviceGrid> : null}
      {!hasHost ? (
        <section className="panel">
          <p className="muted">This room was opened on a host display, so nobody is running it yet.</p>
          <button className="btn primary big" onClick={() => send({ type: 'claimHost' })}>Take control: be the host</button>
        </section>
      ) : null}

      <PlayerList
        members={snap.members} meId={me.id} max={p.maxPlayers} extra={p.playerExtra}
        hostControls={host ? { canKick: true, onKick: (id) => send({ type: 'kick', id }), onMakeHost: (id) => send({ type: 'makeHost', id }) } : undefined}
      />
      {host && p.bots ? (
        <div className="row">
          <button className="btn small" disabled={players.length >= p.maxPlayers} onClick={() => send({ type: 'bot', op: 'add' })}>Add a bot</button>
          <button className="btn small" disabled={botCount === 0} onClick={() => send({ type: 'bot', op: 'remove' })}>Remove a bot</button>
        </div>
      ) : null}

      {me.role === 'player' ? (
        <ProfileEditor collapsible={p.profileCollapsed ?? true} me={me} members={snap.members} colors={PLAYER_COLORS} lookCount={p.avatarLooks ?? LOOK_COUNT} onProfile={(patch) => send({ type: 'profile', ...patch })}>
          {p.profileExtra}
        </ProfileEditor>
      ) : null}

      {p.children}

      {host ? <MusicWhere snap={snap} send={send} /> : null}
      <SettingsForm sections={p.sections} settings={snap.settings} disabled={!host} onChange={(patch) => send({ type: 'settings', settings: patch })} />
      {!host ? <p className="muted">Only the host can change the game settings.</p> : null}
      {p.error ? <p className="err" role="alert">{p.error}</p> : null}
      <StickyBar>
        {host ? (
          <>
            {reason ? <p className="muted" data-testid="start-reason">{reason}</p> : null}
            <button className="btn accent big" disabled={!!reason} onClick={() => send({ type: 'start' })}>{p.startLabel ?? 'Start game'}</button>
          </>
        ) : <p className="muted center-text">Waiting for the host to start…</p>}
      </StickyBar>
    </div>
  );
}
