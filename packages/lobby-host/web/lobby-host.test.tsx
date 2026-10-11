// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HostPanel, LobbyScreen, MusicWhere, SettingsForm, type SectionDef } from './index';
import type { MemberInfo, Snapshot } from '@gizmo564/room-server/server/protocol';

afterEach(cleanup);
interface S { target: number; fast: boolean; mode: string; secret: number }
const sections: SectionDef<S>[] = [
  { title: 'Rules', note: 'Pick wisely.', fields: [
    { key: 'target', kind: 'stepper', label: 'Target', min: 1, max: 9 },
    { key: 'fast', kind: 'toggle', label: 'Fast mode' },
    { key: 'mode', kind: 'choice', label: 'Mode', options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
    { key: 'secret', kind: 'stepper', label: 'Only when fast', min: 0, max: 3, when: (s) => s.fast },
  ] },
  { title: 'Hidden', when: (s) => s.target > 100, fields: [{ key: 'fast', kind: 'toggle', label: 'never shown' }] },
];
const m = (o: Partial<MemberInfo>): MemberInfo => ({ id: 'x', name: 'X', color: '#ff9fb2', avatar: 0, role: 'player', connected: true, host: false, ...o });
function snap(o: { you: Partial<Snapshot['you']> & { id: string }; members: MemberInfo[]; settings?: S }): Snapshot<S, unknown> {
  return { type: 'state', v: 1, code: 'ABCD', you: { token: 't', role: 'player', host: false, screen: false, music: false, ...o.you }, members: o.members, settings: o.settings ?? { target: 3, fast: false, mode: 'a', secret: 1 }, started: false, over: false, view: null, events: [], eventSeq: 0, deadline: null, plugins: {} };
}
const base = { joinUrl: 'https://play.0801564.xyz/?c=ABCD', minPlayers: 2, maxPlayers: 4, sections, error: '', onLeave: () => undefined };

describe('SettingsForm', () => {
  it('renders each kind, hides fields/sections by `when`, and reports patches', () => {
    const f = vi.fn();
    const { rerender } = render(<SettingsForm sections={sections} settings={{ target: 3, fast: false, mode: 'a', secret: 1 }} onChange={f} />);
    expect(screen.queryByText('Only when fast')).toBeNull(); expect(screen.queryByText('Hidden')).toBeNull();
    fireEvent.click(screen.getByLabelText('Target up')); expect(f).toHaveBeenLastCalledWith({ target: 4 });
    fireEvent.click(screen.getByLabelText(/Fast mode/)); expect(f).toHaveBeenLastCalledWith({ fast: true });
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' })); expect(f).toHaveBeenLastCalledWith({ mode: 'b' });
    rerender(<SettingsForm sections={sections} settings={{ target: 3, fast: true, mode: 'a', secret: 1 }} onChange={f} />);
    expect(screen.getByText('Only when fast')).toBeTruthy();
    expect(screen.getByText('Pick wisely.')).toBeTruthy();
  });
  it('disabled (guests) blocks every control', () => {
    const f = vi.fn();
    render(<SettingsForm sections={sections} settings={{ target: 3, fast: false, mode: 'a', secret: 1 }} onChange={f} disabled />);
    expect(document.querySelector('fieldset')!.disabled).toBe(true);
  });
});

describe('LobbyScreen', () => {
  const host = m({ id: 'h', name: 'Ann', host: true }), guest = m({ id: 'g', name: 'Bo' });
  it('host: sees controls, can start only with enough players, and says why not', () => {
    const send = vi.fn();
    const { rerender } = render(<LobbyScreen {...base} snap={snap({ you: { id: 'h', host: true }, members: [host] })} send={send} bots />);
    expect(screen.getByTestId('start-reason').textContent).toMatch(/at least 2 players \(add a bot\?\)/);
    expect((screen.getByText('Start game') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Add a bot')); expect(send).toHaveBeenLastCalledWith({ type: 'bot', op: 'add' });
    rerender(<LobbyScreen {...base} snap={snap({ you: { id: 'h', host: true }, members: [host, guest] })} send={send} bots />);
    expect(screen.queryByTestId('start-reason')).toBeNull();
    fireEvent.click(screen.getByText('Start game')); expect(send).toHaveBeenLastCalledWith({ type: 'start' });
    fireEvent.click(screen.getByLabelText('Remove Bo')); expect(send).toHaveBeenLastCalledWith({ type: 'kick', id: 'g' });
    fireEvent.click(screen.getByLabelText('Make Bo the host')); expect(send).toHaveBeenLastCalledWith({ type: 'makeHost', id: 'g' });
    fireEvent.click(screen.getByLabelText('Target up')); expect(send).toHaveBeenLastCalledWith({ type: 'settings', settings: { target: 4 } });
  });
  it('a game-specific block reason also disables Start', () => {
    render(<LobbyScreen {...base} snap={snap({ you: { id: 'h', host: true }, members: [host, guest] })} send={vi.fn()} blockReason="Teams are lopsided." />);
    expect(screen.getByTestId('start-reason').textContent).toBe('Teams are lopsided.');
    expect((screen.getByText('Start game') as HTMLButtonElement).disabled).toBe(true);
  });
  it('a TV in a room with no host says it is waiting for the first phone', () => {
    const tv = { id: 't', name: 'TV', color: '#fff', avatar: 0, role: 'spectator' as const, connected: true, host: false, screen: true };
    render(<LobbyScreen {...base} snap={snap({ you: { id: 't', host: false, screen: true }, members: [tv] })} send={vi.fn()} />);
    expect(screen.getByText(/Waiting for the first phone to join/)).toBeTruthy();
  });
  it('guest: no start, no host controls, settings locked, waiting line', () => {
    render(<LobbyScreen {...base} snap={snap({ you: { id: 'g' }, members: [host, guest] })} send={vi.fn()} />);
    expect(screen.queryByText('Start game')).toBeNull();
    expect(screen.queryByLabelText('Remove Ann')).toBeNull();
    expect(screen.getByText(/Waiting for the host/)).toBeTruthy();
    expect(screen.getByText(/Only the host can change/)).toBeTruthy();
    expect(document.querySelector('fieldset')!.disabled).toBe(true);
  });
  it('a room opened from a TV offers "Take control" to phones, and the TV itself gets the QR and no profile', async () => {
    const tv = m({ id: 'tv', name: 'Display', role: 'spectator', screen: true });
    const send = vi.fn();
    const { rerender } = render(<LobbyScreen {...base} snap={snap({ you: { id: 'g' }, members: [tv, guest] })} send={send} />);
    fireEvent.click(screen.getByText('Take control: be the host')); expect(send).toHaveBeenCalledWith({ type: 'claimHost' });
    await waitFor(() => expect(document.querySelector('.qr')).not.toBeNull());   // no host yet, so everyone sees the QR
    rerender(<LobbyScreen {...base} snap={snap({ you: { id: 'tv', role: 'spectator', screen: true }, members: [tv, host, guest] })} send={send} />);
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText('Take control: be the host')).toBeNull();
    await waitFor(() => expect(document.querySelector('.qr')).not.toBeNull());
  });
  it('profile edits go out as profile messages; joining plays the sound once', () => {
    const send = vi.fn(), snd = vi.fn();
    const { rerender } = render(<LobbyScreen {...base} snap={snap({ you: { id: 'g' }, members: [host, guest] })} send={send} onJoinSound={snd} />);
    fireEvent.click(screen.getByLabelText('Face 4')); expect(send).toHaveBeenLastCalledWith({ type: 'profile', avatar: 3 });
    expect(snd).not.toHaveBeenCalled();
    rerender(<LobbyScreen {...base} snap={snap({ you: { id: 'g' }, members: [host, guest, m({ id: 'n', name: 'New' })] })} send={send} onJoinSound={snd} />);
    expect(snd).toHaveBeenCalledTimes(1);
  });
});

describe('the TV lobby (no scroll, nothing to tap)', () => {
  const tv = m({ id: 'tv', name: 'Display', role: 'spectator', screen: true });
  const players = ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => m({ id: `p${i}`, name, avatar: i, host: i === 0 }));
  it('shows the code, the QR and every player with a face; the settings, profile, Start, bots and Copy link stay on the host phone', async () => {
    render(<LobbyScreen {...base} bots snap={snap({ you: { id: 'tv', role: 'spectator', screen: true }, members: [tv, ...players] })} send={vi.fn()} />);
    expect(screen.getByTestId('tv-lobby')).toBeTruthy();
    expect(screen.getByTestId('room-code').textContent).toBe('ABCD');
    await waitFor(() => expect(document.querySelector('.qr')).not.toBeNull());
    expect(screen.getAllByTestId('member').length).toBe(4);
    expect(document.querySelectorAll('.tvplayers .avatar-svg').length).toBe(4);
    expect(screen.getByText('Ann starts the game from their phone.')).toBeTruthy();
    for (const gone of ['Start game', 'Add a bot', 'Copy link']) expect(screen.queryByText(gone)).toBeNull();
    expect(document.querySelector('fieldset')).toBeNull();                       // no settings form
    expect(screen.queryByText(/Only the host can change/)).toBeNull();
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText(/display is attached/)).toBeNull();
  });
  it('a phone lobby in the same room still has settings, Start and Copy link', () => {
    render(<LobbyScreen {...base} snap={snap({ you: { id: 'p0', host: true }, members: [tv, ...players] })} send={vi.fn()} />);
    expect(screen.queryByTestId('tv-lobby')).toBeNull();
    expect(document.querySelector('fieldset')).not.toBeNull();
    expect(screen.getByText('Start game')).toBeTruthy();
  });
  it('the host gets the music picker only while a TV is connected', () => {
    const send = vi.fn();
    const { rerender } = render(<LobbyScreen {...base} snap={snap({ you: { id: 'p0', host: true }, members: players })} send={send} />);
    expect(screen.queryByTestId('music-where')).toBeNull();
    rerender(<LobbyScreen {...base} snap={snap({ you: { id: 'p0', host: true }, members: [tv, ...players] })} send={send} />);
    expect(screen.getByTestId('music-where')).toBeTruthy();
    rerender(<LobbyScreen {...base} snap={snap({ you: { id: 'p1' }, members: [tv, ...players] })} send={send} />);
    expect(screen.queryByTestId('music-where')).toBeNull();                      // guests never see it
  });
});

