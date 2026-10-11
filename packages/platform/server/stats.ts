// Anonymous usage counts for the admin panel on 0801564.xyz (Traffic / Games tabs).
// Fire-and-forget: it never blocks a game and any failure is ignored. No player names, codes or IDs are sent, only
// "a game started". Only Sandwich Slam and Tank Tactics send these; Track Record and Chameleon do not (FLAGS.md A1, A2).
//
// The landing Worker only accepts sites it knows (landing/src/stats-core.js SITES): a new game must be added there.
export type StatsType = 'game_created' | 'player_joined' | 'round_finished';
export interface StatsEnv { STATS_URL?: string; NAP_URL?: string }

/** Off unless STATS_URL is set (production sets it in wrangler.jsonc). Local test runs must never count as real games. */
export function statsUrl(env: StatsEnv): string | null {
  if (!env.STATS_URL) return null;
  if (env.NAP_URL && /^https?:\/\/(127\.|localhost|\[::1\])/.test(env.NAP_URL) && /^https:\/\/0801564\.xyz/.test(env.STATS_URL)) return null;
  return env.STATS_URL;
}

export function reportEvent(env: StatsEnv, waitUntil: (p: Promise<unknown>) => void, site: string, type: StatsType, extra: { n?: number; peak?: number } = {}): void {
  try {
    const url = statsUrl(env);
    if (!url) return;
    waitUntil(fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ site, type, ...extra }) }).then((r) => r.arrayBuffer()).catch(() => undefined));
  } catch { /* analytics must never break a game */ }
}

/** Bind the site once: `const report = reporter(env, ctx.waitUntil.bind(ctx), 'my-site')`. */
export const reporter = (env: StatsEnv, waitUntil: (p: Promise<unknown>) => void, site: string) =>
  (type: StatsType, extra?: { n?: number; peak?: number }) => reportEvent(env, waitUntil, site, type, extra);

/** True when a stage change means a round or game just ended (so `round_finished` is counted once). */
export const justFinished = (before: string, after: string, endStages: readonly string[] = ['roundEnd', 'gameEnd']): boolean =>
  endStages.includes(after) && !endStages.includes(before);
