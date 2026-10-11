// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Avatar, AvatarFace, Choice, CodePanel, ColorPicker, LOOK_COUNT, Modal, PlayerList, ProfileEditor, Stepper, ToastProvider, Toggle, TurnTimer, fitGrid, lookFromName, lookParts, useToast, FullscreenButton } from './index';
import { PLAYER_COLORS } from '@gizmo564/engine-core/engine';
import type { MemberInfo } from '@gizmo564/room-server/server/protocol';

afterEach(cleanup);
const mem = (o: Partial<MemberInfo>): MemberInfo => ({ id: 'x', name: 'X', color: PLAYER_COLORS[0], avatar: 0, role: 'player', connected: true, host: false, ...o });

describe('avatars', () => {
  it('21 looks, stable per name, every look renders a distinct head/face pair', () => {
    expect(LOOK_COUNT).toBe(21);
    const seen = new Set(Array.from({ length: 21 }, (_, i) => JSON.stringify(lookParts(i))));
    expect(seen.size).toBe(21);
    expect(lookFromName('Ann')).toBe(lookFromName('Ann'));
    expect(lookParts(-1)).toEqual(lookParts(20)); expect(lookParts(21)).toEqual(lookParts(0));
    const { container } = render(<><Avatar name="Ann" color="#ff9fb2" /><AvatarFace look={5} color="#fff" /></>);
    expect(container.querySelectorAll('svg').length).toBe(2);
  });
});

describe('controls', () => {
  it('Stepper respects bounds and step', () => {
    const f = vi.fn();
    const { rerender } = render(<Stepper label="N" value={5} min={5} max={9} step={2} onChange={f} />);
    expect((screen.getByLabelText('N down') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('N up')); expect(f).toHaveBeenLastCalledWith(7);
    rerender(<Stepper label="N" value={8} min={5} max={9} step={2} onChange={f} />);
    fireEvent.click(screen.getByLabelText('N up')); expect(f).toHaveBeenLastCalledWith(9);
  });
  it('Toggle and Choice report changes', () => {
    const t = vi.fn(), c = vi.fn();
    render(<><Toggle on={false} onChange={t} label="Teams" hint="hi" /><Choice label="Len" value={15} options={[{ value: 15, label: '15s' }, { value: 30, label: '30s' }]} onChange={c} /></>);
    fireEvent.click(screen.getByLabelText(/Teams/)); expect(t).toHaveBeenCalledWith(true);
    expect(screen.getByRole('radio', { name: '15s' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: '30s' })); expect(c).toHaveBeenCalledWith(30);
  });
  it('ColorPicker disables colors other people use, but not your own', () => {
    const f = vi.fn();
    render(<ColorPicker colors={['#111111', '#222222', '#333333']} value="#222222" taken={['#111111', '#222222']} onPick={f} />);
    expect((screen.getByLabelText('#111111') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('#222222') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('#333333')); expect(f).toHaveBeenCalledWith('#333333');
  });
  it('Modal closes on Escape and on backdrop click, not on a click inside', () => {
    const f = vi.fn();
    const { container } = render(<Modal title="Rules" onClose={f}><p>text</p></Modal>);
    fireEvent.click(screen.getByText('text')); expect(f).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(f).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-back')!); expect(f).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Rules');
  });
});

describe('toasts', () => {
  it('shows a toast and removes it after its time', () => {
    vi.useFakeTimers();
    function Btn() { const t = useToast(); return <button onClick={() => t('Copied', 1000)}>go</button>; }
    render(<ToastProvider><Btn /></ToastProvider>);
    fireEvent.click(screen.getByText('go')); expect(screen.getByText('Copied')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1001); });
    expect(screen.queryByText('Copied')).toBeNull();
    vi.useRealTimers();
  });
});

describe('TurnTimer', () => {
  it('counts down from the deadline, goes urgent near the end, and hides with no deadline', () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const { container, rerender } = render(<TurnTimer deadline={1_010_000} total={10_000} />);
    expect(container.querySelector('text')!.textContent).toBe('10');
    expect(container.querySelector('.urgent')).toBeNull();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(container.querySelector('text')!.textContent).toBe('4');
    expect(container.querySelector('.urgent')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(container.querySelector('text')!.textContent).toBe('0');
    rerender(<TurnTimer deadline={null} total={10_000} />);
    expect(container.querySelector('svg')).toBeNull();
    vi.useRealTimers();
  });
});

