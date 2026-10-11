import { useState } from 'react';
import { THEMES, applyTheme, savedTheme } from './theme';

/** A row of swatch buttons. `game` namespaces the saved choice. `only` limits the list for games that offer fewer themes. */
export function ThemePicker({ game, only, onChange }: { game: string; only?: string[]; onChange?: (id: string) => void }) {
  const [cur, setCur] = useState(() => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || savedTheme(game));
  const list = only ? THEMES.filter((t) => only.includes(t.id)) : THEMES;
  return (
    <div className="swatches" role="radiogroup" aria-label="Color theme">
      {list.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={t.id === cur} aria-label={t.label} title={t.label}
          className={`swatch${t.id === cur ? ' on' : ''}`} style={{ background: t.swatch }}
          onClick={() => { setCur(applyTheme(game, t.id)); onChange?.(t.id); }} />
      ))}
    </div>
  );
}
