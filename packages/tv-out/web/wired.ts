// "Show on wired TV": open the game's TV screen (the normal display page) in its own window, ideally on the second screen.
// Nothing here touches Google Cast. The page opened is `?room=CODE&role=display&wired=1`.

export const WIRED_PARAM = 'wired';

/** The display link for a wired window or another device. `&wired=1` gives the calmer look (no animations) and the first-click fullscreen. */
export function wiredUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/?room=${encodeURIComponent(code)}&role=display&${WIRED_PARAM}=1`;
}

/** True when this page was opened as a wired display (`&wired=1`). */
export function isWiredWindow(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  try { return new URLSearchParams(search).get(WIRED_PARAM) === '1'; } catch { return false; }
}

export interface ScreenLike { left: number; top: number; width: number; height: number; isPrimary?: boolean }
export interface ScreenDetailsLike { screens: ScreenLike[]; currentScreen: ScreenLike }

/** A screen other than the one this window is on (Window Management API data), or null. */
export function pickOtherScreen(d: ScreenDetailsLike): ScreenLike | null {
  return d.screens.find((s) => s !== d.currentScreen) ?? null;
}

type OpenerWin = {
  open: (url: string, target: string, features: string) => Window | null;
  screen?: { isExtended?: boolean };
  getScreenDetails?: () => Promise<ScreenDetailsLike>;
};

export type OpenResult = { ok: true; placed: boolean } | { ok: false; reason: 'blocked' };

/**
 * Open the wired window. Call this straight from the click: the (blank) window is opened first so pop-up blockers allow it,
 * then, in Chrome/Edge with a second screen, the browser's multi-screen permission is asked once and the window is moved to
 * the other screen. Elsewhere (Safari, Firefox, one screen, permission refused) it stays a normal window to drag.
 */
export async function openWiredWindow(url: string, win: OpenerWin = window as unknown as OpenerWin): Promise<OpenResult> {
  const pop = win.open('about:blank', 'wired-tv', 'popup,width=1280,height=720');
  if (!pop) return { ok: false, reason: 'blocked' };
  try { pop.location.replace(url); } catch { /* same-origin: should not happen */ }
  let placed = false;
  if (win.screen?.isExtended && typeof win.getScreenDetails === 'function') {
    try {
      const other = pickOtherScreen(await win.getScreenDetails());
      if (other) { pop.moveTo(other.left, other.top); pop.resizeTo(other.width, other.height); placed = true; }
    } catch { /* permission refused or unsupported: leave it as a normal window */ }
  }
  try { pop.focus(); } catch { /* ignore */ }
  return { ok: true, placed };
}

/**
 * Call once at startup (main.tsx). In a wired window it:
 *  - adds the `cast` class (the existing animations-off CSS applies; Google Cast code is not involved) and a `wired` class,
 *  - shows a small hint and, on the first click or key press anywhere, goes fullscreen (that same click also unlocks sound).
 * Returns true when this page is a wired window, false (and does nothing) otherwise.
 */
export function initWiredWindow(doc: Document = document, search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  if (!isWiredWindow(search)) return false;
  const root = doc.documentElement;
  root.classList.add('cast', 'wired');
  const hint = doc.createElement('div');
  hint.setAttribute('data-testid', 'wired-hint');
  hint.setAttribute('role', 'status');
  hint.textContent = 'Click anywhere for fullscreen and sound';
  hint.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font:600 14px system-ui,sans-serif;z-index:2147483647;pointer-events:none';
  (doc.body ?? root).appendChild(hint);
  const arm = () => {
    doc.removeEventListener('pointerdown', arm, true);
    doc.removeEventListener('keydown', arm, true);
    hint.remove();
    try { void root.requestFullscreen?.()?.catch?.(() => {}); } catch { /* not allowed: harmless */ }
  };
  doc.addEventListener('pointerdown', arm, true);
  doc.addEventListener('keydown', arm, true);
  return true;
}