describe('lobby parts', () => {
  it('CodePanel shows the code with spoken spacing, the link without protocol, and copies', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CodePanel code="ABCD" joinUrl="https://play.0801564.xyz/?c=ABCD" />);
    expect(screen.getByLabelText('Room code A B C D').textContent).toBe('ABCD');
    expect(screen.getByText('play.0801564.xyz/?c=ABCD')).toBeTruthy();
    fireEvent.click(screen.getByText('Copy link'));
    expect(writeText).toHaveBeenCalledWith('https://play.0801564.xyz/?c=ABCD');
  });
  it('PlayerList: bots, away, watchers, displays; host controls never target yourself', () => {
    const kick = vi.fn(), host = vi.fn();
    const members = [mem({ id: 'me', name: 'Ann', host: true }), mem({ id: 'b', name: 'Bo' }), mem({ id: 'bot', name: 'Bot 1', bot: true }), mem({ id: 'o', name: 'Off', connected: false }), mem({ id: 'w', name: 'Wat', role: 'spectator' }), mem({ id: 'tv', name: 'Display', role: 'spectator', screen: true })];
    render(<PlayerList members={members} meId="me" max={4} hostControls={{ onKick: kick, onMakeHost: host, canKick: true }} />);
    expect(screen.getAllByTestId('member').length).toBe(4);
    expect(screen.getByText('BOT')).toBeTruthy(); expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByText(/Watching: Wat/)).toBeTruthy(); expect(screen.getByText('A display is attached.')).toBeTruthy();
    expect(screen.queryByLabelText('Remove Ann')).toBeNull();
    fireEvent.click(screen.getByLabelText('Remove Bo')); expect(kick).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByLabelText('Make Bo the host')); expect(host).toHaveBeenCalledWith('b');
    expect(screen.queryByLabelText('Make Bot 1 the host')).toBeNull();
    expect(screen.queryByLabelText('Make Off the host')).toBeNull();
  });
  it('ProfileEditor sends only real changes', () => {
    const f = vi.fn();
    function T() { const [m] = useState(mem({ id: 'me', name: 'Ann' })); return <ProfileEditor me={m} members={[m, mem({ id: 'o', color: PLAYER_COLORS[1] })]} colors={PLAYER_COLORS.slice(0, 3)} onProfile={f} />; }
    render(<T />);
    const input = screen.getByLabelText('Your name');
    fireEvent.blur(input); expect(f).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Annie' } }); fireEvent.blur(input);
    expect(f).toHaveBeenCalledWith({ name: 'Annie' });
    fireEvent.click(screen.getByLabelText('Face 3')); expect(f).toHaveBeenCalledWith({ avatar: 2 });
    expect((screen.getByLabelText(PLAYER_COLORS[1]) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(PLAYER_COLORS[2])); expect(f).toHaveBeenCalledWith({ color: PLAYER_COLORS[2] });
  });
});

describe('fitGrid', () => {
  it('shrinks items until they fit and never goes below the minimum', () => {
    const roomy = fitGrid(1000, 800, 5, { slot: 20, gap: 8 });
    const tight = fitGrid(320, 300, 30, { slot: 20, gap: 8 });
    expect(roomy.w).toBeGreaterThan(tight.w);
    expect(roomy.fits).toBe(true);
    expect(tight.w).toBeGreaterThanOrEqual(46);
    expect(fitGrid(10, 10, 100, { slot: 20, gap: 8 }).w).toBe(46);
  });
});

describe('FullscreenButton on a cast TV', () => {
  it('hides itself on the Chromecast receiver', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    const spy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 CrKey/1.56 Chrome/96');
    const { container } = render(<FullscreenButton />);
    expect(container.querySelector('button')).toBeNull();
    spy.mockRestore();
    Object.defineProperty(document, 'fullscreenEnabled', { value: undefined, configurable: true });
  });
});

describe('FullscreenButton', () => {
  it('hides itself where fullscreen is unsupported and shows where it works', () => {
    const { container } = render(<FullscreenButton />);
    expect(container.textContent).toBe('');
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    render(<FullscreenButton />);
    expect(screen.getByTestId('fullscreen').textContent).toBe('Full screen');
  });
});
