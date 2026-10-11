/**
 * The logic of pass-the-phone, with no UI: who must tap before the screen shows private information.
 *
 * Model: every turn has a key (turn number + player, anything that changes when the turn changes). The gate is
 * "closed" (cover shown) whenever the player who is about to act has not confirmed THIS turn's key.
 * Because the confirmed key is part of the saved game, reloading the page mid-handover never leaks a hand:
 * a fresh load has no confirmation for the current turn unless it was saved, and then it is exactly where you left off.
 */
export interface GateState { confirmedKey: string | null }

export const initialGate = (saved?: GateState | null): GateState => ({ confirmedKey: saved?.confirmedKey ?? null });

/** Is the cover up? `private` = the game is in a phase where the acting player sees secrets (their hand, a hidden clip). */
export const isCovered = (g: GateState, turnKey: string, isPrivatePhase: boolean): boolean => isPrivatePhase && g.confirmedKey !== turnKey;

export const confirm = (_g: GateState, turnKey: string): GateState => ({ confirmedKey: turnKey });

/** Put the cover back (idle timeout, tab hidden, phone locked) without changing the turn. */
export const recover = (): GateState => ({ confirmedKey: null });

/** Helper for an idle cover: milliseconds of no input after which the screen covers itself again (0 = never). */
export const DEFAULT_IDLE_COVER_MS = 90_000;
