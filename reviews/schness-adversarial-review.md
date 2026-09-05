# Schness counter-review — `kakkoidev/schness` master @ `d47c46c`

An adversarial second opinion on the brief "Where I think I am wrong" (Claude Opus 5, session of
2026-09-05). Everything below was reproduced in this sandbox unless it is labelled **by reading**
(deterministic from the source, not exercised) or **opinion** (a judgement, not a measurement).
Harness scripts are in `reviews/schness-harness/`; the patch is `schness-adversarial-review.patch`.

The reviewed repository is read-only from this session, so nothing was pushed to it. The patch
applies to `d47c46c`, passes `npm test` at 137 tests, bumps `CACHE` to `schness-v42`, and updates
`DECISIONS.md` in the same commit.

## The short version

- **The 4.3× speedup did not change the game.** Perft agrees to depth 5 (457,568) between the
  pre-speedup engine, the shipped engine, and a generator written from the rules dialog alone. Four
  hundred seeded random games, 38,302 positions, 5,417 depth-2 bot decisions: zero divergence.
- **Two statements in the record are false.** "No longer degrades as a game lengthens" — the path
  that shared the repetition map was dead code from the commit that introduced it, and the search
  runs 1.94× slower with a 150-entry map. "The app cannot see the NAT failure at all" — the vendored
  trystero receives the other peer's offer over the relays before WebRTC ever connects; it just does
  not tell the app. It also already accepts a `turnConfig`.
- **The harness is blind to bugs both copies share, and there is one.** The search caches values
  after alpha-beta cutoffs as if they were exact. At depth 4 that changed the chosen move in 2 of 60
  sampled positions against the same search with the cache off. Learning and Steady cannot hit it.
- **The clock is where the online game is wrong.** A time loss is shown as "You resigned"
  (reproduced in Chromium). The clock keeps running after the opponent drops. The two peers keep two
  clocks that drift by one-way latency per move, and each decides the flag alone and never says so,
  so a timed match can end on one screen and continue on the other.
- **Sharp plays itself to a draw** 14 games out of 16 by threefold repetition. The rules dialog never
  mentions that draws exist.

---

## 1. Counter-findings on the ten claims

### 01 · No TURN server — **right about the fact, wrong about the consequences**

*Reproduced by reading the vendored bundle.*

- `vendor/trystero/src/strategy.js` builds the connection as
  `new RTCPeerConnection({ iceServers: Ce.concat(turnConfig || []), ...rtcConfig })`. There is no
  TURN by default — correct. But the default list `Ce` is **four** STUN servers (three Google, one
  Cloudflare), not two, and **`turnConfig` is already a supported option of `joinRoom`**. Adding TURN
  is a config line, not a fork; the infrastructure question (credentials, cost, abuse of static
  credentials on a static site) is real, but the brief overstates the engineering.
- "Peers exchange nothing until WebRTC is up, so neither side ever learns the other is there" is
  wrong at the transport layer. The Nostr strategy signals *through the relays*: the `subscribe`
  handler receives `{ peerId, offer }` and `{ peerId, answer }` events from the other side before
  any data channel exists, and `onconnectionstatechange` fires `failed` on the `RTCPeerConnection`
  when ICE gives up. Trystero swallows both — the failed peer is destroyed without ever reaching
  `onPeerJoin` — which is why the *app* sees nothing. The bundle is vendored, so surfacing "a peer
  answered the link at 14:02:11 and the connection failed" is a small patch to code the repo owns.
  That would turn the 45-second note from a guess into a fact, and would give the first real
  measurement of how often this bites.
- The 8–20% figure: not verifiable here. The commonly quoted industry number for "sessions that
  need a relay" is around 8–15%, heavier on mobile carriers with carrier-grade NAT and on networks
  that block UDP outright (where TURN over TCP/443 is the only route). Treat it as folklore until the
  detection above produces a count.

### 02 · Perft self-certified — **right, and now independently confirmed**

*Reproduced.* `reviews/schness-harness/indep_perft.mjs` is a generator written from the rules dialog
and the lobby strip only (signed-int8 board, its own attack tables, no shared code). It counts
4 / 16 / 558 / 17,896 / **457,568** at depths 1–5. The pre-speedup engine (`7924e41^`) and the
shipped engine count the same. So the pinned numbers describe what the dialog says, not merely what
the engine did.

