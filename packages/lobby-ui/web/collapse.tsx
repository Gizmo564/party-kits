import { useId, useState, type ReactNode } from 'react';

/**
 * A panel that is closed until tapped, with a one-line summary of what is inside, so a long settings page stays short and the
 * buttons stay in reach ("Game setup  ·  Rounds 3 · Timer 20 s  ▾"). Uses the `.panel` look of the page it sits in.
 */
export function Collapsible({ title, summary, defaultOpen = false, icon, children, className = '', testId }: {
  title: string;
  /** shown on the closed header, right of the title (one short line; it is cut off with … when long) */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** a small picture before the title (your face, a pack icon...) */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`panel collapsible${open ? ' open' : ''}${className ? ` ${className}` : ''}`} data-testid={testId}>
      <button type="button" className="collapsible-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon ? <span className="collapsible-icon" aria-hidden>{icon}</span> : null}
        <span className="collapsible-title">{title}</span>
        {summary ? <span className="collapsible-summary">{summary}</span> : <span className="grow" />}
        <span className="collapsible-chev" aria-hidden>▾</span>
      </button>
      <div id={id} className="collapsible-body" hidden={!open}>{children}</div>
    </section>
  );
}

/** A small "i" button that shows a sentence when tapped: where explanations, tips and notes go so they do not crowd the buttons. */
export function Hint({ children, label = 'More info', className = '' }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={`hint${className ? ` ${className}` : ''}`}>
      <button type="button" className="hint-btn" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>i</button>
      {open ? <span id={id} role="note" className="hint-text">{children}</span> : null}
    </span>
  );
}

/** A bar pinned to the bottom of the screen for the main button (Start game, Next...), so it never scrolls out of reach. */
export function StickyBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`stickybar${className ? ` ${className}` : ''}`} data-testid="stickybar">{children}</div>;
}
