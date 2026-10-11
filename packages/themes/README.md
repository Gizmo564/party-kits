# themes: tokens, house mechanics, nine themes

- `web/tokens.css`: the token vocabulary (and fallback values).
- `web/base.css`: the mechanics (press-in `.btn`, `.panel`, `.chip`, `.field`, `.toggle`, `.stepper`, `.modal`, `.toast`, `.scoreboard`, `.cover`...). Names no colour.
- `web/themes/*.css`: one file per look. `web/index.css` imports everything.
- `web/theme.ts`: registry, `savedTheme`, `applyTheme`, `bootScript` (no flash on load), `FONTS_HREF`.
- `web/ThemePicker.tsx`: swatch row.

```ts
import './kit/themes/index.css';
import { applyTheme, savedTheme } from './kit/themes/theme';
applyTheme('my-game', savedTheme('my-game'));        // namespaced so games don't share a choice
```
```html
<!-- index.html <head>: paints the right theme on the first frame -->
<link href="…FONTS_HREF…" rel="stylesheet">
<script>/* paste bootScript('my-game') output */</script>
```
Add a look: `HOW_TO_ADD_A_THEME.md`.
