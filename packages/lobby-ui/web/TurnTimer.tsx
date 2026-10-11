import { useEffect, useState } from 'react';

/**
 * A ring that counts down to `deadline` (epoch ms, from Snapshot.deadline). `total` is the full length in ms so the ring
 * can show how much is left. Uses the server's clock offset if you pass one (`skewMs` = serverNow - clientNow).
 */
export function TurnTimer({ deadline, total, size = 64, skewMs = 0, urgentBelowMs = 5000 }: { deadline: number | null; total: number; size?: number; skewMs?: number; urgentBelowMs?: number }) {
  const [now, setNow] = useState(() => Date.now() + skewMs);
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now() + skewMs), 200);
    return () => clearInterval(t);
  }, [deadline, skewMs]);
  if (deadline === null) return null;
  const left = Math.max(0, deadline - now);
  const r = 28, c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  return (
    <svg className={`turn-timer${left <= urgentBelowMs ? ' urgent' : ''}`} viewBox="0 0 64 64" width={size} height={size} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <circle className="ring-bg" cx="32" cy="32" r={r} strokeWidth="6" />
      <circle className="ring" cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 32 32)" />
      <text x="32" y="38" textAnchor="middle" fontSize="20">{Math.ceil(left / 1000)}</text>
    </svg>
  );
}
