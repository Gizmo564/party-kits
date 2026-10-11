import type { ReactNode } from 'react';
import { Collapsible } from '@gizmo564/lobby-ui/web/collapse';
import { Choice, Stepper, Toggle } from '@gizmo564/lobby-ui/web/controls';

/**
 * Schema-driven game settings. Describe the fields once; the form renders them for the host and shows the same
 * values read-only for everyone else. The server's GameLogic.cleanSettings is the real validator: this form only
 * offers legal values, it never decides what is legal.
 * Each section is a Collapsible: closed it shows a one-line summary of its values ("Rounds 3 · Turn timer: 20 seconds"), so the lobby stays short.
 */
export type FieldDef<S> = { key: keyof S & string; label: string; hint?: string; when?: (s: S) => boolean } & (
  | { kind: 'toggle' }
  | { kind: 'stepper'; min: number; max: number; step?: number; format?: (n: number) => string }
  | { kind: 'choice'; options: { value: string | number; label: string }[] });

export interface SectionDef<S> {
  title: string; note?: string; fields: FieldDef<S>[]; when?: (s: S) => boolean;
  /** start open (default closed) */
  defaultOpen?: boolean;
  /** the closed header's summary; the default lists the section's values */
  summary?: (s: S) => string;
}

/** "Rounds 3 · Turn timer: 20 seconds · Fast mode": what a section currently says, in one line. */
export function summarize<S extends Record<string, any>>(sec: SectionDef<S>, settings: S): string {
  const parts: string[] = [];
  for (const f of sec.fields) {
    if (f.when && !f.when(settings)) continue;
    const v = settings[f.key];
    if (f.kind === 'toggle') { if (v) parts.push(f.label); }
    else if (f.kind === 'stepper') parts.push(`${f.label} ${f.format ? f.format(Number(v)) : v}`);
    else parts.push(`${f.label}: ${f.options.find((o) => o.value === v)?.label ?? v}`);
  }
  return parts.join(' · ');
}

export function SettingsForm<S extends Record<string, any>>({ sections, settings, onChange, disabled, footer }: {
  sections: SectionDef<S>[]; settings: S; onChange: (patch: Partial<S>) => void; disabled?: boolean; footer?: ReactNode;
}) {
  return (
    <fieldset className="plain" disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.filter((sec) => !sec.when || sec.when(settings)).map((sec) => (
        <Collapsible key={sec.title} title={sec.title} summary={sec.summary ? sec.summary(settings) : summarize(sec, settings)} defaultOpen={sec.defaultOpen}>
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
        </Collapsible>
      ))}
      {footer}
    </fieldset>
  );
}
