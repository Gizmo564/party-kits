// Theme registry + runtime. A theme is a CSS file in ./themes that sets the tokens in tokens.css under
// html[data-theme="<id>"]. This file lists them so the picker, the saved choice and the boot script agree.
//
// To add a theme: see ../HOW_TO_ADD_A_THEME.md (one CSS file + one line in THEMES below).

export interface ThemeInfo {
  id: string;
  label: string;
  /** a colour for the picker dot (normally the theme's --accent) */
  swatch: string;
  /** colour of the browser chrome (<meta name="theme-color">) */
  chrome: string;
  dark: boolean;
  /** where it came from, for the record */
  from: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'sunrise', label: 'Sunrise', swatch: '#ff6b4a', chrome: '#faf3e6', dark: false, from: 'Tank Tactics, Sandwich Slam' },
  { id: 'dusk', label: 'Dusk', swatch: '#c23f7c', chrome: '#1c1a24', dark: true, from: 'Tank Tactics' },
  { id: 'forest', label: 'Forest', swatch: '#3f8f4f', chrome: '#eef3e4', dark: false, from: 'Tank Tactics' },
  { id: 'ocean', label: 'Ocean', swatch: '#2596be', chrome: '#e8f2f5', dark: false, from: 'Tank Tactics' },
  { id: 'blush', label: 'Blush', swatch: '#e0507e', chrome: '#faeef2', dark: false, from: 'Tank Tactics' },
  { id: 'neon-night', label: 'Neon night', swatch: '#ff3df2', chrome: '#0b0820', dark: true, from: 'Track Record' },
  { id: 'pastel-pop', label: 'Pastel pop', swatch: '#ff9eb0', chrome: '#fff6e3', dark: false, from: 'Chameleon' },
  { id: 'lavender', label: 'Lavender', swatch: '#d9ccff', chrome: '#fff8ee', dark: false, from: 'landing, play' },
  { id: 'lavender-night', label: 'Lavender night', swatch: '#d9ccff', chrome: '#2a2038', dark: true, from: 'landing, play' },
];

export const DEFAULT_THEME = 'sunrise';

/** The localStorage key. Each game passes its own so one game's choice never changes another's (Tank used `tt_theme`). */
export const themeKey = (game: string) => `${game}_theme`;

function store(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

export function isTheme(id: unknown): id is string { return typeof id === 'string' && THEMES.some((t) => t.id === id); }
export const themeInfo = (id: string): ThemeInfo => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;

/** The saved theme, else `fallback`, else the default. */
export function savedTheme(game: string, fallback: string = DEFAULT_THEME): string {
  try {
    const v = store()?.getItem(themeKey(game));
    if (isTheme(v)) return v;
  } catch { /* storage blocked: fall through */ }
  return isTheme(fallback) ? fallback : DEFAULT_THEME;
}

/** Put a theme on the page, remember it, and colour the browser chrome. Unknown ids fall back to the default. */
export function applyTheme(game: string, id: string, persist = true): string {
  const t = themeInfo(id);
  if (typeof document === 'undefined') return t.id;
  document.documentElement.setAttribute('data-theme', t.id);
  if (persist) { try { store()?.setItem(themeKey(game), t.id); } catch { /* private mode: just won't persist */ } }
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'theme-color'); document.head.appendChild(meta); }
  meta.setAttribute('content', t.chrome);
  return t.id;
}

/**
 * Inline this in index.html <head> (before the stylesheet) so the right theme paints on the first frame, no flash:
 *   <script>{output of bootScript('my-game')}</script>
 * It only reads storage and sets the attribute; applyTheme() does the rest once React is up.
 */
export function bootScript(game: string, fallback: string = DEFAULT_THEME): string {
  const ids = JSON.stringify(THEMES.map((t) => t.id));
  return `try{var t=localStorage.getItem(${JSON.stringify(themeKey(game))});if(${ids}.indexOf(t)<0)t=${JSON.stringify(fallback)};document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(fallback)})}`;
}

/** The Google Fonts stylesheet every house theme needs (Fredoka, Nunito, Inter, Baloo 2). Add it once to index.html. */
export const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Nunito:wght@400;600;700&display=swap';
