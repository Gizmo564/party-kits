import { Credits, type MusicCredit } from '@gizmo564/rules-results/web';

// Your game's credits. The creator line and the YouTube Audio Library note come from the kit (same in every game).
// List every track you ship in /public/sounds, with its licence if it asks for attribution.
const MUSIC: MusicCredit[] = [
  // { title: 'Local Forecast', by: 'Kevin MacLeod', url: 'https://incompetech.com', license: { name: 'By Attribution 4.0 License', url: 'https://creativecommons.org/licenses/by/4.0/' } },
];

export const GameCredits = () => <Credits music={MUSIC} />;