describe('MusicWhere and HostPanel', () => {
  const tv = m({ id: 'tv', name: 'Display', role: 'spectator', screen: true });
  const ann = m({ id: 'a', name: 'Ann', host: true }), bo = m({ id: 'b', name: 'Bo' }), bot = m({ id: 'bot', name: 'Bot 1', bot: true });
  it('moves the music between the phone and the TV, unlocking audio on the phone tap', () => {
    const send = vi.fn(), unlock = vi.fn();
    render(<MusicWhere snap={snap({ you: { id: 'a', host: true, music: false }, members: [tv, ann] })} send={send} onUnlock={unlock} />);
    fireEvent.click(screen.getByText('This phone')); expect(send).toHaveBeenLastCalledWith({ type: 'music', on: true }); expect(unlock).toHaveBeenCalled();
    fireEvent.click(screen.getByText('The TV')); expect(send).toHaveBeenLastCalledWith({ type: 'music', on: false });
  });
  it('host panel: cast slot, music, game buttons, and who is here (not bots or screens); nothing for a guest', () => {
    const send = vi.fn();
    const { rerender } = render(<HostPanel snap={snap({ you: { id: 'a', host: true }, members: [tv, ann, bo, bot] })} send={send} cast={<button>Show on TV</button>}><button>Next turn</button></HostPanel>);
    expect(screen.getByText('Show on TV')).toBeTruthy(); expect(screen.getByText('Next turn')).toBeTruthy();
    expect(screen.queryByLabelText('Remove Bot 1')).toBeNull();
    fireEvent.click(screen.getByLabelText('Remove Bo')); expect(send).toHaveBeenLastCalledWith({ type: 'kick', id: 'b' });
    fireEvent.click(screen.getByLabelText('Make Bo the host')); expect(send).toHaveBeenLastCalledWith({ type: 'makeHost', id: 'b' });
    rerender(<HostPanel snap={snap({ you: { id: 'b' }, members: [tv, ann, bo] })} send={send} />);
    expect(screen.queryByTestId('host-panel')).toBeNull();
  });
});
