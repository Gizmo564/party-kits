// LUCKY DRAW: the starter game. Replace the rules, keep the shape.
//
//   Each round a prize (1-5 points) is turned face up. Everyone secretly plays one card from their hand at the same time.
//   The HIGHEST card that nobody else played wins the prize. Matching cards cancel each other out.
//   After the last round the most points wins.
//
// What it shows (each is a thing most games need):
//   hidden hands          view() only ever sends a player their own cards
//   simultaneous play     everyone acts at once; the round resolves when the last pick lands
//   timers                a pick deadline (auto-plays your lowest card) and a short reveal pause
//   seeded randomness     the deck is shuffled once from `seed`; the same seed replays the same game
//   bots + away players   botAct / awayAct (the bots-away plugin supplies the timing)
//   settings + profile    cleanSettings / cleanProfile (the lobby form and the emoji picker use them)
//   Nap Guard             shiftTime moves every stored deadline when the server was frozen
import { Rng, bad, clampInt, forkRng, good, type Result, type Step } from '@game/engine';

// ---------- types ----------
export interface LuckySettings { rounds: number; pickSeconds: number; revealSeconds: number }
export type Phase = 'pick' | 'reveal' | 'over';

export interface LuckyState {
  phase: Phase;
  round: number;                          // 0-based index of the round being played
  rounds: number;
  seats: string[];                        // seat ids in table order
  prizes: number[];                       // SECRET beyond the current round
  hands: Record<string, number[]>;        // SECRET: each player's cards
  picks: Record<string, number | null>;   // SECRET until the reveal: this round's chosen card
  scores: Record<string, number>;
  endsAt: number | null;                  // when the current phase ends by itself
  pickMs: number;
  revealMs: number;
  last: Reveal | null;                    // the most recent reveal (public once it has happened)
}
export interface Reveal { round: number; prize: number; plays: { id: string; card: number; cancelled: boolean }[]; winner: string | null }

export type LuckyAction = { type: 'pick'; card: number };
export type LuckyEvent =
  | { kind: 'pick'; id: string }                         // someone locked in (the card stays secret)
  | { kind: 'reveal'; reveal: Reveal }
  | { kind: 'round'; round: number }
  | { kind: 'over'; winners: string[] };

export interface LuckyView {
  phase: Phase;
  round: number; rounds: number;
  prize: number | null;                   // this round's prize; future prizes are never sent
  hand: number[] | null;                  // your own cards (null for a spectator or TV)
  myPick: number | null;
  locked: Record<string, boolean>;        // who has played, without saying what
  cardsLeft: Record<string, number>;
  scores: Record<string, number>;
  endsAt: number | null;
  last: Reveal | null;
}

export const LIMITS = { rounds: [3, 5], pickSeconds: [8, 60], revealSeconds: [2, 8] } as const;
export const DECK_SIZE = 30;              // 6 players x 5 cards
export const EMOJIS = ['🎲', '🃏', '🍀', '🦊', '🐙', '🌵', '🚀', '🍕'] as const;
export const CARD_SORT = (a: number, b: number) => a - b;

export const defaultSettings = (): LuckySettings => ({ rounds: 5, pickSeconds: 20, revealSeconds: 4 });

export function cleanSettings(patch: unknown, cur: LuckySettings): LuckySettings | string {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return 'bad settings';
  const p = patch as Partial<LuckySettings>;
  return {
    rounds: clampInt(p.rounds, LIMITS.rounds[0], LIMITS.rounds[1], cur.rounds),
    pickSeconds: clampInt(p.pickSeconds, LIMITS.pickSeconds[0], LIMITS.pickSeconds[1], cur.pickSeconds),
    revealSeconds: clampInt(p.revealSeconds, LIMITS.revealSeconds[0], LIMITS.revealSeconds[1], cur.revealSeconds),
  };
}

/** Profile: one emoji badge per player, from a fixed list. */
export function cleanProfile(cur: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> | string {
  if (patch.emoji === undefined) return { ...cur };
  if (typeof patch.emoji !== 'string' || !(EMOJIS as readonly string[]).includes(patch.emoji)) return 'pick one of the offered emoji';
  return { ...cur, emoji: patch.emoji };
}

// ---------- the rules ----------
export function start(input: { seats: { id: string }[]; settings: LuckySettings; seed: number; now: number }): Result<LuckyState> {
  const { seats, settings, seed, now } = input;
  if (seats.length < 2) return bad('Lucky Draw needs at least 2 players');
  if (seats.length * settings.rounds > DECK_SIZE) return bad('too many players for that many rounds');
  const rng = new Rng(seed);
  const deck = rng.shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i + 1));
  const hands: Record<string, number[]> = {};
  const picks: Record<string, number | null> = {};
  const scores: Record<string, number> = {};
  seats.forEach((s, i) => {
    hands[s.id] = deck.slice(i * settings.rounds, (i + 1) * settings.rounds).sort(CARD_SORT);
    picks[s.id] = null;
    scores[s.id] = 0;
  });
  const prizes = Array.from({ length: settings.rounds }, () => rng.between(1, 5));
  return good({
    phase: 'pick', round: 0, rounds: settings.rounds, seats: seats.map((s) => s.id), prizes, hands, picks, scores,
    endsAt: now + settings.pickSeconds * 1000, pickMs: settings.pickSeconds * 1000, revealMs: settings.revealSeconds * 1000, last: null,
  });
}

