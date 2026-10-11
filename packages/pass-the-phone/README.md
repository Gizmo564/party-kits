# Pass the phone

One device, everyone takes turns. The whole job is: **never show a player's private information until that player has
the phone and says so.** This is how Track Record and Sandwich Slam do it, written down so the next game matches. Two safeguards (re-cover when the tab is hidden, and after idle) are new in the kit and not yet in those two games.

## The flow

1. A turn ends. The game moves to the next player.
2. The screen shows a **cover**: the next player's avatar and name, "Pass the phone to ___", anything they should know
   (what happened since their last turn), and one big button: "I'm ready" / "I'm Ann: show my hand".
3. Only that tap reveals the private screen (the hand, or starts the hidden clip). The tap is also where you unlock
   audio (browsers only allow sound after a tap) and start anything that must begin when the player is looking.
4. The private screen is shown until the move is made. Then the reveal/result screen is public (everyone is looking),
   then back to step 1.

## The rules

- **The cover is keyed to the turn**, not to a flag that someone remembers to reset. Each turn has a key (turn number +
  player). The cover is up whenever the key the player confirmed differs from the current turn's key. A forgotten reset
  can then only ever show the cover too often, never too rarely.
- **Reloading must not leak.** Save the confirmed key together with the game. A reload mid-handover comes back to the
  cover; a reload mid-turn comes back to the same private screen.
- **Public phases are not covered.** Reveals, scores and "since your last turn" are for the whole table. Cover only
  phases that show secrets.
- **Re-cover when the phone is put down.** Hide the private screen if the tab becomes hidden (screen lock, app switch)
  or after a stretch with no touches (default 90 s). `PassGate` does both.
- **Say what happened.** The next player was not looking. Show a short "since your last turn" list on the cover.
- **Names, not "player 2".** The cover is the one screen everyone reads aloud, so it must be unmistakable who is next.
- **Menu on the cover.** Leaving the game, rules and the table view must be reachable without revealing anything.
- **No hidden information in the cover.** It may show public facts (token count, timeline length) but never a hand.
- **Automatic players (bots) skip the cover** but their move should still be shown to the next human on their cover.

## Files

| File | Use |
| --- | --- |
| `web/pass-gate-state.ts` (+ test) | The logic: key-based cover, confirm, re-cover. No UI. |
| `web/PassGate.tsx` (+ test) | A wrapper component using that logic, with the hidden-tab and idle re-cover. |
| `web/PassCover.tsx` | A ready-made cover screen: avatar, "Pass the phone to ___", since-your-last-turn list, big button, menu slot. |

## How the two games differ (so you can pick)

- **Track Record** hides a *song*: the cover starts the clip when tapped (`onReady` unlocks audio and plays). The
  confirmed key is saved with the game in `localStorage`, so Resume game lands on the right screen.
- **Sandwich Slam** hides a *hand*: the cover lists the last moves and the reveal tap shows the hand. Bots skip it.

## Test checklist

1. Start a 3-player game: after each move the next player sees only the cover.
2. Reload on the cover and on the private screen: same screen, nothing leaked.
3. Lock the phone on the private screen and unlock: cover is back.
4. Leave the phone idle past the timeout: cover is back.
5. With a bot next: no cover for it, and the human after it sees what the bot did.
