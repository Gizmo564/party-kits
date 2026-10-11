import { useEffect, useState } from 'react';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
const doc = () => document as FsDoc;
const isFull = () => !!(doc().fullscreenElement || doc().webkitFullscreenElement);
const supported = () => !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
/** a cast TV (Chromecast receiver, or a page framed by it) is already full screen */
const onCastTv = () => /CrKey/.test(navigator.userAgent || '') || window.self !== window.top;

/** Hides the address bar and tabs. Browsers only allow it from a tap, and iPhone Safari does not support it for web pages, so the button hides itself there. Show it on the host display only; it hides itself on a cast TV, which is already full screen. */
export function FullscreenButton({ className = 'btn small' }: { className?: string }) {
  const [full, setFull] = useState(isFull());
  useEffect(() => {
    const on = () => setFull(isFull());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
  }, []);
  if (!supported() || onCastTv()) return null;
  const toggle = () => {
    const el = document.documentElement as FsEl;
    try {
      if (isFull()) void (doc().exitFullscreen ?? doc().webkitExitFullscreen)?.call(document);
      else void (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    } catch { /* blocked by the browser: nothing to do */ }
  };
  return <button type="button" className={className} onClick={toggle} aria-pressed={full} data-testid="fullscreen">{full ? 'Exit full screen' : 'Full screen'}</button>;
}