/** Highest card nobody else played wins the prize. Pure: the same plays always give the same reveal. */
export function resolveRound(prize: number, round: number, plays: { id: string; card: number }[]): Reveal {
  const count = new Map<number, number>();
  for (const p of plays) count.set(p.card, (count.get(p.card) ?? 0) + 1);
  const marked = plays.map((p) => ({ ...p, cancelled: (count.get(p.card) ?? 0) > 1 }));
  const live = marked.filter((p) => !p.cancelled).sort((a, b) => b.card - a.card);
  return { round, prize, plays: marked, winner: live.length ? live[0].id : null };
}

function reveal(s: LuckyState, now: number, events: LuckyEvent[]): LuckyState {
  const plays = s.seats.map((id) => ({ id, card: s.picks[id]! }));
  const r = resolveRound(s.prizes[s.round], s.round, plays);
  const scores = { ...s.scores };
  if (r.winner) scores[r.winner] += r.prize;
  events.push({ kind: 'reveal', reveal: r });
  return { ...s, phase: 'reveal', scores, last: r, endsAt: now + s.revealMs };
}

export function act(s: LuckyState, seat: string, a: LuckyAction, ctx: { now: number; seed: number }): Result<Step<LuckyState, LuckyEvent>> {
  if (!a || a.type !== 'pick') return bad('unknown action');
  if (s.phase !== 'pick') return bad('wait for the next round');
  if (!(seat in s.hands)) return bad('you are not in this game');
  if (s.picks[seat] !== null) return bad('you already played a card this round');
  if (!s.hands[seat].includes(a.card)) return bad('that card is not in your hand');
  const events: LuckyEvent[] = [{ kind: 'pick', id: seat }];
  let next: LuckyState = {
    ...s,
    picks: { ...s.picks, [seat]: a.card },
    hands: { ...s.hands, [seat]: s.hands[seat].filter((c) => c !== a.card) },
  };
  if (next.seats.every((id) => next.picks[id] !== null)) next = reveal(next, ctx.now, events);
  return good({ state: next, events });
}

/** The clock ran out: pick phase plays everyone's lowest card for them; reveal phase moves on. */
export function tick(s: LuckyState, now: number): Step<LuckyState, LuckyEvent> | null {
  if (s.phase === 'over' || s.endsAt === null || now < s.endsAt) return null;
  const events: LuckyEvent[] = [];
  if (s.phase === 'pick') {
    let next = s;
    for (const id of s.seats) {
      if (next.picks[id] !== null) continue;
      const card = Math.min(...next.hands[id]);
      next = { ...next, picks: { ...next.picks, [id]: card }, hands: { ...next.hands, [id]: next.hands[id].filter((c) => c !== card) } };
      events.push({ kind: 'pick', id });
    }
    return { state: reveal(next, now, events), events };
  }
  // reveal over: next round or the end
  if (s.round + 1 >= s.rounds) {
    const top = Math.max(...Object.values(s.scores));
    events.push({ kind: 'over', winners: s.seats.filter((id) => s.scores[id] === top) });
    return { state: { ...s, phase: 'over', endsAt: null }, events };
  }
  const picks: Record<string, number | null> = {};
  for (const id of s.seats) picks[id] = null;
  events.push({ kind: 'round', round: s.round + 1 });
  return { state: { ...s, phase: 'pick', round: s.round + 1, picks, endsAt: now + s.pickMs }, events };
}

export const isOver = (s: LuckyState) => s.phase === 'over';
export const deadline = (s: LuckyState) => (s.phase === 'over' ? null : s.endsAt);
export const shiftTime = (s: LuckyState, ms: number): LuckyState => (s.endsAt === null ? s : { ...s, endsAt: s.endsAt + ms });

/** What this viewer may see. A TV or spectator (`viewer === null`) gets no hand. Nobody sees another hand, a pending pick, or a future prize. */
export function view(s: LuckyState, viewer: string | null): LuckyView {
  const mine = viewer !== null && s.hands[viewer] ? viewer : null;
  const locked: Record<string, boolean> = {};
  const cardsLeft: Record<string, number> = {};
  for (const id of s.seats) { locked[id] = s.picks[id] !== null; cardsLeft[id] = s.hands[id].length; }
  return {
    phase: s.phase, round: s.round, rounds: s.rounds,
    prize: s.phase === 'over' ? null : s.prizes[s.round],
    hand: mine ? s.hands[mine] : null,
    myPick: mine && s.phase === 'pick' ? s.picks[mine] : null,
    locked, cardsLeft, scores: s.scores, endsAt: s.endsAt, last: s.last,
  };
}

// ---------- bots and away players ----------
/** A bot plays a random card from its hand. forkRng makes the choice depend on (seed, round, seat) only, so it replays the same. */
export function botAct(s: LuckyState, seat: string, ctx: { seed: number }): LuckyAction | null {
  if (s.phase !== 'pick' || s.picks[seat] !== null || !s.hands[seat]?.length) return null;
  const rng = forkRng(ctx.seed, s.round, s.seats.indexOf(seat) + 1);
  return { type: 'pick', card: rng.pick(s.hands[seat]) };
}
/** A player who left plays their lowest card: never wins big, never stalls the table. */
export function awayAct(s: LuckyState, seat: string): LuckyAction | null {
  if (s.phase !== 'pick' || s.picks[seat] !== null || !s.hands[seat]?.length) return null;
  return { type: 'pick', card: Math.min(...s.hands[seat]) };
}
