// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, applyTheme, bootScript, isTheme, savedTheme, themeKey } from './theme';
import { ThemePicker } from './ThemePicker';

const here = dirname(fileURLToPath(import.meta.url));
const REQUIRED = ['bg', 'bg-2', 'surface', 'surface-2', 'ink', 'ink-soft', 'line', 'edge', 'accent', 'accent-ink', 'accent-2', 'accent-2-ink',
  'good', 'bad', 'warn', 'focus', 'shadow', 'shadow-sm', 'shadow-color'];
// Required tokens that tokens.css supplies for every theme (shape, type, press); a theme may override them.
const FROM_DEFAULTS = ['border', 'radius', 'radius-lg', 'radius-pill', 'press', 'font-display', 'font-body'];

/** token -> raw value, for one theme file */
function parseTheme(id: string): Record<string, string> {
  const css = readFileSync(join(here, 'themes', `${id}.css`), 'utf8');
  const block = css.match(new RegExp(`html\\[data-theme="${id}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!block) throw new Error(`${id}.css has no html[data-theme="${id}"] block`);
  const out: Record<string, string> = {};
  for (const m of block[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', ''); const f = h.length === 3 ? [...h].map((c: string) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}
function lum(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('theme files', () => {
  it('every file in themes/ is registered and every registered theme has a file', () => {
    const files = readdirSync(join(here, 'themes')).filter((f) => f.endsWith('.css')).map((f) => f.replace('.css', '')).sort();
    expect(files).toEqual(THEMES.map((t) => t.id).sort());
  });
  it('index.css imports every theme', () => {
    const idx = readFileSync(join(here, 'index.css'), 'utf8');
    for (const t of THEMES) expect(idx, t.id).toContain(`./themes/${t.id}.css`);
  });
  for (const t of THEMES) {
    describe(t.id, () => {
      const tok = parseTheme(t.id);
      it('sets every required token', () => {
        for (const name of REQUIRED) expect(tok[name], `--${name}`).toBeTruthy();
      });
      it('uses only token names the vocabulary knows', () => {
        const vocab = readFileSync(join(here, 'tokens.css'), 'utf8');
        for (const name of Object.keys(tok)) expect(vocab.includes(`--${name}`) || ['page-bg', 'color-scheme', 'field-bg', 'link', 'good-ink', 'bad-ink', 'bad-text', 'avatar-ink'].includes(name), `--${name}`).toBe(true);
        for (const name of FROM_DEFAULTS) expect(vocab, name).toContain(`--${name}`);
      });
      it('declares the colour scheme that matches its registry entry', () => {
        expect(tok['color-scheme']).toBe(t.dark ? 'dark' : 'light');
      });
      // WCAG AA for normal text is 4.5:1. These are the pairs the kit puts text on.
      const pairs: Array<[string, string, string]> = [
        ['ink on bg', 'ink', 'bg'], ['ink on surface', 'ink', 'surface'], ['ink-soft on surface', 'ink-soft', 'surface'], ['ink-soft on bg', 'ink-soft', 'bg'],
        ['accent-ink on accent', 'accent-ink', 'accent'], ['accent-2-ink on accent-2', 'accent-2-ink', 'accent-2'],
      ];
      for (const [label, fg, bg] of pairs) {
        it(`contrast: ${label} >= 4.5`, () => {
          const ratio = contrast(tok[fg], tok[bg]);
          expect(ratio, `${t.id} ${label}: ${tok[fg]} on ${tok[bg]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        });
      }
      it('contrast: good-ink / bad-ink on their fills >= 4.5 (falls back to ink)', () => {
        for (const [fill, ink] of [['good', 'good-ink'], ['bad', 'bad-ink']] as const) {
          const r = contrast(tok[ink] ?? tok.ink, tok[fill]);
          expect(r, `${t.id} ${ink} on ${fill} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      });
      it('contrast: error text and links readable on the page >= 4.5', () => {
        for (const k of ['bad-text', 'link']) if (tok[k]) { const r = contrast(tok[k], tok.bg); expect(r, `${t.id} ${k} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5); }
      });
    });
  }
});

describe('runtime', () => {
  afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-theme'); document.head.innerHTML = ''; });
  it('applyTheme sets the attribute, remembers it per game, and colours the browser chrome', () => {
    expect(applyTheme('g1', 'dusk')).toBe('dusk');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dusk');
    expect(localStorage.getItem(themeKey('g1'))).toBe('dusk');
    expect(localStorage.getItem(themeKey('g2'))).toBeNull();
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe('#1c1a24');
  });
  it('unknown or corrupt values fall back instead of breaking', () => {
    expect(applyTheme('g1', 'nope')).toBe('sunrise');
    localStorage.setItem(themeKey('g1'), 'garbage');
    expect(savedTheme('g1')).toBe('sunrise');
    expect(savedTheme('g1', 'ocean')).toBe('ocean');
    expect(isTheme('dusk')).toBe(true); expect(isTheme(5)).toBe(false);
  });
  it('savedTheme returns the stored choice', () => {
    applyTheme('g1', 'forest');
    expect(savedTheme('g1')).toBe('forest');
  });
  it('the boot script sets the saved theme, and the fallback for a missing or bad value', () => {
    const run = () => { document.documentElement.removeAttribute('data-theme'); new Function(bootScript('g1', 'blush'))(); return document.documentElement.getAttribute('data-theme'); };
    expect(run()).toBe('blush');
    localStorage.setItem(themeKey('g1'), 'ocean'); expect(run()).toBe('ocean');
    localStorage.setItem(themeKey('g1'), '<script>'); expect(run()).toBe('blush');
  });
  it('the picker lists themes, marks the current one, switches and reports', () => {
    applyTheme('g1', 'ocean');
    const seen: string[] = [];
    render(<ThemePicker game="g1" only={['sunrise', 'ocean', 'dusk']} onChange={(id) => seen.push(id)} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByLabelText('Ocean').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByLabelText('Dusk'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dusk');
    expect(screen.getByLabelText('Dusk').getAttribute('aria-checked')).toBe('true');
    expect(seen).toEqual(['dusk']);
  });
});
