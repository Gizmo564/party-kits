// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@gizmo564/lobby-ui/web';
import { App } from './App';
import { Local } from './screens/Local';
import { Hand } from './screens/Play';
import { RevealPanel } from './screens/Table';
import { resolveRound, view, start, defaultSettings } from '@game/engine';

afterEach(() => { cleanup(); try { localStorage.clear(); } catch { /* */ } });
const wrap = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('front menu and entry', () => {
  it('shows the shared menu (no code box: joining lives on play.0801564.xyz)', () => {
    wrap(<App />);
    expect(screen.getByText('Host Online')).toBeTruthy();
    expect(screen.getByText('Pass and Play')).toBeTruthy();
    expect(screen.getByText('How to Play')).toBeTruthy();
    expect(screen.getByText(/Sound: (on|off)/)).toBeTruthy();
    expect(screen.getByText('Go to play.0801564.xyz').getAttribute('href')).toBe('https://play.0801564.xyz');
    expect(screen.queryByTestId('code')).toBeNull();
    expect(screen.queryByTestId('resume')).toBeNull();           // nothing to resume on a fresh browser
  });
  it('Host Online offers play-here and host-screen, and needs a name only to play', async () => {
    wrap(<App />);
    fireEvent.click(screen.getByTestId('host'));
    expect(await screen.findByTestId('host-screen')).toBeTruthy();
    expect((screen.getByTestId('host-here') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'Ann' } });
    expect((screen.getByTestId('host-here') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('hand and reveal', () => {
  const r = start({ seats: [{ id: 'a' }, { id: 'b' }], settings: defaultSettings(), seed: 3, now: 0 });
  if (!r.ok) throw new Error('setup');
  it('plays the tapped card, then locks the hand', () => {
    const picked: number[] = [];
    const v = view(r.value, 'a');
    render(<Hand view={v} onPick={(c) => picked.push(c)} />);
    fireEvent.click(screen.getByTestId(`card-${v.hand![0]}`));
    expect(picked).toEqual([v.hand![0]]);
  });
  it('a spectator has no hand to play', () => {
    expect(view(r.value, null).hand).toBeNull();
  });
  it('shows matched cards as matched', () => {
    const rev = resolveRound(2, 0, [{ id: 'a', card: 7 }, { id: 'b', card: 7 }]);
    render(<RevealPanel reveal={rev} members={[{ id: 'a', name: 'Ann', color: '#fff', avatar: 0, role: 'player', connected: true, host: true }, { id: 'b', name: 'Bo', color: '#fff', avatar: 1, role: 'player', connected: true, host: false }]} />);
    expect(screen.getByText('Nobody wins this one')).toBeTruthy();
    expect(screen.getAllByText(/\(matched\)/)).toHaveLength(2);
  });
});

describe('pass the phone', () => {
  it('covers each hand until its owner taps ready, and plays a whole round', () => {
    wrap(<Local onLeave={() => undefined} />);
    fireEvent.click(screen.getByTestId('local-start'));
    expect(screen.getByTestId('cover')).toBeTruthy();
    expect(screen.queryByLabelText('Your hand')).toBeNull();          // the hand is NOT in the page while covered
    for (let seat = 0; seat < 2; seat++) {
      fireEvent.click(screen.getByTestId('cover-ready'));
      const card = screen.getByLabelText('Your hand').querySelector('button')!;
      fireEvent.click(card);
    }
    expect(screen.getByTestId('reveal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('next-round'));
    expect(screen.getByTestId('cover')).toBeTruthy();                 // round 2 starts covered again
  });
});
