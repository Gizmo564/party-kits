// Anonymous usage counts for the admin panel on 0801564.xyz. `window.track` comes from https://0801564.xyz/a.js
// (see root/index.head.html); it does nothing if that script is missing, on localhost, or when this browser is marked as the owner's.
// The site id in data-site must be in the landing Worker's SITES list (landing/src/stats-core.js).
declare global { interface Window { track?: (type: string, extra?: { n?: number; peak?: number }) => void } }

export function track(type: string, extra?: { n?: number; peak?: number }): void {
  try {
    if (typeof window !== 'undefined' && typeof window.track === 'function') window.track(type, extra);
  } catch { /* analytics must never break the game */ }
}
