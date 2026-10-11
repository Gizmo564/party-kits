// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createAudio, DEFAULT_SFX, MusicButton, SFX_NAMES, useMusic, useMusicDevice } from './index';
import { _resetCtx } from './ctx';

class FakeEl {
  static all: FakeEl[] = [];
  paused = true; loop = false; volume = 1; currentTime = 0; preload = ''; onended: (() => void) | null = null; plays = 0;
  constructor(public src: string) { FakeEl.all.push(this); }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.onended?.(); }
}
const elOf = (file: string) => FakeEl.all.find((e) => e.src.endsWith(file))!;
let ctxState = 'running'; let oscStarts = 0;
class FakeCtx {
  state = ctxState; currentTime = 0; destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  createOscillator() { const o: any = { type: '', frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: (x: any) => x, start: () => { oscStarts++; }, stop() {} }; return o; }
  createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: any) => x }; }
  createBufferSource() { return { buffer: null, connect: (x: any) => x, start: vi.fn() }; }
  decodeAudioData = vi.fn(async () => ({ decoded: true }));
}
const present = new Set<string>();
beforeEach(() => {
  FakeEl.all = []; present.clear(); oscStarts = 0; ctxState = 'running'; _resetCtx(); localStorage.clear();
  vi.stubGlobal('Audio', FakeEl); vi.stubGlobal('AudioContext', FakeCtx);
  vi.stubGlobal('fetch', vi.fn(async (u: string, init?: { method?: string }) => {
    const ok = present.has(u);
    return new Response(init?.method === 'HEAD' || !ok ? null : new ArrayBuffer(4), { status: ok ? 200 : 404, headers: { 'content-type': ok ? 'audio/mpeg' : 'text/html' } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('music', () => {
  it('loops an existing track, ignores a missing one, and switches by pausing the old one', async () => {
    present.add('/sounds/lobby.mp3'); present.add('/sounds/play.mp3');
    const a = createAudio({ game: 'g', tracks: { lobby: {}, play: { volume: 0.05 }, nothere: {} } });
    a.music('nothere'); await flush();
    expect(FakeEl.all.length).toBe(0);
    a.music('lobby'); await flush();
    expect(elOf('lobby.mp3')).toMatchObject({ loop: true, paused: false, volume: 0.4 });
    a.music('play'); await flush();
    expect(elOf('lobby.mp3').paused).toBe(true);
    expect(elOf('play.mp3')).toMatchObject({ paused: false, volume: 0.05 });
    a.music(null); await flush();
    expect(elOf('play.mp3').paused).toBe(true);
  });
  it('mute pauses (does not just lower the volume), persists per game, and resumes', async () => {
    present.add('/sounds/lobby.mp3');
    const a = createAudio({ game: 'g' });
    a.music('lobby'); await flush();
    const n = vi.fn(); a.subscribe(n);
    a.setMuted(true);
    expect(elOf('lobby.mp3').paused).toBe(true); expect(localStorage.getItem('g-muted')).toBe('1'); expect(n).toHaveBeenCalled();
    expect(createAudio({ game: 'g' }).isMuted()).toBe(true);
    expect(createAudio({ game: 'other' }).isMuted()).toBe(false);
    a.setMuted(false);
    expect(elOf('lobby.mp3').paused).toBe(false);
  });
  it('output off (a TV is the music device) and ducking (a clip is playing) both silence music', async () => {
    present.add('/sounds/lobby.mp3');
    const a = createAudio({ game: 'g' });
    a.music('lobby'); await flush();
    a.setOutput(false); expect(elOf('lobby.mp3').paused).toBe(true);
    a.setOutput(true); expect(elOf('lobby.mp3').paused).toBe(false);
    a.setDucked(true); expect(elOf('lobby.mp3').paused).toBe(true);
    a.setDucked(false); expect(elOf('lobby.mp3').paused).toBe(false);
  });
  it('a one-shot sting stops the loop, plays once, then chains', async () => {
    present.add('/sounds/lobby.mp3'); present.add('/sounds/win.mp3'); present.add('/sounds/credits.mp3');
    const a = createAudio({ game: 'g' });
    a.music('lobby'); await flush();
    const then = vi.fn(() => a.music('credits'));
    a.oneShot('win', then); await flush();
    expect(elOf('lobby.mp3').paused).toBe(true);
    expect(elOf('win.mp3')).toMatchObject({ paused: false, loop: false });
    elOf('win.mp3').end(); await flush();
    expect(then).toHaveBeenCalled();
    expect(elOf('credits.mp3')).toMatchObject({ paused: false, loop: true });
  });
  it('a one-shot with no file still runs the chain', async () => {
    const a = createAudio({ game: 'g' }); const then = vi.fn();
    a.oneShot('missing', then); await flush();
    expect(then).toHaveBeenCalled();
  });
  it('stop() silences everything; fetch failures never throw', async () => {
    present.add('/sounds/lobby.mp3');
    const a = createAudio({ game: 'g' }); a.music('lobby'); await flush(); a.stop();
    expect(elOf('lobby.mp3').paused).toBe(true);
    (fetch as any).mockImplementation(async () => { throw new Error('offline'); });
    expect(() => createAudio({ game: 'h' }).music('x')).not.toThrow();
  });
});

describe('sfx', () => {
  it('has the shared set, plays a synth recipe, and respects mute/duck/output/suspended', () => {
    expect(SFX_NAMES).toEqual(expect.arrayContaining(['tap', 'good', 'bad', 'win', 'join']));
    const a = createAudio({ game: 'g' });
    a.sfx('good'); expect(oscStarts).toBe(DEFAULT_SFX.good.length);
    a.sfx('nope'); expect(oscStarts).toBe(DEFAULT_SFX.good.length);
    a.setMuted(true); a.sfx('good'); a.setMuted(false);
    a.setDucked(true); a.sfx('good'); a.setDucked(false);
    a.setOutput(false); a.sfx('good'); a.setOutput(true);
    expect(oscStarts).toBe(DEFAULT_SFX.good.length);
  });
  it('is silent while the context is suspended and works after unlock()', async () => {
    ctxState = 'suspended';
    const a = createAudio({ game: 'g' });
    a.sfx('tap'); expect(oscStarts).toBe(0);
    await a.unlock();
    a.sfx('tap'); expect(oscStarts).toBe(1);
  });
  it('a recording in /sounds overrides the synth after it loads', async () => {
    present.add('/sounds/tap.mp3');
    const a = createAudio({ game: 'g' });
    a.sfx('tap'); const first = oscStarts; await flush(); await flush();
    expect(first).toBe(1);
    a.sfx('tap'); expect(oscStarts).toBe(1);   // sample played instead of a new oscillator
  });
  it('the first tap on the page unlocks audio by itself', async () => {
    ctxState = 'suspended';
    createAudio({ game: 'g' });
    fireEvent.pointerDown(document.body);
    await flush();
    const a = createAudio({ game: 'g', autoUnlock: false }); a.sfx('tap');
    expect(oscStarts).toBe(1);
  });
});

describe('unlocking without a tap (TVs)', () => {
  it('a key press unlocks audio too', async () => {
    ctxState = 'suspended';
    createAudio({ game: 'g' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    await flush();
    const a = createAudio({ game: 'g', autoUnlock: false }); a.sfx('tap');
    expect(oscStarts).toBe(1);
  });
  it('tryAtStart unlocks at once; by default nothing happens until a touch or key', async () => {
    ctxState = 'suspended';
    const quiet = createAudio({ game: 'g', autoUnlock: false });
    quiet.sfx('tap'); expect(oscStarts).toBe(0);
    _resetCtx(); ctxState = 'suspended';
    createAudio({ game: 'g', autoUnlock: false, tryAtStart: true });
    await flush();
    quiet.sfx('tap'); expect(oscStarts).toBe(1);        // the shared context is running without any tap
  });
});

describe('react helpers', () => {
  it('useMusic plays while mounted, stops on unmount, and undefined hands the music to a child screen', async () => {
    present.add('/sounds/lobby.mp3');
    const a = createAudio({ game: 'g' });
    const { unmount, rerender } = renderHook(({ n }: { n: string | null | undefined }) => useMusic(a, n), { initialProps: { n: 'lobby' as string | null | undefined } });
    await flush(); expect(elOf('lobby.mp3').paused).toBe(false);
    rerender({ n: undefined }); expect(elOf('lobby.mp3').paused).toBe(true);   // the old screen's music ends; a child screen may start its own
    rerender({ n: 'lobby' }); await flush(); expect(elOf('lobby.mp3').paused).toBe(false);
    unmount(); expect(elOf('lobby.mp3').paused).toBe(true);
  });
  it('useMusicDevice turns this device\'s music output on or off', async () => {
    present.add('/sounds/lobby.mp3');
    const a = createAudio({ game: 'g' }); a.music('lobby'); await flush();
    const { rerender } = renderHook(({ on }) => useMusicDevice(a, on), { initialProps: { on: false } });
    expect(elOf('lobby.mp3').paused).toBe(true);
    rerender({ on: true }); expect(elOf('lobby.mp3').paused).toBe(false);
  });
  it('MusicButton toggles and reflects mute', () => {
    const a = createAudio({ game: 'g' });
    render(<MusicButton audio={a} />);
    expect(screen.getByTestId('music-toggle').textContent).toBe('Sound: on');
    fireEvent.click(screen.getByTestId('music-toggle'));
    expect(screen.getByTestId('music-toggle').textContent).toBe('Sound: off');
    expect(a.isMuted()).toBe(true);
  });
});
