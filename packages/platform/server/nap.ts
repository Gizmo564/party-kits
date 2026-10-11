// Nap Guard client: asks the shared guard (the landing Worker) whether the games may run.
//   open -> normal;  no-new -> no new rooms;  asleep -> everything paused until resetAt.
// Fail-open: if the guard cannot be reached, the games keep running.
//
// This is the newest of the three copies (Track Record, Sandwich Slam, Chameleon are byte-identical; Tank Tactics has an
// older one without stale-while-revalidate or a timeout). Needs compatibility flag `global_fetch_strictly_public`
// so a Worker can call the landing Worker on the same zone.
export type NapLevel = 'open' | 'no-new' | 'asleep';
export interface Nap { level: NapLevel; percent: number; resetAt: number; source?: 'guard' | 'failopen'; err?: string }

export const DEFAULT_NAP_URL = 'https://0801564.xyz/api/nap';
const LOCAL_TTL = 30_000; // per Worker isolate
let cache: { at: number; nap: Nap } | null = null;

async function fetchNap(env: { NAP_URL?: string }, now: number): Promise<Nap> {
  let nap: Nap = { level: 'open', percent: 0, resetAt: 0, source: 'failopen' };
  try {
    // the edge caches this for 60 s, so most calls never reach the guard Worker at all; never wait more than 2.5 s
    const res = await fetch(env.NAP_URL || DEFAULT_NAP_URL, { cf: { cacheTtl: 60, cacheEverything: true }, signal: AbortSignal.timeout(2500) } as RequestInit);
    if (res.ok) {
      const j = await res.json() as Partial<Nap>;
      if (j.level === 'open' || j.level === 'no-new' || j.level === 'asleep') nap = { level: j.level, percent: Number(j.percent) || 0, resetAt: Number(j.resetAt) || 0, source: 'guard' };
      else nap.err = 'guard answered with an unexpected level';
    } else nap.err = `guard answered ${res.status}`;
  } catch (e) { nap.err = String((e as Error)?.message || e).slice(0, 120); /* fail open */ }
  cache = { at: now, nap };
  return nap;
}

let inflight: Promise<Nap> | null = null;

/**
 * Stale-while-revalidate: once there is an answer, a game message never waits for the guard. An old answer is
 * returned at once and refreshed in the background (pass `wait`, e.g. ctx.waitUntil). Only the very first call waits.
 */
export async function getNap(env: { NAP_URL?: string; NAP_TTL_MS?: string }, now = Date.now(), wait?: (p: Promise<unknown>) => void): Promise<Nap> {
  const ttl = env.NAP_TTL_MS ? Number(env.NAP_TTL_MS) : LOCAL_TTL; // tests shorten this
  if (cache && now - cache.at < ttl) return cache.nap;
  const p = (inflight ??= fetchNap(env, now).finally(() => { inflight = null; }));
  if (cache && wait) { wait(p); return cache.nap; }
  return p;
}

/** For tests only. */
export const _resetNapCache = () => { cache = null; inflight = null; };

/** The sentence a player sees. Games differ today (Tank has its own wording); this is the shared one. */
export const napMessage = (nap: Pick<Nap, 'level'>): string => nap.level === 'asleep'
  ? 'The games are napping: the free daily server limit is nearly used up. Your game is paused and safe; it picks up after the daily reset.'
  : 'Busy day: new games are paused until the daily reset. Games already running are fine.';
