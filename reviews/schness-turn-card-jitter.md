# Schness: the turn card jitter, and the missing bottom margin

Reported on schness.com: in the game, the guidance under "Your turn" changes height on every
click, so the screen jumps; and the page has no padding at the bottom.

The fix is `schness-turn-card-jitter.patch`, a single commit that applies to `kakkoidev/schness`
at `5fdb281` (master at the time of writing) with `git am` (or `git apply`). `npm test` then
passes at 142. This session could only read that repository, so nothing was pushed to it.

## What was wrong

The turn card's detail paragraph was `hidden` whenever it had nothing to say, which on a live turn
is most of the time. Selecting a piece filled it with two or three lines and unhid the Deselect
button, then the next tap emptied it again. Measured in Chromium before the patch (bot game, king
placed, then a reserve piece selected):

| viewport | card idle → selected | what moved |
|---|---|---|
| 390×844 phone | 32px → 121px | your reserve row and the rail dropped 89px |
| 360×640 phone | 32px → 121px | same, and the page grew from 711 to 801px |
| 740×360 landscape | 32px → 101px | reserve row and rail dropped 69px |
| 1280×800 desktop | 52px → 141px | **the board dropped 53px**: the card sits in the same grid row as the opponent's reserve, so the row grew |

On a phone the reserve tile you had just tapped moved out from under your finger. On desktop the
whole board moved on every click.

Separately, the phone layout trims the page's top padding to give the board the height, and had
trimmed the bottom to the same `.35rem`: the Undo / Resign row ended 5–6px from the edge of the
screen at every phone size.

## What the patch does

- `.turn-detail` reserves `min-height: calc(3 * 1.55em)` — three lines, which is what the longest
  live guidance ("Rook from your reserve is selected. Drop it on a marked empty square, or pick a
  piece on the board to move instead.") wraps to at 320px, at 390px and in the 312px desktop rail —
  and `main.js` no longer sets `hidden` on it.
- The card becomes a two-column grid: headline left, Deselect right on the same row, detail across
  both. The button no longer adds a row when it appears.
- The borderless phone card drops from 6px to 3px vertical padding, so a 390×844 screen still holds
  the whole game without scrolling (the page is exactly 844px tall there).
- `.game-page` on phones gets `padding-bottom: max(1rem, env(safe-area-inset-bottom))`. The top
  stays trimmed.
- `CACHE` bumped v43 → v44 (`styles.css`, `game.html` and `src/main.js` are in `SHELL`).
- `DECISIONS.md` gains the invariant under "The turn card says what is true now" and a Log line;
  `test/shell.test.js` gains a test that pins the min-height, the grid areas, the absence of
  `turnDetail.hidden`, and the bottom padding.

## After the patch

`schness-harness/turn_card_shift.mjs` re-measured at 320×568, 360×640, 390×844, 740×360 and
1280×800: the card is 99px on phones and 119px on desktop in every state (king placement, idle,
reserve selected, deselected, board piece selected), and the board, both player rows and the rail
keep the same coordinates throughout. The bottom gap on phones is 16px in every state.

Not verified: a real device, and the review card. The review card keeps its 16px frame by design,
so on a phone entering review still shifts the rows under it by about 20px (it was about 90px).