Two things the brief did not say:

- The suite's "shortcuts agree with the guarded entry points" test is a tautology for
  `legalActionsUnchecked` — it is the same function body behind a different export. It guards
  against future divergence, not against the change that was made.
- The dialog never mentions **stalemate or threefold repetition**. The engine implements both, the
  result cards name both, and at the Learning level 13 of 16 self-play games end in repetition. The
  independent derivation had to borrow those rules from chess convention because the page does not
  state them.

### 03 · Shared occupants on an asserted invariant — **right, and now enforced**

*Reproduced.* `grep '\.owner\s*=[^=]\|\.piece\s*=[^=]' src/` finds nothing, so the assertion was
true. The patch makes it structural: every occupant is one of **eight frozen values**
(`occupantOf(owner, piece)`), `createPosition` canonicalises what it is handed, and both
`boardAfter` and `clonePosition` copy arrays only. In a module (strict mode) a write throws
`TypeError`. Measured: perft to depth 5 unchanged, 11,944 differential positions unchanged, 12/12
depth-4 moves unchanged, and the depth-4 search is **1.22× faster** because `clonePosition` no
longer spreads sixteen objects per node. A test pins the identity sharing and the throw.

### 04 · Result overlay takes focus but is not modal — **opinion: non-modal is right, the shape is half-way**

The loss card's own secondary action is "See that move", which reads the board behind it, so a
board made inert by `showModal()` would fight the card's purpose. Keep it non-modal. What is missing
is the other half of the dialog contract: `Escape` does nothing and the region has `role="group"`,
so a screen-reader user lands in something that behaves like a dialog and is not announced as one.
Either open a `<dialog>` with `show()` (non-modal, gets Escape and the role for free) or add
`role="dialog"` plus an Escape handler that sets `resultDismissed`. Not tested with a screen reader;
none is available here.

### 05 · Something animates forever under `reduce` — **straight ruling: a low-severity 2.2.2 failure, under both settings**

*Opinion grounded in the criterion text.* WCAG 2.2.2 applies to anything moving or blinking that
starts automatically, lasts more than five seconds, and is presented in parallel with other content,
unless the movement is essential. The dots sit beside a link field, a Copy button and Cancel, so
"parallel with other content" holds; the Understanding document's preload exemption requires that
interaction cannot occur during the animation, which is not the case. `aria-hidden` is irrelevant —
the criterion is visual. The `reduce` block is not what makes this a failure; the `no-preference`
bounce fails the same way. Cheapest fix that is compliant by construction:
`animation-iteration-count: 3` on a 1.5s loop ends the motion at 4.5s while the status text keeps
saying "Listening". Severity is genuinely low: six-pixel dots at 25% opacity.

### 06 · `<button role="gridcell">` loses the button role — **opinion: keep it**

Losing "button" is the ARIA grid pattern working as designed: cells of a composite are operated with
Enter/Space and announced with row and column, and `aria-activedescendant` already carries the
cursor. A nested button would announce "button" and add a second tab-semantics layer for no gain.
Two small additions would help more than the wrapper: `aria-selected` on the selected cell, and a
check that the HTML `disabled` attribute still maps to `aria-disabled` under the overridden role
(HTML-AAM says it should; unverified here — no screen reader).

### 07 · Append-only relay list, every client dials all ten — **right for the wrong reason**

*By reading the bundle.* The list must be append-only *only because* every client dials the whole
list. That is a separate decision, and it is the one to change. Rank relays by
`hash(gameId + url)` and dial the top *k* (rendezvous hashing): both peers in a room pick the same
*k* from the same list, fan-out is constant however long the list grows, and appending a relay
displaces at most one of the *k* picks, so an old build and a new build still share *k−1* relays.
Trystero's own `relayRedundancy` sampling (in `utils.js`) is seeded by `appId`, not by room, and a
plain shuffle changes wholesale when the list changes — so it is not the tool. Two facts that make
the current design cheaper than the brief fears: a dead relay is retried with exponential backoff
from 3.3s (`makeSocket`), so it costs little after the first minute; and each waiting player
re-announces to each relay every ~5.3s (`Ge = 5333`), which is the real per-client load and scales
with fan-out. `relayReach().total` would need to become *k*.

