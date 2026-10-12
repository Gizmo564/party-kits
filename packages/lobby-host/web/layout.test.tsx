// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LobbyScreen, SettingsForm, summarize, type SectionDef } from './index';
import type { MemberInfo, Snapshot } from '@gizmo564/room-server/server/protocol';

afterEach(cleanup);
interface S { rounds: number; fast: boolean; timer: number }
const sections: SectionDef<S>[] = [{ title: 'Game setup', note: 'Scoring: two points.', fields: [
  { key: 'timer', kind: 'choice', label: 'Turn timer', options: [{ value: 0, label: 'No timer' }, { value: 20, label: '20 seconds' }] },
  { key: 'rounds', kind: 'stepper', label: 'Rounds', min: 1, max: 9 },
  { key: 'fast', kind: 'toggle', label: 'Fast mode' },
] }];
const settings: S = { rounds: 3, fast: true, timer: 20 };

describe('summarize', () => {
  it('lists the values in one line, leaving off toggles that are off', () => {
    expect(summarize(sections[0], settings)).toBe('Turn timer: 20 seconds · Rounds 3 · Fast mode');
    expect(summarize(sections[0], { ...settings, fast: false })).toBe('Turn timer: 20 seconds · Rounds 3');
  });
});

describe('SettingsForm sections fold up', () => {
  it('are closed with a summary, open when tapped, and still report patches', () => {
    const onChange = vi.fn();
    render(<SettingsForm sections={sections} settings={settings} onChange={onChange} />);
    const head = screen.getByRole('button', { name: /Game setup/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.textContent).toContain('Rounds 3');
    fireEvent.click(head);
    fireEvent.click(screen.getByLabelText('Rounds up'));
    expect(onChange).toHaveBeenCalledWith({ rounds: 4 });
  });
  it('defaultOpen starts a section open', () => {
    render(<SettingsForm sections={[{ ...sections[0], defaultOpen: true }]} settings={settings} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: /Game setup/ }).getAttribute('aria-expanded')).toBe('true');
  });
});

const mem = (o: Partial<MemberInfo>): MemberInfo => ({ id: 'x', name: 'X', color: '#e63946', role: 'player', host: false, connected: true, away: false, bot: false, screen: false, ...o } as MemberInfo);
const snap = (you: Partial<Snapshot<S, unknown>['you']>, members: MemberInfo[]): Snapshot<S, unknown> => ({ code: 'ABCD', phase: 'lobby', settings, members, you: { id: 'h', host: true, music: false, ...you } } as unknown as Snapshot<S, unknown>);
const base = { error: '', onLeave: () => undefined, joinUrl: 'https://g.example/?room=ABCD', minPlayers: 2, maxPlayers: 8, sections };

describe('LobbyScreen layout', () => {
  const host = mem({ id: 'h', name: 'Ann', host: true }), guest = mem({ id: 'g', name: 'Bo' });
  it('host: Start is in the pinned bar, the profile is folded to your name, devices sit in one row', () => {
    render(<LobbyScreen {...base} snap={snap({}, [host, guest])} send={vi.fn()} devices={<button>Show on TV</button>} />);
    const bar = screen.getByTestId('stickybar');
    expect(bar.textContent).toContain('Start game');
    expect(screen.getByTestId('devices').textContent).toContain('Show on TV');
    const profile = screen.getByTestId('profile');
    expect(profile.textContent).toContain('Ann');
    expect(profile.querySelector('.collapsible-body')!.hasAttribute('hidden')).toBe(true);
  });
  it('profileCollapsed={false} keeps the old open profile panel', () => {
    render(<LobbyScreen {...base} snap={snap({}, [host, guest])} send={vi.fn()} profileCollapsed={false} />);
    expect(screen.queryByTestId('profile')).toBeNull();
    expect(screen.getByLabelText('Your name')).not.toBeNull();
  });
  it('guest: the pinned bar says the host starts it', () => {
    render(<LobbyScreen {...base} snap={snap({ id: 'g', host: false }, [host, guest])} send={vi.fn()} />);
    expect(screen.getByTestId('stickybar').textContent).toMatch(/Waiting for the host/);
  });
  it('a TV puts the device buttons in the top bar beside Full screen, with the code panel first', () => {
    const tv = mem({ id: 't', name: 'TV', screen: true });
    render(<LobbyScreen {...base} snap={snap({ id: 't', host: false }, [host, tv])} send={vi.fn()} devices={<button>Show on wired TV</button>} />);
    const top = screen.getByTestId('tv-lobby').firstElementChild as HTMLElement;
    expect(top.textContent).toContain('Show on wired TV');
    expect(screen.queryByTestId('stickybar')).toBeNull();
  });
  it('phone: Leave in the header, the device grid sits right under the code panel', () => {
    render(<LobbyScreen {...base} snap={snap({}, [host, guest])} send={vi.fn()} devices={<><button>Sound</button><button>Show on TV</button></>} />);
    expect(screen.getByTestId('lobby-header').textContent).toContain('Leave');
    const code = screen.getByTestId('room-code').closest('section')!;
    expect(code.nextElementSibling).toBe(screen.getByTestId('devices'));
  });
  it('a TV has no Leave button', () => {
    const tv = mem({ id: 't', name: 'TV', screen: true });
    render(<LobbyScreen {...base} snap={snap({ id: 't', host: false }, [host, tv])} send={vi.fn()} />);
    expect(screen.queryByText('Leave')).toBeNull();
  });
});
