// One audio system for every game (replaces three different ones: Track Record's synth + scenes, Sandwich Slam's
// glob-loaded files, Chameleon's host-only tracks with stings).
//
//   const audio = createAudio({ game: 'my-game', tracks: { lobby: {}, play: { volume: 0.2 } } });
//   audio.unlock();            // from any tap (also installed automatically on the first pointerdown or key press)
//   audio.music('lobby');      // loops /sounds/lobby.mp3 (a missing file is silently skipped)
//   audio.sfx('good');         // built-in synth beep, or /sounds/good.mp3 if you dropped a recording in
//   audio.oneShot('win', () => audio.music('credits'));   // a sting, then chain
//
// House rules baked in (from the three games):
//   * Nothing plays until the player has tapped the page once (browsers), and every failure is swallowed: sound is optional.
//   * Mute is remembered per game: localStorage `${game}-muted`.
//   * Music is PAUSED, not turned down, when silenced (iOS ignores element volume).
//   * Exactly one device should play music: pass `setOutput(false)` on phones while a TV/host display is the music device
//     (Snapshot.you.music tells you), and effects stay phone-side.
//   * `setDucked(true)` silences everything while a song/voice clip is audible (Track Record's rule).
import { audioCtx, unlockAudioContext } from './ctx';
import { DEFAULT_SFX, type Note } from './recipes';

export interface TrackDef { file?: string; volume?: number }
export interface AudioConfig {
  game: string;
  /** where the files live (default '/sounds/') */
  baseUrl?: string;
  /** a name -> URL map for files a bundler already hashed (Vite's import.meta.glob). Wins over baseUrl for those names, and is trusted to exist. */
  urls?: Record<string, string>;
  /** localStorage key of the mute flag, to keep a game's existing one (default `${game}-muted`) */
  mutedKey?: string;
  /** named looping tracks; file defaults to `${name}.mp3` */
  tracks?: Record<string, TrackDef>;
  /** synth recipes by name; defaults to the shared set */
  sfx?: Record<string, Note[]>;
  /** attach one-time pointerdown / keydown listeners that unlock audio (default true) */
  autoUnlock?: boolean;
  /** also try to unlock right away, with no tap: a TV (the Chromecast receiver allows it) or a phone that arrived by link never gets one. Browsers that refuse just stay silent until the first touch or key. Default false. */
  tryAtStart?: boolean;
}

export interface AudioKit {
  sfx(name: string): void;
  music(name: string | null): void;
  oneShot(name: string, onEnd?: () => void): void;
  stop(): void;
  isMuted(): boolean;
  setMuted(m: boolean): void;
  setOutput(on: boolean): void;
  setDucked(on: boolean): void;
  unlock(): Promise<void>;
  /** called when mute changes (for buttons) */
  subscribe(fn: () => void): () => void;
}

const isAudioType = (t: string | null) => !!t && (t.includes('audio') || t.includes('ogg'));

