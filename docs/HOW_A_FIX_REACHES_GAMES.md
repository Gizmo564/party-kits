# How a kit fix reaches the games

1. Fix it in `packages/<kit>/`, add or update a test.
2. Bump that package's `version` in its `package.json` (patch for a fix, minor for something new, major for a break). Only the package you changed; each has its own number. If another package must require the new version, raise the range in its `dependencies` too.
3. Open a pull request. CI runs `npm run verify:e2e` (typecheck, every test, a generated game built from the packed tarballs, a real Worker end-to-end run).
4. After merge to `main`, `publish.yml` runs `scripts/publish-changed.mjs`, which publishes every package whose version is not on npm yet.
5. Each game has Renovate (`renovate.json`, from `create-game`) and gets a pull request "Update @gizmo564/<kit>". In the game: read the diff, run `npm test` and `npm run build`, merge, then deploy when you want to.

Nothing reaches a live game until its pull request is merged and the game is deployed. Games pin a range (`^0.1.0`) and commit their lockfile.
