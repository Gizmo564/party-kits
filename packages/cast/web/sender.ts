// Sender side of Google Cast for every 0801564.xyz party game (runs in the host's Chrome). Copied into each game's web app.
export const CAST_NAMESPACE = 'urn:x-cast:xyz.0801564.party';
/** Set after registering the Custom Receiver in the Google Cast console. Empty = the Cast button stays hidden. */
export const CAST_APP_ID = '91D719E7';

export type CastMsg = { type: 'load'; game: string; code: string } | { type: 'stop' };
export type CastReply = { type: 'loaded'; game: string; code: string } | { type: 'error'; message: string };


// ---------- sender ----------
export type CastState = 'loading' | 'unsupported' | 'no-devices' | 'ready' | 'connecting' | 'casting' | 'failed';
export interface CasterView { state: CastState; device: string }

interface Framework {
  CastContext: { getInstance(): CastContext };
  CastContextEventType: { CAST_STATE_CHANGED: string; SESSION_STATE_CHANGED: string };
  SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string; SESSION_ENDED: string };
}
interface CastContext {
  setOptions(o: unknown): void;
  addEventListener(t: string, f: (e: { castState?: string; sessionState?: string }) => void): void;
  getCastState(): string;
  requestSession(): Promise<unknown>;
  getCurrentSession(): null | { sendMessage(ns: string, m: unknown): Promise<unknown>; getCastDevice(): { friendlyName?: string } };
  endCurrentSession(stop: boolean): void;
}
interface Env { cast?: { framework: Framework }; chrome?: { cast?: { AutoJoinPolicy: { ORIGIN_SCOPED: string } } } }

export function sdkUrl() { return 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'; }

/** Loads Google's sender script once. Resolves false where Cast cannot work (Safari, iPhone, blocked). */
export function loadSdk(win: Window & Env & { __onGCastApiAvailable?: (ok: boolean) => void } = window as never): Promise<boolean> {
  if (win.cast?.framework) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };
    win.__onGCastApiAvailable = (ok) => finish(ok && !!win.cast?.framework);
    const s = win.document.createElement('script');
    s.src = sdkUrl();
    s.async = true;
    s.onerror = () => finish(false);
    win.document.head.appendChild(s);
    setTimeout(() => finish(false), 8000);
  });
}

export interface Caster {
  view(): CasterView;
  subscribe(f: (v: CasterView) => void): () => void;
  start(): Promise<void>;
  stop(): void;
  /** call whenever the room code could have changed */
  sync(): void;
}

export function createCaster(opts: { appId: string; game: string; getCode: () => string | null; win?: Window & Env }): Caster {
  const win = opts.win ?? (window as unknown as Window & Env);
  let v: CasterView = { state: opts.appId ? 'loading' : 'unsupported', device: '' };
  let ctx: CastContext | null = null;
  const subs = new Set<(v: CasterView) => void>();
  const set = (n: CasterView) => { if (n.state !== v.state || n.device !== v.device) { v = n; subs.forEach((f) => f(v)); } };

  const fromContext = () => {
    if (!ctx || !win.cast) return;
    const raw = ctx.getCastState();
    const sess = ctx.getCurrentSession();
    if (v.state === 'failed' && raw !== 'CONNECTED') return; // keep the failure message until the next try or a real connection
    const state: CastState = raw === 'CONNECTED' ? 'casting' : raw === 'CONNECTING' ? 'connecting' : raw === 'NO_DEVICES_AVAILABLE' ? 'no-devices' : 'ready';
    set({ state, device: state === 'casting' ? sess?.getCastDevice().friendlyName ?? '' : '' });
  };
  const send = () => {
    const code = opts.getCode();
    const s = ctx?.getCurrentSession();
    if (!s || !code) return;
    s.sendMessage(CAST_NAMESPACE, { type: 'load', game: opts.game, code } satisfies CastMsg).catch(() => undefined);
  };

  if (opts.appId) {
    loadSdk(win as never).then((ok) => {
      if (!ok || !win.cast?.framework || !win.chrome?.cast) { set({ state: 'unsupported', device: '' }); return; }
      const fw = win.cast.framework;
      ctx = fw.CastContext.getInstance();
      ctx.setOptions({ receiverApplicationId: opts.appId, autoJoinPolicy: win.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
      ctx.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, () => fromContext());
      ctx.addEventListener(fw.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
        if (e.sessionState === fw.SessionState.SESSION_STARTED || e.sessionState === fw.SessionState.SESSION_RESUMED) send();
        fromContext();
      });
      fromContext();
    });
  }
  return {
    view: () => v,
    subscribe(f) { subs.add(f); return () => { subs.delete(f); }; },
    async start() {
      if (!ctx) return;
      if (v.state === 'failed') set({ state: 'ready', device: '' });
      try { await ctx.requestSession(); } catch (e) {
        // Cast rejects with a string code; 'cancel' = the person closed the picker (not a failure). Any other code (no receiver, timeout, session error)
        // is a failed cast, so the game can show the fallback. The exact codes were not verified on a real TV.
        if (String(e) !== 'cancel') set({ state: 'failed', device: '' });
      }
    },
    stop() { ctx?.endCurrentSession(true); },
    sync: send,
  };
}

/** One caster per page (the Cast context is a singleton); the current room code is handed in separately. */
let shared: { game: string; caster: Caster; code: string | null } | null = null;
export function getCaster(game: string, appId = CAST_APP_ID): { caster: Caster; setCode: (c: string | null) => void } {
  if (!shared || shared.game !== game) {
    const h: { game: string; caster: Caster; code: string | null } = { game, code: null, caster: null as never };
    h.caster = createCaster({ appId, game, getCode: () => h.code });
    shared = h;
  }
  const h = shared;
  return { caster: h.caster, setCode: (c) => { if (h.code !== c) { h.code = c; if (c) h.caster.sync(); } } };
}
