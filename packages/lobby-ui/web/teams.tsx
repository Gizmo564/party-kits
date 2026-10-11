import { TEAM_COLORS, TEAM_NAMES } from '@gizmo564/engine-core/engine';

/** Small colored team badge, for the player list (PlayerList `extra`) or a scoreboard. */
export function TeamChip({ team, names = TEAM_NAMES }: { team: number; names?: readonly string[] }) {
  const color = TEAM_COLORS[team % TEAM_COLORS.length];
  return <span className="chip teamchip" data-testid="team-chip" style={{ background: color, color: '#111' }}>{names[team] ?? `Team ${team + 1}`}</span>;
}

/** "Your team": one button per team. Put it inside ProfileEditor's children. The server checks the value (cleanTeamProfile). */
export function TeamPicker({ value, teamCount, onPick, names = TEAM_NAMES, label = 'Your team' }: {
  value: number; teamCount: number; onPick: (team: number) => void; names?: readonly string[]; label?: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {Array.from({ length: teamCount }, (_, t) => (
        <button key={t} type="button" role="radio" aria-checked={t === value} className={`chipbtn${t === value ? ' on' : ''}`}
          style={t === value ? { background: TEAM_COLORS[t % TEAM_COLORS.length], color: '#111' } : undefined} onClick={() => onPick(t)}>
          {names[t] ?? `Team ${t + 1}`}
        </button>
      ))}
    </div>
  );
}
