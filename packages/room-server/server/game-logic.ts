// What a game gives the room. The room (base-room.ts) owns everything generic; the game is just this object.
// Every function must be PURE: same inputs, same outputs, state is plain JSON (it is stored in the Durable Object).
import type { Result, Step } from '@gizmo564/engine-core/engine';

export interface Seat {
  id: string; name: string; color: string; avatar: number;
  /** the member's game-specific profile fields (see cleanProfile) */
  data: Record<string, unknown>;
  bot: boolean;
}

export interface ActContext {
  now: number; seed: number;
  /** the seat id of the current host (null if nobody hosts), for actions only the host may take: skip, next round, abandon */
  hostId: string | null;
}

export interface GameLogic<Settings, State, Action, View, Ev = unknown> {
  /** short id, also the stats site name: 'my-game' */
  id: string;
  minPlayers: number;
  maxPlayers: number;
  /** how many avatar looks the web app has (0 = no avatars) */
  avatarLooks: number;

  defaultSettings(): Settings;
  /** Merge a host's patch into the current settings. Clamp numbers and drop unknown keys; return an error string for nonsense. */
  cleanSettings(patch: unknown, current: Settings, players: number): Settings | string;
  /** Optional: validate/merge a player's own profile fields (team, role...). Return the new data or an error string. */
  cleanProfile?(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> | string;

  /** Build the game. `seed` is stored; use it for every shuffle so the game can be replayed. */
  start(input: { seats: Seat[]; settings: Settings; seed: number; now: number }): Result<State>;
  /** One player action. Return the new state (do not mutate the old one) and the events that explain it. */
  act(state: State, seatId: string, action: Action, ctx: ActContext): Result<Step<State, Ev>>;
  /** What THIS viewer may see. `null` viewer = spectator / screen. Never include another player's secrets. */
  view(state: State, viewer: string | null): View;
  isOver(state: State): boolean;
  /** true = the host may send `again` in the middle of a game to abandon it and return everyone to the lobby (no game-over screen, no finished-round count) */
  abandonable?: boolean;

  /** Epoch ms of the next thing that happens without a player acting (a timer), or null. */
  deadline?(state: State): number | null;
  /** Called when the deadline passes. Return the next step, or null if nothing changed. */
  tick?(state: State, now: number, seed: number): Step<State, Ev> | null;
  /** Optional: push every stored timestamp in the state forward by `ms` (the Nap Guard froze the room; it must not lose time). */
  shiftTime?(state: State, ms: number): State;
  /** Optional: a bot's move for a seat (used by the bots-away plugin). Return null if the seat has nothing to do now. */
  botAct?(state: State, seatId: string, ctx: ActContext): Action | null;
  /** Optional: should this seat be skipped right now because it is away? Return an action to play for them (e.g. pass). */
  awayAct?(state: State, seatId: string, ctx: ActContext): Action | null;
}
