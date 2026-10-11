import { createAudio } from '@gizmo564/audio/web';

// No music files yet: add /public/sounds/lobby.mp3 and list it in `tracks` (a missing file is skipped silently).
// Effects are synthesized (see kit/audio/web/recipes.ts); a recording named after the effect overrides it.
export const audio = createAudio({ game: '__SLUG__', tryAtStart: true, tracks: { menu: {}, lobby: {}, play: { volume: 0.2 } } });
