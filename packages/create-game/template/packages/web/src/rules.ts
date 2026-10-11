import type { RuleSection, TourStep } from '@gizmo564/rules-results/web';

export const TOUR: TourStep[] = [
  { title: 'A prize is up for grabs', body: 'Each round a prize worth 1 to 5 points is turned face up.' },
  { title: 'Everyone plays one card', body: 'Pick a card from your hand. All players choose at the same time, in secret.' },
  { title: 'Highest unmatched card wins', body: 'If two players play the same card, those cards cancel out. The highest card left takes the prize.' },
  { title: 'Watch the clock', body: 'If time runs out, your lowest card is played for you. Most points after the last round wins.' },
];

export const RULES: RuleSection[] = [
  { title: 'Goal', body: 'Finish with the most points.' },
  { title: 'Each round', body: 'A prize is shown. Everyone secretly plays one card at once. The highest card that nobody else played wins the prize. Cards that match cancel each other.' },
  { title: 'Time', body: 'When the timer ends, anyone who has not played has their lowest card played for them.' },
  { title: 'Hands', body: 'You hold one card per round. Played cards are gone for good, so spend your high cards where they count.' },
];
