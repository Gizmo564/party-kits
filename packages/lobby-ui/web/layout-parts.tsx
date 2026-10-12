import type { ReactNode } from 'react';

/**
 * The shared lobby arrangement, the same in every game (each game keeps its own colors and fonts):
 *  - phone: LobbyHeader (Leave left, "Lobby" centered), the code panel, DeviceGrid (all the TV / sound / jukebox buttons), players, You, settings, StickyBar
 *  - TV: TvLobbyFrame (slim top bar of buttons, code + QR pinned top left, players on the right; no Leave and nothing to tap)
 * They only use these tokens (with fallbacks): --ink, --ink-soft, --font-display.
 */

/** Phone header: Leave on the left, the title centered. Same in every game. */
export function LobbyHeader({ onLeave, title = 'Lobby' }: { onLeave: () => void; title?: string }) {
  return (
    <div className="lobbyhead" data-testid="lobby-header">
      <button type="button" className="btn small" onClick={onLeave}>Leave</button>
      <h1 className="h-lg">{title}</h1>
      <span />
    </div>
  );
}

/**
 * The phone's button block: equal-width buttons in two columns, a lone last button spanning the full row.
 * Put Sound, Jukebox, Show on TV, Show on wired TV, Open on another device in it (a game leaves out what it does not have).
 */
export function DeviceGrid({ children }: { children: ReactNode }) {
  return <div className="devgrid" data-testid="devices">{children}</div>;
}

/** The TV lobby: a slim top bar (title left, buttons right), then the code + QR on the left and the players on the right. No Leave on a TV. */
export function TvLobbyFrame({ title = 'Lobby', buttons, left, right }: { title?: string; buttons?: ReactNode; left: ReactNode; right: ReactNode }) {
  return (
    <div className="page tvl" data-testid="tv-lobby">
      <div className="tvl-top" data-testid="tv-top">
        <h1 className="h-lg">{title}</h1>
        <div className="tvl-btns">{buttons}</div>
      </div>
      <div className="tvl-body">
        <div className="tvl-left">{left}</div>
        <div className="tvl-right">{right}</div>
      </div>
    </div>
  );
}
