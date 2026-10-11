import { useEffect, useRef, type ReactNode } from 'react';

/** A dialog. Escape and a click on the backdrop close it; focus moves in and returns when it closes. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2>{title}</h2><button className="btn small" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max: number; step?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn small" aria-label={`${label} down`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="stepper-val" aria-live="polite">{value}</span>
      <button type="button" className="btn small" aria-label={`${label} up`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

export function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden />
      <span><b>{label}</b>{hint ? <small className="muted"> {hint}</small> : null}</span>
    </label>
  );
}

/** One-of-N chips (clip length, difficulty, mode...). */
export function Choice<T extends string | number>({ value, options, onChange, label, disabled }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} disabled={disabled} className={`chipbtn${o.value === value ? ' on' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function ColorPicker({ colors, value, taken = [], onPick, label = 'Your color' }: { colors: readonly string[]; value: string; taken?: readonly string[]; onPick: (c: string) => void; label?: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === value} aria-label={c} disabled={taken.includes(c) && c !== value} className={`swatch${c === value ? ' on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}
