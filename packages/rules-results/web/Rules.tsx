import { Fragment, useState, type ReactNode } from 'react';
import { Modal } from '@gizmo564/lobby-ui/web/controls';

export interface RuleSection { title: string; body: ReactNode }

/** The full rules in a dialog. Sections are plain content, so a game can include card art or tables. */
export function RulesModal({ title = 'How to play', sections, onClose }: { title?: string; sections: RuleSection[]; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        {sections.map((s) => <section key={s.title}><h3>{s.title}</h3><div>{s.body}</div></section>)}
      </div>
    </Modal>
  );
}

/** A button that opens the rules. */
export function RulesButton({ sections, label = 'How to play', className = 'btn small' }: { sections: RuleSection[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open ? <RulesModal sections={sections} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * The rules as a full page (not a dialog): a Back button, the title, and the sections as headings + content, then anything
 * extra as `children` (a "show the tour again" button, a card table...). `head` replaces the whole top row (for a game with its own
 * header art; it then provides its own Back button), `className` the page wrapper.
 */
export function RulesPage({ title = 'How to play', sections = [], onBack, backLabel = '← Back', head, className = 'page rules', children }: {
  title?: string; sections?: RuleSection[]; onBack?: () => void; backLabel?: string; head?: ReactNode; className?: string; children?: ReactNode;
}) {
  return (
    <div className={className} data-testid="rules-page">
      {head ?? (
        <div className="row between">
          {onBack ? <button className="btn small" onClick={onBack}>{backLabel}</button> : <span />}
          <h1 className="h-lg">{title}</h1>
          <span />
        </div>
      )}
      {sections.length ? (
        <section className="panel stack">
          {sections.map((s) => <Fragment key={s.title}><h2>{s.title}</h2>{s.body}</Fragment>)}
        </section>
      ) : null}
      {children}
    </div>
  );
}
