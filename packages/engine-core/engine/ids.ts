// Ids and secret tokens. The three existing games build tokens from Math.random(); this uses the Web Crypto API
// (available in Workers, browsers and Node), so a session token cannot be guessed from other tokens.
const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALNUM[b % ALNUM.length];
  return out;
}

/** A secret that proves "I am this member" when a socket reconnects. Never sent to anyone but its owner. */
export const newToken = (): string => randomString(32);

/** A short public id for a member, unique within the room: `p3k9x`. */
export function newMemberId(existing: Iterable<string> = [], prefix = 'p'): string {
  const taken = new Set(existing);
  for (let i = 0; i < 50; i++) { const id = prefix + randomString(5); if (!taken.has(id)) return id; }
  throw new Error('could not make a unique id');
}
