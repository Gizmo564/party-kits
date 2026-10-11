/** true on the Chromecast itself: the receiver page runs inside the TV's browser (user agent contains "CrKey"). */
export const isCastReceiver = (nav: { userAgent?: string } | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean =>
  !!nav?.userAgent && /CrKey/.test(nav.userAgent);

/** true where "Show on TV" makes no sense: on the receiver itself, or in a frame (the receiver frames the game's display page). */
export function onCastScreen(win: { navigator?: { userAgent?: string }; self?: unknown; top?: unknown } | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  return isCastReceiver(win.navigator) || (win.self !== undefined && win.self !== win.top);
}
