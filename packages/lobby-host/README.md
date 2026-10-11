# lobby-host

```tsx
const SECTIONS: SectionDef<Settings>[] = [
  { title: 'Rules', fields: [
    { key: 'cardsToWin', kind: 'stepper', label: 'Cards to win', min: 3, max: 30 },
    { key: 'replay', kind: 'choice', label: 'Replays', options: [{ value: 'off', label: 'None' }, { value: 'once', label: 'One' }] },
    { key: 'hard', kind: 'toggle', label: 'Hard mode', when: (s) => s.cardsToWin > 5 },
  ] },
];
<LobbyScreen snap={snap} send={send} error={error} onLeave={leave} joinUrl={ROSTER.shareUrl(snap.code)}
  minPlayers={2} maxPlayers={8} sections={SECTIONS} bots />
```
The form only offers legal values; `GameLogic.cleanSettings` on the server is what actually enforces them. For a lobby with unusual layout, use the pieces in `lobby-ui` directly (CodePanel, PlayerList, ProfileEditor).