### 08 · No CSP — **right, closed**

*Reproduced in Chromium.* Both pages now carry
`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' wss:;
media-src 'self' blob: mediastream:; worker-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'`. Under it: the game page loads, the service worker activates, a king placement
and a deployment are played and the bot answers through the module worker, the lobby renders, the
online waiting card renders, the rules dialog opens — with zero CSP violations in the console. The
sandbox proxy blocks the relays, so the WebSocket attempts fail as tunnel errors, not CSP errors;
**the online path is verified by the spec** (WebSocket is governed by `connect-src`; WebRTC by no
CSP directive) and not by a match. `test/security.test.js` fails on `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, `document.write`, `eval`, inline scripts, inline handlers, inline styles, or
the two pages disagreeing. The `wss:` scheme rather than hostnames is deliberate: the relay list is
append-only and the policy must not become a second copy of it.

### 09 · Reserve tile overrides a space-saving rule — **right, and the untested size is fine**

*Reproduced.* Chromium at 320×568, 320×640 and 360×640, bot mode and invite card: every named
control is 44px tall, including `.bank-piece`, `#copy-invite`, `#invite-url` and `#cancel-search`.
Widths are not held to 44: reserve tiles are 38px wide and the Moves link 43px. That meets WCAG 2.2
2.5.8 (24×24, AA) and not 2.5.5 (44×44, AAA); the record's "44px" rule is a height rule and should
say so. The 320×568 page is 713px tall and scrolls; the invite card fits without scrolling at every
size.

### 10 · The record is ~290 lines — **right to worry, with an exhibit**

*Reproduced.* Step 2 of "The search" described `clonePosition` sharing the repetition map "when the
copy is a throwaway". The only caller that passed `false` was the legality filter, and step 3 of the
same commit replaced that filter with `boardAfter`. The parameter was dead code from the moment it
shipped, and the record described a mechanism that did not exist. The "same commit" rule catches
additions; it does not catch supersession within a commit, and it does not catch the Log claim "no
longer degrades as a game lengthens" (see below). Recommendation: split the file — invariants with
their guards and the layer table stay in `DECISIONS.md` and are read in full; the narrative of how
each was reached moves to a `HISTORY.md` that is appended, not read. The enforcing test stays on the
first file.

---

## 2. What is not on the list

### Clocks and time forfeits (`clock.js`, `main.js`)

- **A loss on time is reported as a resignation.** *Reproduced in Chromium* with a 3+2 clock and a
  faked timer: at 0:00 the result card read **"Resigned / You resigned — The match ended on move
  0."** The interval handler sets `resigned = running` (`main.js:1164`) and nothing downstream knows
  why. Patched: a `lostOnTime` flag, an `onTime` option on `outcomeSummary`, and the card now reads
  **"Time / You ran out of time — Your clock hit zero on move 0."** Also visible in that run: White's
  king placement is timed and Black's is not (`chargeClock` nulls `clockSince` during
  `place-black-king`).
- **The clock keeps running after the opponent drops.** *By reading.* `onOpponentLeave` sets
  `disconnected`, which makes `canHumanAct()` false, but never stops the ticker. On your turn your
  clock runs down while you cannot move, and you are flagged. Patched: the ticker stops and
  `clockSince` is cleared.
- **Two clocks, not one — and worse than first written.** *By reading; needs two peers to
  reproduce.* The first version of this review said the sides drift by one-way latency per move. That
  understated it: `receivePeerAction` never called `chargeClock` at all. Only `commit()` charges,
  and only local moves go through `commit()`, so each player's own clock paid for both sides'
  thinking between their own moves, and the opponent's clock on screen jumped back up on every
  move. The flag was decided locally and never sent, and a move arriving after one side had ended
  the game was applied over it. **Fixed in `schness-one-clock.patch`**: the action message carries the
  mover's account of both clocks; the receiver charges the mover for elapsed time and adopts the
  mover's own number within a 3s tolerance; a flag is a control message, called at once for your own
  clock and after the tolerance for the opponent's; late moves are ignored; both placements are
  timed. A replay test at 250ms latency keeps the two views within tolerance over eighty plies.
  Verified in Chromium for the bot path only.
