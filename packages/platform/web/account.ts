import { useEffect } from 'react';

export const ME_URL = 'https://0801564.xyz/api/me';

/**
 * The username on the shared 0801564.xyz sign-in, if this browser is signed in there ('' otherwise).
 * Capped at 14 characters (Track Record and Sandwich Slam do; Chameleon uses 20: FLAGS.md). Only used to fill an empty name box; nothing else is read or sent. Needs `connect-src https://0801564.xyz`
 * if the game sets a Content-Security-Policy (see root/_headers).
 */
export async function accountName(max = 14, fetcher: typeof fetch = fetch): Promise<string> {
  try {
    const r = await fetcher(ME_URL, { credentials: 'include' });
    const d = (await r.json()) as { loggedIn?: boolean; username?: unknown };
    return d && d.loggedIn && typeof d.username === 'string' ? d.username.trim().slice(0, max).trim() : '';
  } catch {
    return '';
  }
}

/** Fill an empty name field from the shared sign-in once. Never overwrites something the player typed. */
export function usePrefillName(current: string, set: (name: string) => void, fetcher?: typeof fetch): void {
  useEffect(() => {
    if (current) return;
    let live = true;
    accountName(14, fetcher).then((n) => { if (live && n) set(n); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
