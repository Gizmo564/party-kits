/** The result shape every engine and room function uses: no exceptions for "that move is not allowed".
 *  `Result<T>` carries a value on success; `Status` is the same thing with no value. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Status = { ok: true } | { ok: false; error: string };

export const OK = { ok: true } as const;
export const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });
export const good = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** One step of a game: the new state and the events that explain what happened (for animations and logs). */
export interface Step<S, E> { state: S; events: E[] }
