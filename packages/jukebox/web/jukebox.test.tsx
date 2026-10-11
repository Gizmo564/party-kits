// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AudioKit } from '@gizmo564/audio/web';
import { AUTO, audioName, createJukebox, fetchLibrary, JukeboxPanel, parseLibrary } from './index';

const base = 'https://music.example/';
const json = { tracks: [
  { id: 'picnic', name: 'Picnic', file: 'tracks/picnic.mp3' },
  { id: 'elevator', name: ' Elevator ', file: 'tracks/elevator.mp3' },
  { id: 'Bad Id', name: 'x', file: 'tracks/x.mp3' },
  { id: 'picnic', name: 'dupe', file: 'tracks/d.mp3' },
  { id: 'nofile', name: 'n' },
] };

function fakeAudio() {
  let override: string | null = null; let vol = 0.4; const subs = new Set<() => void>();
  const added: Record<string, string> = {};
  const a = {
    addTrack: vi.fn((n: string, u: string) => { added[n] = u; }),
    setOverride: vi.fn((n: string | null) => { override = n; }),
    getOverride: () => override,
    setVolume: vi.fn((v: number | null) => { vol = v ?? 0.4; subs.forEach((f) => f()); }),
    getVolume: () => vol,
    subscribe: (f: () => void) => { subs.add(f); return () => subs.delete(f); },
    unlock: vi.fn(async () => undefined),
  };
  return { a: a as unknown as AudioKit & typeof a, added };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('library', () => {
  it('keeps valid tracks, trims names, resolves urls against the host, drops junk and duplicates', () => {
    const t = parseLibrary(json, base);
    expect(t).toEqual([
      { id: 'picnic', name: 'Picnic', url: 'https://music.example/tracks/picnic.mp3' },
      { id: 'elevator', name: 'Elevator', url: 'https://music.example/tracks/elevator.mp3' },
    ]);
    expect(parseLibrary(null)).toEqual([]);
    expect(parseLibrary({ tracks: 'no' })).toEqual([]);
  });
  it('fetches the list, caches the good copy, and falls back to it when the host is down', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => json }) as Response);
    expect((await fetchLibrary({ base, fetchImpl: ok })).map((t) => t.id)).toEqual(['picnic', 'elevator']);
    expect(ok).toHaveBeenCalledWith('https://music.example/tracks.json', { cache: 'no-cache' });
    const down = vi.fn(async () => { throw new Error('offline'); });
    expect((await fetchLibrary({ base, fetchImpl: down })).map((t) => t.id)).toEqual(['picnic', 'elevator']);
    localStorage.clear();
    expect(await fetchLibrary({ base, fetchImpl: down })).toEqual([]);
    const bad = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    expect(await fetchLibrary({ base, fetchImpl: bad })).toEqual([]);
  });
});

describe('jukebox', () => {
  it('registers every song with the audio kit, and a pick becomes the override; auto clears it', () => {
    const { a, added } = fakeAudio();
    const jb = createJukebox(a); jb.setTracks(parseLibrary(json, base));
    expect(added[audioName('picnic')]).toBe('https://music.example/tracks/picnic.mp3');
    expect(jb.selected()).toBe(AUTO);
    jb.select('picnic');
    expect(a.setOverride).toHaveBeenLastCalledWith('jb:picnic');
    jb.select(AUTO);
    expect(a.setOverride).toHaveBeenLastCalledWith(null);
  });
  it('a pick the list does not know about falls back to auto instead of silence', () => {
    const { a } = fakeAudio();
    const jb = createJukebox(a); jb.setTracks(parseLibrary(json, base));
    jb.select('ghost');
    expect(a.setOverride).toHaveBeenLastCalledWith(null);
  });
  it('follows a room\'s shared choice, and leaves the volume alone when the host has not set one', () => {
    const { a } = fakeAudio();
    const jb = createJukebox(a); jb.setTracks(parseLibrary(json, base));
    jb.apply({ track: 'elevator', volume: null });
    expect(a.setOverride).toHaveBeenLastCalledWith('jb:elevator');
    expect(a.setVolume).not.toHaveBeenCalled();
    jb.apply({ track: 'elevator', volume: 0.7 });
    expect(a.setVolume).toHaveBeenCalledWith(0.7);
  });
});

describe('panel', () => {
  const setup = (remote?: Parameters<typeof JukeboxPanel>[0]['remote']) => {
    const { a } = fakeAudio();
    const jb = createJukebox(a); jb.setTracks(parseLibrary(json, base));
    render(<JukeboxPanel jukebox={jb} remote={remote} />);
    return { a, jb };
  };
  it('rolls out from a button; Auto first, then each song by name; the pick sticks and shows on the button', () => {
    const { a } = setup();
    expect(screen.queryByTestId('jukebox-panel')).toBeNull();
    expect(screen.getByTestId('jukebox-toggle').textContent).toContain('Auto');
    fireEvent.click(screen.getByTestId('jukebox-toggle'));
    const names = [...screen.getByTestId('jukebox-panel').querySelectorAll('.jukebox-list button')].map((b) => b.textContent);
    expect(names).toEqual(['Auto', 'Picnic', 'Elevator']);
    expect(screen.getByTestId('jukebox-track-auto').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('jukebox-track-picnic'));
    expect(a.setOverride).toHaveBeenLastCalledWith('jb:picnic');
    expect(screen.getByTestId('jukebox-track-picnic').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('jukebox-toggle'));
    expect(screen.getByTestId('jukebox-toggle').textContent).toContain('Picnic');
  });
  it('the volume slider drives the audio kit', () => {
    const { a } = setup();
    fireEvent.click(screen.getByTestId('jukebox-toggle'));
    fireEvent.change(screen.getByTestId('jukebox-volume'), { target: { value: '65' } });
    expect(a.setVolume).toHaveBeenCalledWith(0.65);
  });
  it('as a remote it steers the room setting and leaves this device\'s sound alone', () => {
    const onTrack = vi.fn(); const onVolume = vi.fn();
    const { a } = setup({ track: 'elevator', volume: 0.5, onTrack, onVolume, note: 'Plays on the TV' });
    fireEvent.click(screen.getByTestId('jukebox-toggle'));
    expect(screen.getByText('Plays on the TV')).toBeTruthy();
    expect(screen.getByTestId('jukebox-track-elevator').getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('jukebox-volume') as HTMLInputElement).value).toBe('50');
    fireEvent.click(screen.getByTestId('jukebox-track-picnic'));
    fireEvent.change(screen.getByTestId('jukebox-volume'), { target: { value: '20' } });
    expect(onTrack).toHaveBeenCalledWith('picnic');
    expect(onVolume).toHaveBeenCalledWith(0.2);
    expect(a.setOverride).not.toHaveBeenCalledWith('jb:picnic');
    expect(a.setVolume).not.toHaveBeenCalled();
  });
  it('with no songs the panel says so and Auto still works', () => {
    const { a } = fakeAudio();
    const jb = createJukebox(a, { fetchImpl: vi.fn(async () => { throw new Error('x'); }) });
    render(<JukeboxPanel jukebox={jb} defaultOpen />);
    expect(screen.getByText(/Songs are not available/)).toBeTruthy();
    expect(screen.getByTestId('jukebox-track-auto')).toBeTruthy();
  });
});
