# @gizmo564/create-game

Makes a new 0801564.xyz party game: a working starter game (engine, Worker + Durable Object, React web app, TV display, pass-the-phone, tests) that installs the `@gizmo564/*` kit packages from npm.

    npx @gizmo564/create-game "Lucky Draw" --dir ~/games/lucky-draw
    cd ~/games/lucky-draw && npm install && npm test && npm run dev:server

Your game depends on the kits by version range (`^0.1.0`). `renovate.json` in the new game opens a pull request whenever a new kit version is released (install the Renovate GitHub App on the game's repo to turn it on).

Testing unreleased packages: `node create-game.mjs "Name" --dir <folder> --local <path to party-kits>`.