- **A takeback charges the wrong side.** *By reading.* `takeBack` leaves `clockSince` where it was,
  so the player now on move is charged for the time the other side spent thinking, on both screens
  at different amounts. Patched: the mover's clock restarts at the takeback; nothing is refunded.
  Same function: the bot worker was still searching the abandoned position and the next request
  queued behind it; patched to terminate and recreate it, as `resetState` already does.

### The peer input path (`game-message.js`, `net.js`)

- The boundary is sound: `before` hash, legality by key, `after` hash, turn check, and
  `applyAction` is called with the engine's own `legal` object. One sloppiness: `main.js` then stores
  `message.action` — the peer's object — in `history` and `lastAction`. `actionKey` uses a template
  string, so `{ to: "5" }` matches `{ to: 5 }`, and every later `===` against a square fails (no
  last-move highlight, wrong "deployed" wording). Patched to store the canonical action. *Verified
  by reading; a peer would have to be hostile or buggy to send strings.*
- Control messages are unauthenticated in the sense that any of `resign`, `draw-accept`,
  `takeback-allow` are acted on as long as the local state expected them. That is the right level
  for a two-player friendly; noting it because "the list is the security boundary" in the record is
  true for moves only.
- An out-of-sync error stops the local game with "Game stopped" and tells the peer nothing. Fine as
  a failure mode, undocumented as one.

### The service worker's update semantics (`sw.js`, `lobby.js`)

*By reading; reproducible with two builds served in sequence, which was not done.* Navigations are
**network-first** and every subresource is **cache-first** with revalidation. So the first visit
after any deploy runs the **new HTML with the old CSS and JS**, and if the deploy bumped `CACHE`,
the new worker then installs, `skipWaiting()`s and `clients.claim()`s mid-page and deletes the old
cache, so any lazy fetch from then on (`import('./net.js')`, a worker spawn) comes from the new
build. The lobby self-heals through its one reload; the match page, by design, does not, so a whole
match can run on a mixed build. The record only says a forgotten bump is "late by one visit". The
fix that keeps the design's goals is to serve navigations from the same cache generation as their
subresources (cache-first with the same revalidation), so any one visit is internally consistent and
the `CACHE` bump remains the roll-forward. Commits `72566e4` and `0ab68a3` both changed HTML and JS
together and would have shipped a mixed first visit.

### The search (`bot.js`) — what the equivalence harness cannot see by design

- **Transposition cache stores bounds as exact.** *Reproduced.* `search()` caches `value` after a
  cutoff. At depth 4, 60 sampled positions, the shipped search chose a different move from the same
  search with the cache disabled in **2 cases** (both a bishop drop to a different square). At depth
  3 no transposition is possible within the tree, so Learning and Steady are unaffected. Both the
  frozen copy and the live engine have this, so the harness is structurally unable to notice it.
- **The search still slows with game length.** *Reproduced.* Same position, depth 4: 476ms with an
  empty repetition map, 925ms with a 150-entry map (**1.94×**). `applyLegalAction` copies the map at
  every node. The Log line claiming otherwise is corrected in the patch.
- **`getResult()` inside `search()` still validates and generates at every node**, then
  `legalActionsUnchecked` generates again. Measured: reusing the list is only **1.12×**. Not worth a
  change; worth knowing the record's "the search re-validated its own moves" was only half fixed.

### Is the game any good to play?

Self-play from all 16 king placements, same depth both sides, capped at 200 plies:

| depth | white | black | draws | unfinished | mean moves | ended by |
|---|---|---|---|---|---|---|
| 1 (Learning) | 3 | 0 | 13 | 0 | 37.9 | repetition |
| 2 | 5 | 3 | 8 | 0 | 21.9 | repetition |
| 3 (Steady, default) | 7 | 6 | 0 | 3 | 48.8 | — |
| 4 (Sharp) | 1 | 1 | 14 | 0 | 27.3 | repetition |

