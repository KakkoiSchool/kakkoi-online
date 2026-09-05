You are picking up work on github.com/kakkoidev/schness (a 4×4 chess variant: static site, no build,
browser ES modules, WebRTC over public Nostr relays via vendored trystero). Start from `master` at
`d47c46c`. Read `DECISIONS.md` first; it is the project's record and must be updated in the same
commit as any change that contradicts it.

## What has already happened

Two reviews exist and you should not redo them:

1. The original brief "Where I think I am wrong" (Claude Opus 5): ten ranked claims about the repo.
2. An adversarial counter-review of that brief, with a harness and a patch, on branch
   `claude/schness-adversarial-review-bd562b` of github.com/KakkoiSchool/kakkoi-online under
   `reviews/`:
   - `schness-adversarial-review.md` — the verdicts, the gaps, the ranked plan.
   - `schness-adversarial-review.patch` — applies to `d47c46c` with `git apply`; `npm test` then
     passes at 137. It was tested but NOT pushed to schness (that session had read-only access).
   - `schness-harness/` — the scripts that produced every number, with a README.

Established facts (reproduced; do not re-derive):
- The 4.3× search speedup is behaviour-preserving. Perft agrees to depth 5 (457,568) between the
  pre-speedup engine (`7924e41^`), the shipped engine, and a generator written from the rules
  dialog alone. 400 seeded games, 38,302 positions, 5,417 depth-2 bot decisions: zero divergence.
- The search's transposition cache stores post-cutoff bounds as exact; at depth 4 (Sharp) it
  changed the chosen move in 2 of 60 sampled positions vs. the same search with the cache disabled.
- The search still slows with game length: 1.94× at depth 4 with a 150-entry repetition map,
  because `applyLegalAction` copies the map per node. The record's "no longer degrades" was false.
- A time loss renders as "Resigned / You resigned" (Chromium, 3+2 clock, faked timer). The clock
  keeps running after the opponent drops. Online clocks are two local clocks that drift by one-way
  latency per move; the flag is decided locally and never sent.
- Sharp vs Sharp self-play from all 16 king placements: 14 of 16 end in threefold repetition.
- A meta CSP works under a live bot game with the service worker and module worker (zero
  violations); the online path is verified by spec only.
- Vendored trystero already accepts `turnConfig`; ships four STUN servers; receives the peer's
  offer/answer over the relays before WebRTC connects but does not surface it to the app.
- One predicted bug (stale animation counter after a takeback) turned out NOT to exist when
  checked in Chromium. Read, then verify, before fixing.

## Progress since this was written (same session, later)

Landed on KakkoiDev/schness and squash-merged into master as #41 (`5fdb281`): the counter-review
patch and the one-clock patch. In flight or queued as patches in this directory, each a single
commit that stacks on the previous one and passes `npm test`:

| patch | plan item | tests | branch on schness |
|---|---|---|---|
| `schness-bot-fixes.patch` | 3: cache bound flags, shared repetition map, contempt | 145 | `claude/bot-search` (being landed) |
| `schness-sw-consistency.patch` | 4: navigations from the same cache generation | 145 | not yet |
| `schness-polish.patch` | 7 + 8: draws in the rules, result card is a dialog with Escape, aria-selected, dots stop at 3 loops | 147 | not yet |

Apply them in that order on master with `git apply`; each was verified in Chromium (scripts in
`schness-harness/`: `verify_clock.mjs`, `verify_sw.mjs`, `verify_polish.mjs`). Items 2 (surface
matchmaking failure from the vendored trystero), 5 (rendezvous-hash the relays) and 6 (split the
record) remain open; 2 and 5 touch the online path that no sandbox can exercise, so land them only
with a real two-peer test in hand.

## Your first job

Land the patch: create a branch from `d47c46c`, `git apply reviews/schness-adversarial-review.patch`,
run `npm test` (expect 137 passing), read the diff so you can defend it, and open a PR (or push to
master if that is the project's convention). Its contents: frozen shared occupants (`occupantOf`),
removal of the dead `copyRepetitions` path, time loss reported as a time loss, clock stops on
opponent leave, takeback restarts the mover's clock and the bot worker, canonical action object on
the peer path, a meta CSP on both pages plus `test/security.test.js`, `CACHE` bumped v41→v42, and
`DECISIONS.md` corrected in the same change.

## Then, in this order, one change per commit, record updated in the same commit

1. **One clock for online play.** Carry the mover's remaining time in the action message
   (`game-message.js` `makeActionMessage`/`applyActionMessage`), have the receiver adopt it, and let
   a flag be claimed only by the side whose own clock ran out (send a control message; the other
   side verifies against its view with a tolerance). Guard with node tests; a two-peer browser test
   is not available in the sandbox, so say so.
2. **Make matchmaking failure observable.** In the vendored trystero, surface (a) an offer/answer
   received from a peer over the relays and (b) `RTCPeerConnection.connectionState === 'failed'`.
   Then the waiting card can say "your friend opened the link at HH:MM; the connection failed"
   instead of the 45-second guess, and the app can count how often NAT bites before anyone pays
   for TURN. Only then decide on `turnConfig`.
3. **Fix the bot before speeding it up again.** Store bound flags (exact/lower/upper) in the
   transposition cache; add a contempt term or score repetition below the static evaluation; stop
   copying the repetition map per node. Re-run `selfplay.mjs 4 4 200` and `cache_depth4.mjs` from
   the harness and report the before/after; the move fingerprint WILL change and that is intended,
   so say so in `DECISIONS.md` and recompute nothing about perft (rules are untouched).
4. **Service worker: one visit, one build.** Serve navigations from the same cache generation as
   their subresources (cache-first with the existing background revalidation) so the first visit
   after a deploy is not new HTML on old JS/CSS. Keep the `CACHE` bump as the roll-forward and keep
   the lobby-only reload. Bump `CACHE`.
5. Rendezvous-hash the relay list (rank by `hash(gameId + url)`, dial top k; `relayReach().total`
   becomes k). Only if there is appetite for scale.
6. Split `DECISIONS.md`: invariants + guards + layer table stay; narrative moves to a history file.
7. One sentence in the rules dialog on stalemate and threefold repetition.
8. Accessibility polish: Escape + dialog role on the result card; `animation-iteration-count: 3`
   on the waiting dots; `aria-selected` on the selected cell.

## Ground rules (unchanged from the project)

- `npm test` is the only gate. No build, no browser runner in CI.
- Bump `CACHE` in `sw.js` when anything in its `SHELL` list changes.
- Verify the effect, not the trigger. Chromium + Playwright are available in the sandbox
  (`/opt/pw-browsers`); drive them by hand for anything DOM-visible. There is no second peer, no
  live relay, no real device, no screen reader — say plainly what you could not verify.
- Do not put model identifiers in commits, PR text, or code.