export function createAudio(cfg: AudioConfig): AudioKit {
  const base = cfg.baseUrl ?? '/sounds/';
  const mutedKey = cfg.mutedKey ?? `${cfg.game}-muted`;
  const urls = cfg.urls ?? {};
  const tracks = cfg.tracks ?? {};
  const recipes = cfg.sfx ?? DEFAULT_SFX;
  let muted = false;
  try { muted = localStorage.getItem(mutedKey) === '1'; } catch { /* storage blocked: fine */ }
  let output = true, ducked = false;
  let want: string | null = null;
  let single: { name: string; el: HTMLAudioElement } | null = null;
  const listeners = new Set<() => void>();

  // ---- elements (lazy, probed once so a missing file or an SPA fallback page never plays) ----
  const els = new Map<string, HTMLAudioElement | null>();
  const loading = new Map<string, Promise<HTMLAudioElement | null>>();
  const fileOf = (name: string) => urls[name] ?? base + (tracks[name]?.file ?? `${name}.mp3`);
  function load(name: string): Promise<HTMLAudioElement | null> {
    if (els.has(name)) return Promise.resolve(els.get(name)!);
    let p = loading.get(name);
    if (!p) {
      p = (async () => {
        try {
          const head = urls[name] ? { ok: true, headers: new Headers({ 'content-type': 'audio/mpeg' }) } : await fetch(fileOf(name), { method: 'HEAD' });
          if (!head.ok || !isAudioType(head.headers.get('content-type'))) { els.set(name, null); return null; }
          const el = new Audio(fileOf(name));
          el.preload = 'auto';
          els.set(name, el);
          return el;
        } catch { els.set(name, null); return null; }
      })().finally(() => loading.delete(name));
      loading.set(name, p);
    }
    return p;
  }

  const audible = () => !muted && output && !ducked;
  function apply() {
    for (const [name, el] of els) {
      if (!el) continue;
      const isWanted = name === want && !single;
      const isSingle = single?.name === name;
      if ((isWanted || isSingle) && audible()) {
        el.volume = tracks[name]?.volume ?? 0.4;
        el.loop = isWanted;
        try { void el.play()?.catch(() => undefined); } catch { /* blocked until a tap */ }
      } else {
        try { el.pause(); } catch { /* ignore */ }
      }
    }
  }

  // ---- synth + samples ----
  const samples = new Map<string, AudioBuffer | null>();
  const sampleLoading = new Set<string>();
  async function loadSample(name: string) {
    if (sampleLoading.has(name)) return;
    sampleLoading.add(name);
    const ctx = audioCtx();
    for (const ext of urls[name] ? ['url'] : ['mp3', 'ogg', 'wav']) {
      try {
        const r = await fetch(ext === 'url' ? urls[name] : `${base}${name}.${ext}`);
        if (!r.ok || (ext !== 'url' && !isAudioType(r.headers.get('content-type')))) continue;
        samples.set(name, await ctx.decodeAudioData(await r.arrayBuffer()));
        return;
      } catch { /* try the next extension */ }
    }
    samples.set(name, null);
  }

  const kit: AudioKit = {
    sfx(name) {
      if (!audible()) return;
      try {
        const ctx = audioCtx();
        if (ctx.state !== 'running') return;
        void loadSample(name);
        const buf = samples.get(name);
        if (buf) {
          const src = ctx.createBufferSource(), g = ctx.createGain();
          g.gain.value = 0.8; src.buffer = buf; src.connect(g).connect(ctx.destination); src.start();
          return;
        }
        const notes = recipes[name];
        if (!notes) return;
        const now = ctx.currentTime;
        for (const n of notes) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = n.type ?? 'sine';
          o.frequency.setValueAtTime(n.f, now + n.t);
          if (n.slide) o.frequency.linearRampToValueAtTime(n.slide, now + n.t + n.d);
          g.gain.setValueAtTime(0.0001, now + n.t);
          g.gain.exponentialRampToValueAtTime(n.v ?? 0.06, now + n.t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
          o.connect(g).connect(ctx.destination);
          o.start(now + n.t); o.stop(now + n.t + n.d + 0.02);
        }
      } catch { /* no audio: ignore */ }
    },
    music(name) {
      want = name; single = null;
      if (name) void load(name).then(apply); else apply();
      apply();
    },
    oneShot(name, onEnd) {
      want = null; single = null; apply();
      void load(name).then((el) => {
        if (!el) { onEnd?.(); return; }
        single = { name, el };
        el.currentTime = 0;
        el.onended = () => { el.onended = null; if (single?.el === el) single = null; apply(); onEnd?.(); };
        apply();
      });
    },
    stop() { want = null; single = null; apply(); },
    isMuted: () => muted,
    setMuted(m) {
      muted = m;
      try { localStorage.setItem(mutedKey, m ? '1' : '0'); } catch { /* ignore */ }
      apply(); listeners.forEach((f) => f());
    },
    setOutput(on) { output = on; apply(); },
    setDucked(on) { ducked = on; apply(); },
    async unlock() { await unlockAudioContext(); apply(); },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };

  if ((cfg.autoUnlock ?? true) && typeof document !== 'undefined') {
    const once = () => { document.removeEventListener('pointerdown', once); document.removeEventListener('keydown', once); void kit.unlock(); };
    document.addEventListener('pointerdown', once);
    document.addEventListener('keydown', once);
  }
  if (cfg.tryAtStart) void kit.unlock();
  return kit;
}
