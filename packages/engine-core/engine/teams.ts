// Teams, shared by every game that has them. A player's team is just a number stored in the member's profile data
// (`data.team`), so the room, reconnects and the lobby need nothing special: the game validates it in cleanProfile.

/** Default team names; a game can show its own. */
export const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G', 'Team H'] as const;
/** Team colors (hex), same order as TEAM_NAMES. */
export const TEAM_COLORS = ['#ff7aa8', '#6ec6ff', '#a6e36a', '#ffd23f', '#b48cff', '#ff9a52', '#4fe0c4', '#f08cd8'] as const;

/** A valid team number: a whole number from 0 to max-1. */
export function isTeam(v: unknown, maxTeams: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < maxTeams;
}

/**
 * For GameLogic.cleanProfile: merge a team change into a member's profile data.
 * Returns the new data, or an error string when the team is not a whole number below `maxTeams`.
 * Other keys in `current` are kept.
 */
export function cleanTeamProfile(current: Record<string, unknown>, patch: Record<string, unknown>, maxTeams: number): Record<string, unknown> | string {
  if (patch.team === undefined) return { ...current };
  if (!isTeam(patch.team, maxTeams)) return `team must be a whole number from 0 to ${maxTeams - 1}`;
  return { ...current, team: patch.team };
}

/** The team in a profile's data, or `fallback` when none was chosen yet or the value is not a valid team. */
export function teamOf(data: Record<string, unknown> | undefined, fallback: number, maxTeams = TEAM_NAMES.length): number {
  const t = data?.team;
  return isTeam(t, maxTeams) ? t : fallback;
}

/**
 * Team for every seat, in seat order. Seats that never chose a team are spread round-robin over `teamCount`
 * (by their position), so a game never starts with everybody on team 0 by accident.
 */
export function assignTeams(seats: readonly { id: string; data?: Record<string, unknown> }[], teamCount = 2): Record<string, number> {
  const out: Record<string, number> = {};
  seats.forEach((s, i) => { out[s.id] = teamOf(s.data, i % teamCount); });
  return out;
}

/** Seat ids grouped by team number, teams in ascending order, empty teams left out. */
export function groupByTeam(teamBySeat: Record<string, number>): { team: number; ids: string[] }[] {
  const by = new Map<number, string[]>();
  for (const [id, t] of Object.entries(teamBySeat)) by.set(t, [...(by.get(t) ?? []), id]);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([team, ids]) => ({ team, ids }));
}
