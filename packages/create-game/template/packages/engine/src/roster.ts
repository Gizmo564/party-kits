// This game's room-code roster. The first letter of a code says which game it belongs to (join-codes kit).
//
// !! DEV PLACEHOLDER. All 24 letters belong to live games today (kit/join-codes/engine/manifest.json), so the starter borrows
// !! these letters for itself only inside this build. Before you deploy: claim real letters (platform/root/docs/NEW_GAME_CHECKLIST.md,
// !! section 2), put the entry in the shared manifest, and delete `own` here so the game reads the shared manifest like the others.
import { makeRoster } from '@gizmo564/join-codes/engine/roster';

export const ROSTER = makeRoster('__SLUG__', {
  own: { id: '__SLUG__', name: '__NAME__', letters: '__LETTERS__', origin: 'https://__SLUG__.0801564.xyz', roles: ['player', 'display'], status: 'live', joinPath: '/?room={code}' },
});
