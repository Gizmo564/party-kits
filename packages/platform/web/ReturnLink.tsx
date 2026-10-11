export const RETURN_URL = 'https://0801564.xyz';

/**
 * "Return to 0801564.xyz": the tilted pill every game shows on its home screen. The look comes from the theme kit
 * (`.return-link`: tilted -1.5deg, straightens and lifts on hover, as in Track Record, Sandwich Slam and Tank, which all use that class).
 * Chameleon still uses its own `.site-link` (FLAGS.md).
 */
export function ReturnLink({ className = '', label = '← Return to 0801564.xyz' }: { className?: string; label?: string }) {
  return <a className={`return-link ${className}`.trim()} href={RETURN_URL}>{label}</a>;
}
