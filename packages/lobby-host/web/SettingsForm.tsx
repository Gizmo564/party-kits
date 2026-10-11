import type { ReactNode } from 'react';
import { Choice, Stepper, Toggle } from '@gizmo564/lobby-ui/web/controls';

/**
 * Schema-driven game settings. Describe the fields once; the form renders them for the host and shows the same
 * values read-only for everyone else. The server's GameLogic.cleanSettings is the real validator: this form only
 * offers legal values, it never decides what is legal.
 */
export type FieldDef<S> = { key: keyof S & string; label: string; hint?: string; when?: (s: S) => boolean } & (
  | { kind: 'toggle' }
  | { kind: 'stepper'; min: number; max: number; step?: number; format?: (n: number) => string }
  | { kind: 'choice'; options: { value: string | number; label: string }[] }
);
export interface SectionDef<S> { title: string; note?: string; fields: FieldDef<S>[]; when?: (s: S) => boolean }

export function SettingsForm<S extends Record<string, any>>({ sections, settings, onChange, disabled, footer }: {
  sections: SectionDef<S>[]; settings: S; onChange: (patch: Partial<S>) => void; disabled?: boolean; footer?: ReactNode;
}) {
  return (
    <fieldset className="plain" disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {sections.filter((sec) => !sec.when || sec.when(settings)).map((sec) => (
        <section className="panel" key={sec.title}>
          <h2>{sec.title}</h2>
          {sec.fields.filter((f) => !f.when || f.when(settings)).map((f) => {
            const v = settings[f.key];
            const set = (x: unknown) => onChange({ [f.key]: x } as Partial<S>);
            if (f.kind === 'toggle') return <Toggle key={f.key} on={!!v} onChange={set} label={f.label} hint={f.hint} disabled={disabled} />;
            if (f.kind === 'stepper') {
              return (
                <div className="row between" key={f.key}>
                  <span><b>{f.label}</b>{f.hint ? <small className="muted"> {f.hint}</small> : null}</span>
                  <Stepper label={f.label} value={Number(v)} min={f.min} max={f.max} step={f.step} onChange={set} />
                </div>
              );
            }
            return (
              <div className="stack" key={f.key}>
                <span><b>{f.label}</b>{f.hint ? <small className="muted"> {f.hint}</small> : null}</span>
                <Choice label={f.label} value={v as string | number} options={f.options} onChange={set} disabled={disabled} />
              </div>
            );
          })}
          {sec.note ? <p className="muted">{sec.note}</p> : null}
        </section>
      ))}
      {footer}
    </fieldset>
  );
}
