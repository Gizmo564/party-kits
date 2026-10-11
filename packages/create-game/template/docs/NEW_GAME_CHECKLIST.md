# New game checklist

What has to happen outside the game's own folder before a new party game works on 0801564.xyz. Every item here is a
place that today holds its own hand-written list of games; the kits cannot do them for you because they live in
`landing`, `play` and `cast` (see FLAGS.md: the lists should eventually come from the shared roster).

## 1. Pick the identity
- [ ] Id (kebab-case), name, subdomain (`<name>.0801564.xyz`), a short site id for analytics.
- [ ] A block of first letters for room codes (join-codes README). All 24 letters are taken today.

## 2. Register the game in the shared places
- [ ] **Join roster**: add the game to `kits/join-codes/engine/manifest.json` (status `reserved` until it works), then
      `npm run sync` + `npx wrangler deploy` in `play` (then `node kits/scripts/sync-roster.mjs --check`), and `npm run deploy` in `cast`.
- [ ] **Landing admin "End all party games"**: add the game to `PARTY_GAMES` in `landing/src/worker.js` (id, name, origin).
- [ ] **Analytics allow-list**: add the site id to `SITES` in `landing/src/stats-core.js`. Events from an unknown site are dropped silently.
- [ ] **Landing tile**: add it in the admin panel (title, image, subdomain shortcut). Track Record ships art in `landing-tile/`.
- [ ] Redeploy every live game whose letter block changed (each carries a copy of the roster).

## 3. Secrets and variables on the game's Worker
- [ ] `ADMIN_KEY`: the same value as on the landing Worker (`npx wrangler secret put ADMIN_KEY`). Without it "End all" refuses.
- [ ] `STATS_URL` var = `https://0801564.xyz/api/event` (wrangler.jsonc). Left unset in local dev, so local runs never count.
- [ ] `NAP_URL` is optional; the default is the live guard. `global_fetch_strictly_public` must be in the compatibility flags.
- [ ] A `routes` entry with `custom_domain: true` for the subdomain.

## 4. In the game
- [ ] `index.html` from `platform/root/index.head.html`: icons, theme boot script, the `a.js` tag with the right `data-site`.
- [ ] `public/_headers` from the platform kit, then watch the browser console once for blocked requests.
- [ ] Icons: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png (transparent, cropped to fill their canvas).
- [ ] Lobby QR points at `ROSTER.shareUrl(code)` (the shared join page), not at the game directly.
- [ ] Front menu in the shared wording: Host Online / Pass and Play / How to Play / Sound: on|off, a Resume or Rejoin button only when there is something to go back to, and "Trying to join a game? Go to play.0801564.xyz" (no code box: joining lives on play). Name prefilled from the shared sign-in (`usePrefillName`), "Return to 0801564.xyz" link.
- [ ] Join links handled: `?room=CODE` (asks for a name, or joins at once with `&name=`), `&role=display` (TV), `&role=audience` (spectator).

## 5. Before telling anyone
- [ ] `npm run typecheck && npm test`
- [ ] `vite build`, then `wrangler dev` (restart it after every build: `vite build` empties `dist` and the dev server answers 404).
- [ ] Two phones and a TV: host on a phone, join on the other, attach a display, finish a game, play again.
- [ ] Tab hidden / phone locked / Wi-Fi off for 10 s on a player: the player comes back to the same seat.
- [ ] Look at 390 px wide and 1920x1080.
- [ ] Set the roster status to `live`, redeploy `play` and `cast`.
