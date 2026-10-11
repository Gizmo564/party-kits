# Publishing (not done yet)

Needs, in this order:
1. An npm account/organization named `gizmo564` (the `@gizmo564` scope). **Not checked that the name is free.**
2. An npm automation token saved as the GitHub secret `NPM_TOKEN` on the repo that holds this code.
3. A review of every package for anything private before the first publish: the packages are public. A pattern scan found nothing, which is not a guarantee.
4. A license decision: no `license` field is set in the packages yet.
5. The first publish: `node scripts/publish-changed.mjs --dry` to see the list, then merge to `main` (or run it with `NODE_AUTH_TOKEN` set).
6. Install the Renovate GitHub App on each game repo so `renovate.json` opens update pull requests.
`.github/workflows/*.yml` were written but never run (this repo has not been pushed).
