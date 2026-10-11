// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initWiredWindow, isWiredWindow, openWiredWindow, pickOtherScreen, wiredUrl } from './wired';
import { WiredTvButton } from './WiredTvButton';

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.className = ''; document.body.innerHTML = ''; });

const fakePopup = () => ({ location: { replace: vi.fn() }, moveTo: vi.fn(), resizeTo: vi.fn(), focus: vi.fn() });

describe('urls', () => {
  it('builds the display link with the wired flag', () => {
    expect(wiredUrl('https://chameleon.0801564.xyz/', 'AB12')).toBe('https://chameleon.0801564.xyz/?room=AB12&role=display&wired=1');
  });
  it('knows a wired window', () => {
    expect(isWiredWindow('?room=AB12&role=display&wired=1')).toBe(true);
    expect(isWiredWindow('?room=AB12&role=display&cast=1')).toBe(false);
    expect(isWiredWindow('')).toBe(false);
  });
});

describe('pickOtherScreen', () => {
  it('returns a screen that is not the current one', () => {
    const a = { left: 0, top: 0, width: 1440, height: 900 }, b = { left: 1440, top: 0, width: 1920, height: 1080 };
    expect(pickOtherScreen({ screens: [a, b], currentScreen: a })).toBe(b);
    expect(pickOtherScreen({ screens: [a], currentScreen: a })).toBeNull();
  });
});

describe('openWiredWindow', () => {
  it('reports a blocked pop-up', async () => {
    expect(await openWiredWindow('u', { open: () => null })).toEqual({ ok: false, reason: 'blocked' });
  });
  it('opens the window synchronously, then moves it to the other screen when the browser allows', async () => {
    const pop = fakePopup(); const a = { left: 0, top: 0, width: 1, height: 1 }, b = { left: 1440, top: 10, width: 1920, height: 1080 };
    const open = vi.fn(() => pop as unknown as Window);
    const p = openWiredWindow('https://x/?room=A', { open, screen: { isExtended: true }, getScreenDetails: async () => ({ screens: [a, b], currentScreen: a }) });
    expect(open).toHaveBeenCalledTimes(1);
    expect(await p).toEqual({ ok: true, placed: true });
    expect(pop.location.replace).toHaveBeenCalledWith('https://x/?room=A');
    expect(pop.moveTo).toHaveBeenCalledWith(1440, 10);
    expect(pop.resizeTo).toHaveBeenCalledWith(1920, 1080);
  });
  it('stays a normal window with one screen, no support, or a refused permission', async () => {
    const mk = (extra: object) => { const pop = fakePopup(); return { pop, win: { open: () => pop as unknown as Window, ...extra } }; };
    let t = mk({ screen: { isExtended: false } });
    expect(await openWiredWindow('u', t.win)).toEqual({ ok: true, placed: false }); expect(t.pop.moveTo).not.toHaveBeenCalled();
    t = mk({});
    expect(await openWiredWindow('u', t.win)).toEqual({ ok: true, placed: false });
    t = mk({ screen: { isExtended: true }, getScreenDetails: async () => { throw new Error('denied'); } });
    expect(await openWiredWindow('u', t.win)).toEqual({ ok: true, placed: false }); expect(t.pop.moveTo).not.toHaveBeenCalled();
  });
});

describe('initWiredWindow', () => {
  it('does nothing on a normal page', () => {
    expect(initWiredWindow(document, '?room=A&role=display&cast=1')).toBe(false);
    expect(document.documentElement.classList.contains('cast')).toBe(false);
    expect(document.querySelector('[data-testid=wired-hint]')).toBeNull();
  });
  it('adds the calm look and goes fullscreen on the first click', () => {
    const fs = vi.fn(() => Promise.resolve());
    (document.documentElement as unknown as { requestFullscreen: unknown }).requestFullscreen = fs;
    expect(initWiredWindow(document, '?room=A&role=display&wired=1')).toBe(true);
    expect(document.documentElement.classList.contains('cast')).toBe(true);
    expect(document.documentElement.classList.contains('wired')).toBe(true);
    expect(document.querySelector('[data-testid=wired-hint]')).not.toBeNull();
    document.dispatchEvent(new Event('pointerdown'));
    expect(fs).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid=wired-hint]')).toBeNull();
    document.dispatchEvent(new Event('pointerdown'));
    expect(fs).toHaveBeenCalledTimes(1);
  });
});

describe('<WiredTvButton>', () => {
  // jsdom has no matchMedia, so define it
  const touch = (on: boolean) => { Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (q: string) => ({ matches: on && q.includes('pointer: coarse'), media: q, addEventListener() {}, removeEventListener() {} }) }); };

  it('opens the wired window from the button on a computer, and says what to do', async () => {
    touch(false);
    const pop = fakePopup(); const open = vi.spyOn(window, 'open').mockReturnValue(pop as unknown as Window);
    render(<WiredTvButton code="AB12" />);
    fireEvent.click(screen.getByTestId('wired-tv-btn'));
    expect(open).toHaveBeenCalledWith('about:blank', 'wired-tv', expect.any(String));
    await waitFor(() => expect(screen.getByTestId('wired-note').textContent).toMatch(/Drag the new window/));
    expect(pop.location.replace).toHaveBeenCalledWith(`${location.origin}/?room=AB12&role=display&wired=1`);
  });
  it('explains a blocked pop-up', async () => {
    touch(false); vi.spyOn(window, 'open').mockReturnValue(null);
    render(<WiredTvButton code="AB12" />);
    fireEvent.click(screen.getByTestId('wired-tv-btn'));
    await waitFor(() => expect(screen.getByTestId('wired-note').textContent).toMatch(/blocked/));
  });
  it('on a phone offers the link for another device', () => {
    touch(true);
    render(<WiredTvButton code="AB12" link={(u) => <i data-testid="mylink">{u}</i>} />);
    expect(screen.queryByTestId('wired-tv-btn')).toBeNull();
    expect(screen.queryByTestId('mylink')).toBeNull();
    fireEvent.click(screen.getByTestId('other-device-btn'));
    expect(screen.getByTestId('mylink').textContent).toBe(`${location.origin}/?room=AB12&role=display&wired=1`);
  });
  it('shows the link as text on a phone when no link renderer is passed', () => {
    touch(true);
    render(<WiredTvButton code="AB12" />);
    fireEvent.click(screen.getByTestId('other-device-btn'));
    expect(screen.getByTestId('wired-link').textContent).toMatch(/room=AB12&role=display&wired=1/);
  });
  it('is hidden on the Chromecast and inside a wired window', () => {
    touch(false);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 CrKey/1.56 Safari');
    const { container, unmount } = render(<WiredTvButton code="AB12" />);
    expect(container.innerHTML).toBe(''); unmount();
    vi.restoreAllMocks(); touch(false);
    history.replaceState(null, '', '/?room=AB12&role=display&wired=1');
    const r = render(<WiredTvButton code="AB12" />);
    expect(r.container.innerHTML).toBe('');
    history.replaceState(null, '', '/');
  });
});
