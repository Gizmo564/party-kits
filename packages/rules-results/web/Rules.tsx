import { useState, type ReactNode } from 'react';
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
