// The wire protocol every party game shares. A game adds its own `act` payload and `settings` shape through the type
// parameters; everything else (hello, rejoin, host, spectators, screens, nap, closed) is the same in every game.

export type Role = 'player' | 'spectator';

export interface MemberInfo {
  id: string; name: string; color: string; avatar: number; role: Role; connected: boolean; host: boolean;
  /** a TV / shared screen: shows the game, never takes a turn */
  screen?: boolean;
  /** the Google Cast receiver on a TV: it outranks any other screen for playing the music */
  cast?: boolean;
  /** this device plays the music/sound for the room (exactly one at a time) */
  music?: boolean;
  /** added by the bots-away plugin */
  bot?: boolean;
  away?: boolean;
  /** game-specific profile fields (team, role choice...) validated by GameLogic.cleanProfile */
  data?: Record<string, unknown>;
}

/** client -> server */
export type ClientMsg<Action = unknown, Settings = unknown> =
  | { type: 'hello'; name?: string; token?: string; spectate?: boolean; screen?: boolean; music?: boolean; cast?: boolean }
  | { type: 'claimHost' }
  /** the sender is walking away: if they host, the next connected player in join order takes over */
  | { type: 'leave' }
  | { type: 'settings'; settings: Partial<Settings> }
  | { type: 'profile'; name?: string; color?: string; avatar?: number; data?: Record<string, unknown> }
  | { type: 'start' }
  /** after a finished game: the host sends everyone back to the lobby, same room and players */
  | { type: 'again' }
  | { type: 'act'; action: Action }
  | { type: 'music'; on: boolean }
  /** host controls (lobby only for kick) */
  | { type: 'kick'; id: string }
  | { type: 'makeHost'; id: string }
  /** bots-away plugin */
  | { type: 'bot'; op: 'add' | 'remove'; id?: string; level?: string }
  | { type: 'ping' };

export interface Snapshot<Settings = unknown, View = unknown> {
  type: 'state';
  /** bump when the shape changes so an old cached client can tell */
  v: 1;
  code: string;
  you: { id: string; token: string; role: Role; host: boolean; screen: boolean; music: boolean };
  members: MemberInfo[];
  settings: Settings;
  started: boolean;
  over: boolean;
  /** this viewer's masked view of the game; null in the lobby */
  view: View | null;
  /** events from the most recent step, with a counter so clients can tell batches apart */
  events: unknown[];
  eventSeq: number;
  /** epoch ms when the room will act by itself next (timer), or null */
  deadline: number | null;
  /** per-plugin public data (e.g. the bots-away plugin's grace period) */
  plugins: Record<string, unknown>;
}

export type ServerMsg<Settings = unknown, View = unknown> =
  | Snapshot<Settings, View>
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'nap'; resetAt: number }
  | { type: 'closed'; reason: 'idle' | 'admin' | 'kicked' };
