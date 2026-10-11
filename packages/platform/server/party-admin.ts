/// <reference types="@cloudflare/workers-types" />
// Party-game admin for one game's Worker (identical in Track Record, Sandwich Slam and Chameleon; this is the shared copy): a registry of open rooms (so "end all" knows which exist) and two
// signed endpoints the landing admin panel calls:
//   GET  /api/admin/open       -> { open: n }
//   POST /api/admin/close-all  -> { found: n, closed: n }
// A call must carry x-admin-ts (ms) and x-admin-sig = base64url(HMAC-SHA256(key = ADMIN_KEY + '|svc', `${ts}.${path}`)),
// which is exactly what the landing Worker's signService() makes. Without ADMIN_KEY set, every call is refused.
const enc = new TextEncoder();
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const SKEW_MS = 5 * 60_000;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export interface AdminEnv { INDEX: DurableObjectNamespace; ADMIN_KEY?: string }

/** What the landing Worker's signService() computes. Used by tests, and handy for a script that calls the endpoints by hand. */
export async function signCall(secret: string, ts: number | string, path: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret + '|svc'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${path}`)));
  let bin = ''; for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function verifyCall(secret: string | undefined, ts: string | null, path: string, sig: string | null, now = Date.now()): Promise<boolean> {
  const t = Number(ts);
  if (!secret || !sig || !ts || !Number.isFinite(t) || Math.abs(now - t) > SKEW_MS) return false;
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret + '|svc'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, unb64u(sig), enc.encode(`${t}.${path}`));
  } catch { return false; }
}

/** One instance per game (named "all"): the set of room codes that are open right now. */
export class IndexDO implements DurableObject {
  constructor(private ctx: DurableObjectState) {}
  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url);
    const code = (u.searchParams.get('code') ?? '').toUpperCase();
    if (u.pathname === '/add' && /^[A-Z]{4}$/.test(code)) { await this.ctx.storage.put('c:' + code, Date.now()); return json({ ok: true }); }
    if (u.pathname === '/remove' && /^[A-Z]{4}$/.test(code)) { await this.ctx.storage.delete('c:' + code); return json({ ok: true }); }
    if (u.pathname === '/list') { const m = await this.ctx.storage.list({ prefix: 'c:' }); return json({ codes: [...m.keys()].map((k) => k.slice(2)) }); }
    return json({ error: 'not found' }, 404);
  }
}

const idx = (env: AdminEnv) => env.INDEX.get(env.INDEX.idFromName('all'));
/** Never throws: the registry must not be able to break a game. */
export const indexAdd = async (env: AdminEnv, code: string): Promise<void> => { try { await idx(env).fetch(`https://index/add?code=${code}`, { method: 'POST' }); } catch { /* registry only */ } };
export const indexRemove = async (env: AdminEnv, code: string): Promise<void> => { try { await idx(env).fetch(`https://index/remove?code=${code}`, { method: 'POST' }); } catch { /* registry only */ } };

/** Returns a Response for the two admin paths, or null for any other request. `closeRoom` ends one room by code. */
export async function handleAdmin(req: Request, env: AdminEnv, closeRoom: (code: string) => Promise<unknown>): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== '/api/admin/open' && url.pathname !== '/api/admin/close-all') return null;
  if (!(await verifyCall(env.ADMIN_KEY, req.headers.get('x-admin-ts'), url.pathname, req.headers.get('x-admin-sig')))) return json({ error: 'forbidden' }, 403);
  const want = url.pathname === '/api/admin/open' ? 'GET' : 'POST';
  if (req.method !== want) return json({ error: 'method not allowed' }, 405);
  let codes: string[] = [];
  try { codes = ((await (await idx(env).fetch('https://index/list')).json()) as { codes: string[] }).codes; } catch { return json({ error: 'registry unavailable' }, 503); }
  if (want === 'GET') return json({ open: codes.length });
  const done = await Promise.allSettled(codes.map((c) => closeRoom(c)));
  await Promise.allSettled(codes.map((c) => indexRemove(env, c)));
  return json({ found: codes.length, closed: done.filter((d) => d.status === 'fulfilled').length });
}
