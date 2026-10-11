# tv-out

Show the room's TV screen on a **wired (HDMI) display**. A separate, small kit: it does not use or change the Google Cast kit.

- `<WiredTvButton code link? className? noteClassName? />` - put it next to `<CastButton>`, same visibility rule (host's device and host screen).
  - Computer: **Show on wired TV** opens the game's display page (`?room=CODE&role=display&wired=1`) in its own window. In Chrome/Edge with a second
    screen it asks for the browser's multi-screen permission once and moves the window there. Elsewhere it stays a normal window to drag.
  - Phone/tablet: **Open on another device** shows the link (pass `link={(url) => <TvLink url={url} />}` for a QR) for a laptop, Fire Stick or smart-TV browser.
  - Hidden on the Chromecast, in frames, and inside a wired window.
- `initWiredWindow()` - call once in `main.tsx`. In a wired window it adds the `cast` class (existing animations-off CSS applies) and a `wired` class,
  and the first click or key press goes fullscreen (that click also unlocks sound).
- `wiredUrl(origin, code)`, `isWiredWindow()`, `openWiredWindow(url)`, `pickOtherScreen(details)`.

## Notes
- The multi-screen part (`getScreenDetails`, `screen.isExtended`) is Chromium-only as far as we know; it is feature-detected and falls back silently.
- The wired window joins the room as an ordinary host screen. The game's usual music rules decide which screen plays.
