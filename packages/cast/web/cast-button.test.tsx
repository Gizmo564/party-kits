// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { isCastReceiver, onCastScreen } from './receiver';

let failed = false;
vi.mock('./sender', async (orig) => {
  const real = await orig<typeof import('./sender')>();
  const caster = { view: () => ({ state: failed ? 'failed' : 'ready', device: '' }), subscribe: () => () => {}, start: async () => {}, stop: () => {}, sync: () => {} };
  return { ...real, getCaster: () => ({ caster, setCode: () => {} }) };
});
import { CastButton } from './CastButton';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('isCastReceiver / onCastScreen', () => {
  it('knows the Chromecast user agent', () => {
    expect(isCastReceiver({ userAgent: 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 Chrome/96 CrKey/1.56.500000 Safari/537.36' })).toBe(true);
    expect(isCastReceiver({ userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36' })).toBe(false);
    expect(isCastReceiver(undefined)).toBe(false);
    expect(isCastReceiver({})).toBe(false);
  });
  it('treats being inside a frame as a cast screen (the receiver frames the display page)', () => {
    const top = {};
    expect(onCastScreen({ navigator: { userAgent: 'Chrome' }, self: {}, top })).toBe(true);
    const win = {}; expect(onCastScreen({ navigator: { userAgent: 'Chrome' }, self: win, top: win })).toBe(false);
    expect(onCastScreen(undefined)).toBe(false);
  });
});

describe('CastButton', () => {
  it('shows Show on TV on a normal browser (host phone or host display)', () => {
    render(<CastButton game="g" code="ABCD" />);
    expect(screen.getByTestId('cast-btn').textContent).toBe('Show on TV');
  });
  it('hides itself on the Chromecast receiver', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 CrKey/1.56 Chrome/96');
    render(<CastButton game="g" code="ABCD" />);
    expect(screen.queryByTestId('cast-btn')).toBeNull();
  });
  it('after a failed cast shows the message and the fallback (TV link + QR)', () => {
    failed = true;
    render(<CastButton game="g" code="ABCD" fallback={<i data-testid="fb">link</i>} />);
    expect(screen.getByTestId('cast-btn').textContent).toBe('Try again');
    expect(screen.getByTestId('cast-failed')).toBeTruthy();
    expect(screen.getByTestId('fb')).toBeTruthy();
    failed = false;
  });
});
