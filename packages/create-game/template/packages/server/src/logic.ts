// Wires the engine's plain functions into the shape the room expects (GameLogic). No rules live here.
import type { GameLogic } from '@gizmo564/room-server/server';
import {
  act, awayAct, botAct, cleanProfile, cleanSettings, deadline, defaultSettings, isOver, shiftTime, start, tick, view, DECK_SIZE, LIMITS,
  type LuckyAction, type LuckyEvent, type LuckySettings, type LuckyState, type LuckyView,
} from '@game/engine';

export const luckyLogic: GameLogic<LuckySettings, LuckyState, LuckyAction, LuckyView, LuckyEvent> = {
  id: '__SLUG__',
  minPlayers: 2,
  maxPlayers: Math.floor(DECK_SIZE / LIMITS.rounds[1]),   // 6: the deck must cover every hand at the most rounds
  avatarLooks: 21,                                         // LOOK_COUNT in kit/lobby-ui
  defaultSettings,
  cleanSettings,
  cleanProfile,
  start: ({ seats, settings, seed, now }) => start({ seats, settings, seed, now }),
  act: (s, seat, a, ctx) => act(s, seat, a, ctx),
  view,
  isOver,
  deadline,
  tick: (s, now) => tick(s, now),
  shiftTime,
  botAct: (s, seat, ctx) => botAct(s, seat, ctx),
  awayAct: (s, seat) => awayAct(s, seat),
};