- Sharp against itself is a draw machine: the evaluation scores a draw as 0 and equal material near
  0, and the drop-may-not-check rule plus a king that always has a flight square makes progress
  hard, so it shuffles. There is no contempt term and repetition is never scored below the static
  evaluation. Against a human this means the hardest opponent is the one most willing to repeat.
- Steady, the default, plays long games: three of sixteen passed 100 moves without a result.
- Sharp's worst single move was 7.0s here (under CPU contention; the record says 3.6s clean). On a
  phone that is ten to twenty seconds behind a pulsing dot.
- The rules dialog says nothing about how a game can end other than checkmate, while most games at
  two of four settings end another way.

*Not verified:* whether the opening is a forced result. The state space (~1.2 billion positions) is
beyond a quick retrograde solve; a fixed depth-6 search from the initial position would be the next
cheap probe.

### Smaller things

- `rulesSeen` / `setRulesSeen` in `settings.js` are used only by their tests since the dialog
  stopped opening itself. Dead code with test coverage.
- Undo is enabled after checkmate against the bot and "Ask to undo" after checkmate online (the
  disabled check omits `getResult`). Plausibly a feature; it is not written down as one.
- One thing I expected to find and did not: I read `animatedPlies` as stale after a takeback and
  drafted a fix. Chromium showed the move after an undo animates on the unpatched build — `render()`
  resets the counter on every call. The fix was removed. Reading is not verifying.

---

## 3. What I would do next, in order

1. **Make the online clock one clock.** Done in `schness-one-clock.patch` (see above); what remains
   is a real two-peer match to confirm it, which no sandbox can provide.
2. **Make matchmaking failure observable before buying TURN.** Surface the relay-level offer/answer
   and the ICE `failed` state from the vendored trystero. That replaces a 45-second guess with "your
   friend opened the link; the connection failed", and it is the only way to learn whether the NAT
   problem is 2% or 20% before paying for a relay.
3. **Fix the bot before making it faster again.** Store bound flags in the transposition cache, add
   a contempt term or score repetition below the static evaluation, and stop copying the repetition
   map per node. Sharp currently plays a move its own search would not choose about one time in
   thirty and draws itself; that is what "good to play" against the bot hinges on.
4. **Serve navigations from the cache generation they belong to.** One visit, one build. The
   `CACHE` bump stays the roll-forward, and the lobby reload stays.
5. **Rendezvous-hash the relays.** Constant fan-out, append-tolerant, and the list can grow to
   thirty. Only matters at scale, and cheap now.
6. **Split the record.** Invariants and guards in `DECISIONS.md`, narrative in a history file. The
   dead-path entry is what a long narrative record does to the next reader.
7. **Say what a draw is.** One sentence in the rules dialog for stalemate and repetition, and the
   Sharp self-play result stops being a surprise.
8. **Accessibility polish:** `Escape` and a dialog role on the result card; three iterations on the
   waiting dots; `aria-selected` on the selected cell.

## What could not be checked here

Two real peers, any real network, any real device, any screen reader, the live site. Every online
finding above is by reading, and says so.

## Reproduce

```sh
git clone https://github.com/kakkoidev/schness && cd schness && git checkout d47c46c
mkdir old && git show 7924e41^:src/rules.js > old/rules.js && git show 7924e41^:src/bot.js > old/bot.js
cp <this repo>/reviews/schness-harness/*.mjs . && cp src/rules.js src/bot.js .
node perft_compare.mjs     # old vs new, depths 1–5
node indep_perft.mjs       # from the dialog alone: 4 / 16 / 558 / 17896 / 457568
node diff_engines.mjs      # 400 games, ~12 min
node cache_depth4.mjs      # 60 positions, ~75 s: cached vs exact search
node rep_growth.mjs        # empty map vs 150-entry map
node selfplay.mjs 4 4 200  # Sharp vs Sharp from every king placement
python3 -m http.server 8899 &  # then, with playwright available:
node browser_checks.mjs    # tap targets, CSP under a live bot game, the time-forfeit card
git apply <this repo>/reviews/schness-adversarial-review.patch && npm test   # 137 passing
```
