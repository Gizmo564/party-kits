// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from './index';
import { _resetCtx } from './ctx';

class FakeEl {
  static all: FakeEl[] = [];
  paused = true; loop = false; volume = 1; currentTime = 0; preload = ''; crossOrigin: string | null = null; src = ''; onended: (() => void) | null = null;
  constructor(src?: string) { if (src) this.src = src; FakeEl.all.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.onended?.(); }
}
const el = (file: string) => FakeEl.all.find((e) => e.src.endsWith(file));
const flush = () => new Promise((r) => setTimeout(r, 0));
class FakeCtx { state = 'running'; destination = {}; resume = vi.fn(async () => undefined); createGain() { return { gain: { value: 1 }, connect: (x: unknown) => x }; } }

beforeEach(() => {
  FakeEl.all = []; _resetCtx(); localStorage.clear();
  vi.stubGlobal('Audio', FakeEl); vi.stubGlobal('AudioContext', FakeCtx);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: new Headers({ 'content-type': 'audio/mpeg' }) })));
});
afterEach(() => { vi.unstubAllGlobals(); });

const make = () => createAudio({ game: 't', autoUnlock: false, tracks: { lobby: { volume: 0.3 }, play: { volume: 0.5 }, sting: { volume: 0.6 } }, sfx: {} });

describe('override ("jukebox pick")', () => {
  it('plays the picked song instead of the game track, and Auto (null) hands music back', async () => {
    const a = make();
    a.addTrack('jb:picnic', 'https://music.example/tracks/picnic.mp3', 0.4);
    a.music('lobby'); await flush();
    expect(el('/sounds/lobby.mp3')!.paused).toBe(false);
    a.setOverride('jb:picnic'); await flush();
    expect(el('/sounds/lobby.mp3')!.paused).toBe(true);
    expect(el('picnic.mp3')!.paused).toBe(false);
    expect(el('picnic.mp3')!.loop).toBe(true);
    a.music('play'); await flush();                    // the game moves on: the pick keeps playing
    expect(el('picnic.mp3')!.paused).toBe(false);
    expect(el('/sounds/play.mp3')?.paused ?? true).toBe(true);
    a.setOverride(null); await flush();                // back to Auto: the game's current track
    expect(el('picnic.mp3')!.paused).toBe(true);
    expect(el('/sounds/play.mp3')!.paused).toBe(false);
  });
  it('silence stays silence: a pick does not play after the game stops its music', async () => {
    const a = make();
    a.addTrack('jb:x', 'https://m.example/x.mp3');
    a.music('lobby'); a.setOverride('jb:x'); await flush();
    expect(el('x.mp3')!.paused).toBe(false);
    a.stop(); expect(el('x.mp3')!.paused).toBe(true);
    a.music('lobby'); await flush();
    expect(el('x.mp3')!.paused).toBe(false);
  });
  it('stings still play over a pick and the pick resumes only when the game asks for music again', async () => {
    const a = make();
    a.addTrack('jb:x', 'https://m.example/x.mp3');
    a.music('lobby'); a.setOverride('jb:x'); await flush();
    a.oneShot('sting', () => a.music('lobby')); await flush();
    expect(el('x.mp3')!.paused).toBe(true);
    expect(el('/sounds/sting.mp3')!.paused).toBe(false);
    el('/sounds/sting.mp3')!.end(); await flush();
    expect(el('x.mp3')!.paused).toBe(false);
  });
  it('asks another site\'s file to be fetched with CORS, never the game\'s own files', async () => {
    const a = make();
    a.addTrack('jb:x', 'https://music.example/x.mp3');
    a.music('lobby'); a.setOverride('jb:x'); await flush();
    expect(el('x.mp3')!.crossOrigin).toBe('anonymous');
    expect(el('/sounds/lobby.mp3')!.crossOrigin).toBeNull();
  });
  it('a pick the mute switch silences stays silenced', async () => {
    const a = make();
    a.addTrack('jb:x', 'https://m.example/x.mp3');
    a.music('lobby'); a.setOverride('jb:x'); await flush();
    a.setMuted(true);
    expect(el('x.mp3')!.paused).toBe(true);
  });
});

describe('music volume', () => {
  it('moves the music, not the stings, remembers the choice, and null goes back to each track\'s level', async () => {
    const a = make();
    a.music('lobby'); await flush();
    expect(el('/sounds/lobby.mp3')!.volume).toBe(0.3);
    expect(a.getVolume()).toBe(0.3);
    a.setVolume(0.8);
    expect(el('/sounds/lobby.mp3')!.volume).toBe(0.8);
    expect(localStorage.getItem('t-volume')).toBe('0.8');
    a.oneShot('sting'); await flush();
    expect(el('/sounds/sting.mp3')!.volume).toBe(0.6);       // a sting keeps its own level
    const b = make();                                        // a new session of the same game
    expect(b.getVolume()).toBe(0.8);
    b.setVolume(null);
    expect(localStorage.getItem('t-volume')).toBeNull();
  });
  it('clamps to 0..1 and notifies subscribers', () => {
    const a = make(); const f = vi.fn(); a.subscribe(f);
    a.setVolume(5); expect(a.getVolume()).toBe(1);
    a.setVolume(-1); expect(a.getVolume()).toBe(0);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('uses a Web Audio gain when the element will not take a volume (iPhones)', async () => {
    const gainNodes: { gain: { value: number } }[] = [];
    class IosCtx { state = 'running'; destination = {}; resume = vi.fn(async () => undefined);
      createGain() { const g = { gain: { value: 1 }, connect: (x: unknown) => x }; gainNodes.push(g); return g; }
      createMediaElementSource() { return { connect: (x: unknown) => x }; } }
    class IosEl extends FakeEl { constructor() { super(); Object.defineProperty(this, 'volume', { get: () => 1, set: () => undefined }); } }   // volume ignored, like iOS
    vi.stubGlobal('AudioContext', IosCtx); vi.stubGlobal('Audio', IosEl); _resetCtx();
    const a = make();
    a.music('lobby'); await flush();
    a.setVolume(0.25);
    expect(gainNodes.at(-1)!.gain.value).toBe(0.25);
  });
});
