// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PassCover, PassGate } from './index';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const cover = (ready: () => void) => <PassCover name="Ann" color="#ff9fb2" since={['Bo played 7']} onReady={ready} menu={<button>Leave</button>} />;
const gate = (props: Partial<Parameters<typeof PassGate>[0]> = {}) => (
  <PassGate turnKey="t1" isPrivatePhase cover={cover} {...props}><p>secret hand</p></PassGate>
);
const hide = (state: 'hidden' | 'visible') => { Object.defineProperty(document, 'visibilityState', { value: state, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };

describe('PassCover', () => {
  it('names who is next, shows what happened, and has the menu', () => {
    render(cover(() => undefined));
    expect(screen.getByText('Pass the phone to Ann')).toBeTruthy(); expect(screen.getByText('Bo played 7')).toBeTruthy(); expect(screen.getByText('Leave')).toBeTruthy();
    expect(screen.getByTestId('cover-ready').textContent).toBe("I'm Ann: show my turn");
  });
});

describe('PassGate', () => {
  it('hides the private screen until the ready tap, and calls onReady/onChange', () => {
    const onReady = vi.fn(), onChange = vi.fn();
    render(gate({ onReady, onChange }));
    expect(screen.queryByText('secret hand')).toBeNull();
    fireEvent.click(screen.getByTestId('cover-ready'));
    expect(screen.getByText('secret hand')).toBeTruthy();
    expect(onReady).toHaveBeenCalled(); expect(onChange).toHaveBeenCalledWith({ confirmedKey: 't1' });
  });
  it('covers again on the next turn, but never covers a public phase', () => {
    const { rerender } = render(gate());
    fireEvent.click(screen.getByTestId('cover-ready'));
    rerender(gate({ turnKey: 't2' })); expect(screen.queryByText('secret hand')).toBeNull();
    rerender(gate({ turnKey: 't2', isPrivatePhase: false })); expect(screen.getByText('secret hand')).toBeTruthy();
  });
  it('a saved confirmation survives a reload (mount)', () => {
    render(gate({ saved: { confirmedKey: 't1' } }));
    expect(screen.getByText('secret hand')).toBeTruthy();
  });
  it('re-covers when the tab is hidden (phone locked)', () => {
    render(gate());
    fireEvent.click(screen.getByTestId('cover-ready')); expect(screen.getByText('secret hand')).toBeTruthy();
    act(() => hide('hidden'));
    expect(screen.queryByText('secret hand')).toBeNull();
    act(() => hide('visible'));
  });
  it('re-covers after idle, and any touch restarts the idle clock', () => {
    vi.useFakeTimers();
    render(gate({ idleCoverMs: 1000 }));
    fireEvent.click(screen.getByTestId('cover-ready'));
    act(() => { vi.advanceTimersByTime(800); });
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText('secret hand')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText('secret hand')).toBeNull();
  });
  it('idleCoverMs 0 never re-covers by itself', () => {
    vi.useFakeTimers();
    render(gate({ idleCoverMs: 0 }));
    fireEvent.click(screen.getByTestId('cover-ready'));
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(screen.getByText('secret hand')).toBeTruthy();
  });
});
