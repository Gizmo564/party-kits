# Migrating an existing game to the packages

Order: Chameleon, then Track Record, then Sandwich Slam (it also moves onto the shared room protocol; separate, larger step). Nothing a player sees should change except what Tanner has agreed.

For each game, on a branch:
1. Install the packages the game's copied code matches (`npm i @gizmo564/join-codes ...`).
2. Replace a game file with the package import only where the file is the same as the kit's, or the kit is the agreed target (see `kits/FLAGS.md` in the site folder for every known difference). Leave a game's own differences alone and write them down.
3. Keep Durable Object class names (`RoomDO`, `IndexDO`) and migration tags exactly as they are in `wrangler.jsonc`.
4. Run the game's typecheck, tests, `vite build` and `wrangler deploy --dry-run`; then a local `wrangler dev` room with three or more clients and `tv-check` on the TV lobby and in-game screens.
5. Compare before/after screenshots of the lobby, TV and results screens at the six TV sizes.
6. Deploy only after Tanner says so.
