import { useState, type ReactNode } from 'react';
import { isWiredWindow, openWiredWindow, wiredUrl } from './wired';

const onChromecast = () => typeof navigator !== 'undefined' && /CrKey/.test(navigator.userAgent || '');
const inFrame = () => typeof window !== 'undefined' && window.self !== window.top;
const isTouch = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;

/**
 * Put next to the Cast button, with the same visibility rule (the host's device and the host screen, lobby and game).
 *  - Computer: "Show on wired TV" opens the TV screen in its own window (on the second screen in Chrome/Edge).
 *  - Phone or tablet: "Open on another device" shows the link (and QR, if you pass `link`) to open on whatever is plugged into the TV.
 * Hidden on the Chromecast, in frames, and inside a wired window itself. Does not use or change the cast kit.
 */
export function WiredTvButton({ code, className = '', noteClassName = '', link, origin }: {
  code: string;
  className?: string;
  noteClassName?: string;
  /** phones: render the link for the other device, e.g. your TvLink with a QR. Receives the display URL. Without it the URL is shown as text. */
  link?: (url: string) => ReactNode;
  /** defaults to this page's origin */
  origin?: string;
}) {
  const [note, setNote] = useState<'' | 'blocked' | 'drag' | 'placed'>('');
  const [showLink, setShowLink] = useState(false);
  if (isWiredWindow() || inFrame() || onChromecast()) return null;
  const url = wiredUrl(origin ?? (typeof location === 'undefined' ? '' : location.origin), code);

  if (isTouch()) {
    return (
      <>
        <button type="button" className={className} data-testid="other-device-btn" onClick={() => setShowLink((v) => !v)}>
          {showLink ? 'Hide the link' : 'Open on another device'}
        </button>
        {showLink ? (link ? link(url) : <small className={noteClassName} data-testid="wired-link" style={{ wordBreak: 'break-all' }}>{url.replace(/^https?:\/\//, '')}</small>) : null}
      </>
    );
  }

  return (
    <>
      <button type="button" className={className} data-testid="wired-tv-btn" onClick={() => { void openWiredWindow(url).then((r) => setNote(!r.ok ? 'blocked' : r.placed ? 'placed' : 'drag')); }}>
        Show on wired TV
      </button>
      {note ? (
        <small className={noteClassName} data-testid="wired-note" role="status">
          {note === 'blocked' ? 'Your browser blocked the window. Allow pop-ups for this site and try again.'
            : note === 'placed' ? 'Opened on your other screen. Click in it for fullscreen and sound.'
            : 'Drag the new window to your TV, then click in it for fullscreen and sound.'}
        </small>
      ) : null}
    </>
  );
}
