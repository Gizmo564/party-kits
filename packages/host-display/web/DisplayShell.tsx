import type { ReactNode } from 'react';
import { FullscreenButton } from '@gizmo564/lobby-ui/web/FullscreenButton';
import { Qr } from '@gizmo564/lobby-ui/web/Qr';

/**
 * The frame around a host display during a game: room code and a small QR (so latecomers can join), the Full screen
 * button, and your table in the middle. Only the display shows the Full screen button.
 */
export function DisplayShell({ code, joinUrl, title, right, children }: { code: string; joinUrl: string; title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="page wide" data-testid="display">
      <header className="topbar">
        <div className="row"><b className="display">{title ?? 'Room'}</b><span className="chip" data-testid="room-code">{code}</span></div>
        <div className="row">{right}<Qr text={joinUrl} size={56} /><FullscreenButton /></div>
      </header>
      {children}
    </div>
  );
}
