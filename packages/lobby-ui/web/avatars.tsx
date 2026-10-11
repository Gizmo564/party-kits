// Player avatars: 3 heads x 7 faces = 21 looks, one 1.5px stroke style, tinted with the member's color.
// (Built from the rounded head + ear cups of the "mage--robot" icons with the antennae removed. Same art as Track Record.)
// The stroke colour comes from --avatar-ink so every theme can set it; it falls back to a dark ink.
const FACES: Record<string, string> = {
  neutral: 'm-12.3 4.45v2.698m6.15-2.698v2.698M9.94 15.588h4.1',
  happy: 'M9.95 15.237a2.91 2.91 0 0 0 4.1 0m-6.17-4.262L8.903 9.95l1.025 1.025m4.102 0l1.025-1.025l1.024 1.025',
  wink: 'm-7.185 6.662h2.049M8.925 9.796v2.05m1.025 3.229a2.91 2.91 0 0 0 4.1 0',
  sad: 'm-12.3 4.45v2.698m6.15-2.698v2.698M9.95 15.588a2.89 2.89 0 0 1 4.1 0',
  uwu: 'M14.05 9.704c0 2.296 2.87 2.296 2.87 0m-10.045 0c0 2.296 2.87 2.296 2.87 0m-.328 5.494c0 1.722 2.583 1.302 2.583.39c0 .912 2.583 1.332 2.583-.39',
  dead: 'M9.897 9.372l-2.102 2.102m0-2.102l2.102 2.102m4.206-2.102l2.102 2.102m0-2.102l-2.102 2.102M9.899 16.1h4.1',
  cheer: 'M9.94 15.588h4.1m-6.16-4.613L8.903 9.95l1.025 1.025m4.102 0l1.025-1.025l1.024 1.025',
};
// the relative "m" in three of the paths continues from the end of the antenna strokes, at (21.215, 4.313)
const FACE_NAMES = ['neutral', 'happy', 'wink', 'sad', 'uwu', 'dead', 'cheer'] as const;
const facePath = (name: string) => (FACES[name].startsWith('m') ? `M21.215 4.313${FACES[name]}` : FACES[name]);
// measured centre of each face drawing; the face is nudged so its centre sits on the head's centre (12, 12)
const FACE_CENTER: Record<string, [number, number]> = {
  neutral: [11.99, 12.18], happy: [11.98, 13.02], wink: [12.5, 12.86], sad: [11.99, 12.18],
  uwu: [11.9, 12.04], dead: [12, 12.73], cheer: [11.98, 12.77],
};
const faceShift = (name: string) => `translate(${(12 - FACE_CENTER[name][0]).toFixed(2)} ${(12 - FACE_CENTER[name][1]).toFixed(2)})`;
const HEAD_SQUARE = 'M14.706 4.313H9.294a4.98 4.98 0 0 0-4.982 4.981v5.412a4.98 4.98 0 0 0 4.982 4.982h5.412a4.98 4.98 0 0 0 4.982-4.982V9.294a4.98 4.98 0 0 0-4.982-4.981Z';
const EARS = 'M19.606 15.588h1.619a1.025 1.025 0 0 0 1.025-1.025V9.438a1.025 1.025 0 0 0-1.025-1.025h-1.62m-15.21 7.175h-1.62a1.025 1.025 0 0 1-1.025-1.025V9.438a1.025 1.025 0 0 1 1.025-1.025h1.62';

/** Pass this as GameLogic.avatarLooks so the server and the picker agree. */
export const LOOK_COUNT = 21;
export function lookParts(look: number) {
  const n = ((Math.floor(look) % LOOK_COUNT) + LOOK_COUNT) % LOOK_COUNT;
  return { head: (['round', 'square', 'phones'] as const)[Math.floor(n / 7)], face: FACE_NAMES[n % 7] };
}
/** A stable look for a name (for people who never picked one). */
export function lookFromName(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % LOOK_COUNT;
}

export function AvatarFace({ look, color, size = 40 }: { look: number; color: string; size?: number }) {
  const { head, face } = lookParts(look);
  return (
    <svg className="avatar-svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable="false">
      <g style={{ stroke: 'var(--avatar-ink, #2b2620)' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {head === 'phones' ? <path d={EARS} fill={color} /> : null}
        {head === 'round' ? <circle cx="12" cy="12" r="9.2" fill={color} /> : <path d={HEAD_SQUARE} fill={color} />}
        <path d={facePath(face)} fill="none" transform={faceShift(face)} />
      </g>
    </svg>
  );
}

export function Avatar({ name, color, size = 40, look }: { name: string; color: string; size?: number; look?: number }) {
  return <span className="avatar" style={{ width: size, height: size, background: 'transparent', border: 0, boxShadow: 'none' }}><AvatarFace look={look ?? lookFromName(name)} color={color} size={size} /></span>;
}
