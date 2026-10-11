// Receiver-side logic for cast.0801564.xyz. The receiver only ever opens a game that is `live` in the shared manifest and only
// with a valid join code, so a message from some other page cannot make the TV open an arbitrary address.
import { joinUrl, validate, type Manifest } from '@gizmo564/join-codes/engine/join-codes';
import type { CastReply } from './sender';
export * from './sender';

/** Receiver side: turn a load message into the display page to show, or say why not. */
export function resolveLoad(m: Manifest, msg: unknown): { ok: true; url: string } | { ok: false; message: string } {
  if (!msg || typeof msg !== 'object') return { ok: false, message: 'Unreadable message' };
  const { type, game, code } = msg as { type?: unknown; game?: unknown; code?: unknown };
  if (type !== 'load' || typeof game !== 'string' || typeof code !== 'string') return { ok: false, message: 'Unreadable message' };
  const r = validate(m, code);
  if (!r.ok) return { ok: false, message: 'That game code is not valid' };
  if (r.game.id !== game) return { ok: false, message: 'That code belongs to a different game' };
  if (r.game.status !== 'live') return { ok: false, message: 'That game is not open yet' };
  if (r.game.roles && !r.game.roles.includes('display')) return { ok: false, message: 'That game has no TV display' };
  const u = new URL(joinUrl(r.game, r.code, { role: 'display' }));
  u.searchParams.set('cast', '1');
  return { ok: true, url: u.toString() };
}

