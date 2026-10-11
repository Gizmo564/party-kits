# How to add a theme

A theme is one CSS file that sets the shared tokens. Nothing else in the game changes: every kit component reads only tokens.

1. Copy `web/themes/sunrise.css` to `web/themes/<id>.css` (kebab-case id, e.g. `candy-shop`).
2. Change the selector to `html[data-theme="<id>"]` and set the colours. The full vocabulary, and which tokens are required, is in `web/tokens.css`.
3. Add one line to `THEMES` in `web/theme.ts` (`id`, `label`, `swatch`, `chrome`, `dark`, `from`) and one `@import` to `web/index.css`.
4. Run `npx vitest run themes` from `kits/`. It checks that the file is registered, every required token is set, the colour scheme matches `dark`, and that these pairs reach WCAG AA (4.5:1): ink/bg, ink/surface, ink-soft/bg, ink-soft/surface, accent-ink/accent, accent-2-ink/accent-2, good-ink/good, bad-ink/bad, and `--bad-text` and `--link` on bg.

## Rules of thumb
- `--line` is the outline colour on everything you can press; `--shadow-color` is the hard offset shadow. Light themes usually use the ink colour for both; dark themes can use a near-black shadow.
- `--press` should equal the shadow offset in px, so a pressed button lands exactly where its shadow was.
- `--accent-ink` is the text colour ON the accent. Pick whichever of white or your ink passes; the test will tell you.
- `--page-bg` is optional and may be a gradient. `--color-scheme` must be `light` or `dark` so form controls and scrollbars match.
- A game ships only the themes it offers: trim the `@import`s, and pass `only={[...]}` to `ThemePicker`.
- Fonts: `FONTS_HREF` in `theme.ts` loads Fredoka, Nunito, Inter and Baloo 2. If your theme needs another family, add it to that URL and set `--font-display` / `--font-body`.

## The themes that exist (where each came from)
| id | from | notes |
|---|---|---|
| sunrise | Tank Tactics (default), Sandwich Slam | warm cream + coral |
| dusk | Tank Tactics | dark plum + pink |
| forest | Tank Tactics | pale moss + green |
| ocean | Tank Tactics | pale sea + blue |
| blush | Tank Tactics | pale rose + raspberry |
| neon-night | Track Record | indigo + neon, gradient page, near-black outlines |
| pastel-pop | Chameleon | candy pastels, bigger radii and 5px shadows |
| lavender | landing, play | warm white + plum ink + pastel fills |
| lavender-night | landing, play | the dark mode of lavender |

## Where the kit's colours differ from the original game (accessibility)
The originals were not all measured against WCAG AA. Hue was kept; these values were nudged just far enough to pass:

| theme | token | original | kit |
|---|---|---|---|
| sunrise | --good | #3f9e6b | #348459 |
| sunrise, ocean | --bad | #e0553f | #ca4c39 |
| forest | --accent | #3f8f4f | #3a8449 |
| forest, ocean | --good | #2f9e6b | #27855a |
| ocean | --accent | #2596be | #1f7fa1 |
| ocean | --ink-soft | #4d7889 | #44707f |
| blush | --accent | #e0507e | #c84770 |
| blush | --good | #3f9e6b | #348459 |
| blush | --ink-soft | #8a6478 | #7f5a6e |

Values the kit derived (not present in the originals): every `--*-ink`, `--bad-text`, `--link`, `--focus`, `--edge` and `--surface-2` choice, and the pairing of landing's pastel fills onto accent/good/bad. Tank Tactics' own `--accent-text` and `--ink-on-light` map to `--link`/`--bad-text` and `--accent-ink` approximately, not exactly.
Not verified in a browser: only the numeric contrast is tested, not how the themes look.
