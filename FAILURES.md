# What the AI got wrong

A running log, kept **while building**, not reconstructed afterwards. Every third lesson shows
students a real mistake the agent made and how it was caught — those examples are impossible to
invent convincingly and impossible to remember later.

Format:

## YYYY-MM-DD — <one-line summary>
**Lesson:** A__
**What it produced:** …
**Why it was wrong:** …
**How I caught it:** (typecheck / test / played it / read it)
**The fix:** …

---

<!-- entries below, newest first -->

## 2026-08-16 — fixing the Challenge button's position made the whole page jump
**Lesson:** A19 (challenging someone) / A16 (drawing)
**What it produced:** `#nearby { grid-row: 1; grid-column: 1; align-self: end; }` — the challenge
prompt given the canvas's own grid cell, to stop it sitting on the sound buttons (see the entry
further down; this was that fix).
**Why it was wrong:** an item with an explicit grid position is placed *first*. The canvas is
auto-placed, found cell (1,1) already taken, and went into row 2 instead — so the moment the prompt
appeared the canvas and everything under it slid 36 px down, and slid back up when you walked away.
It happens every time you pass another player, which is constantly. The owner reported "the whole
screen shifts", and he was right.
**How I caught it:** the owner played it. Then `getBoundingClientRect()` on the canvas with the
prompt shown and hidden: `y: 47.36` against `y: 83.75`.
**The fix:** a positioned box round the canvas, `#arena`, with the prompt and the HUD absolutely
positioned inside it. Out of flow cannot move anything. Re-checked at 390x780 as well, and the sound
buttons still hit-test as themselves.
**Worth telling students:** two bugs in a row in the same three lines, both from trying to place a
floating thing *in* the layout. If something appears and disappears while the game runs, take it out
of the flow — do not find it a cell.

## 2026-08-16 — measured the layout fix against a page that never loaded it
**Lesson:** A10 (deploying) / verification
**What it produced:** a check that read the canvas rect before and after the prompt appeared and
reported it still moving, after the CSS fix was already on disk.
**Why it was wrong:** `openOrReuseTab` on a URL that is already open *reuses* the tab. It does not
reload it. The page under test was the copy the browser parsed twenty minutes earlier, without
`#arena` in it at all — the check was honest about a build that no longer existed.
**How I caught it:** the reported `nearbyBox` was at `y: 9`, the top of the page, which the new CSS
makes impossible. `document.querySelector('#arena')` returned null.
**The fix:** `Page.reload {ignoreCache: true}` before measuring, and re-issuing `Runtime.enable`
afterwards. Same rule GAME.md already gives about `setCacheDisabled`, one level up: it is not enough
to disable the cache if you never navigate.
**Worth telling students:** "I tested it and it still fails" is a claim about the code *and* about
what the browser was running. Check the second one first — it is one line and it is wrong more often
than you would like.

## 2026-08-16 — deleting the old footstep would have broken a lesson demo
**Lesson:** A17 (sound)
**What it produced:** `rm audio/step.wav` after replacing it with the softer `step-soft.wav`.
**Why it was wrong:** `demos/17-sound/main.js` loads `../../audio/step.wav` by name, and the demos
are lesson material that must not be edited. The demo would have gone from "step.wav loaded." to
"step.wav did NOT load." — a broken lesson, live, to fix a sound in the game.
**How I caught it:** grepping the whole repo for the old filename before committing, rather than
trusting that only the game used it.
**The fix:** `git checkout -- audio/step.wav`; the game points at the new file, the demo keeps the
old one, and `audio/README.md` says which is which and why.
**Worth telling students:** shared files have more than one reader. "Nothing else uses this" is a
thing to check with `grep`, not a thing to remember.

## 2026-08-16 — the save-on-the-way-out would have undone the handover
**Lesson:** A11 (saving)
**What it produced:** `const flush = () => persist(identity, player);` on `pagehide` and
`visibilitychange`, kept unchanged while adding the one-window-at-a-time rule.
**Why it was wrong:** a window that has just handed the game over still has the old position in
memory. Closing it — or the reload that "take the game back" and "start over" both end in — would
fire `flush` and write that stale position straight over the state the new window is actually
playing from. The takeover would look right for a second and then quietly rot on the next reload.
**How I caught it:** reading the new deactivate path against the old lifecycle handlers, before
testing. It would have been invisible in a two-tab test that never closed a tab.
**The fix:** `flush` writes only while this window still owns the game and is not deliberately
leaving. Both exit paths set `leaving = true` before they write the save they want.
**Worth telling students:** when you add a way for something to stop, go and read every line that
already runs at the end. "Save on the way out" is only right if you still have the truth.

## 2026-08-16 — the keyboard stopped working, and it was not the game
**Lesson:** A19 (challenging someone)
**What it produced:** `F` challenges whoever you are standing next to. Driving it from the browser
tools, `F` did nothing at all: the duel never started and the state machine stayed on `walking`.
**Why it was wrong:** it wasn't. The page had lost focus. A listener added from the console recorded
**zero** `keydown` events, while `game.near` still said `"Flint"` and the Challenge button was still on
screen — so the game was fine and the events were never arriving. Reloading the page did not fix it;
clicking anywhere on the page did, instantly.
**How I caught it:** by asking the page what it had *heard* rather than what it had *done* —
`addEventListener('keydown', e => window.__keys.push(e.key))`, then reading `window.__keys` back. An
empty array is a very different fact from a broken handler.
**The fix:** click the page first, then send keys. Nothing in the game changed.
**Worth telling students:** when input "does nothing", find out whether the event ever arrived before
you touch the code that handles it. Hours can go into fixing a handler that was never called.

## 2026-08-16 — the sound buttons were off the bottom of the window
**Lesson:** A17 (sound)
**What it produced:** a row of Sound / Music buttons under the game, added for stage 3.
**Why it was wrong:** the canvas sizes itself from the window height minus a fixed allowance for
everything under it (`calc((100svh - 5.5rem) * 4 / 3)`). Stage 3 added a whole row and did not change
the allowance, so the page grew taller than the window and the new buttons sat below the fold. Clicking
them did nothing, and *nothing* appeared in the console — a click on empty space is not an error.
**How I caught it:** the click reported success and `game.audio.on` was still `false`. Asking the page
where the button actually was gave `y: 899` in a 710-pixel-tall window, and
`document.elementFromPoint(...)` on its own centre returned `null` — it was not on screen at all.
**The fix:** raise the allowance to `14rem`, and check `document.body.scrollHeight === innerHeight`.
**Worth telling students:** "I clicked it and nothing happened" has two very different causes — the
handler is wrong, or the click never landed on the button. Measure before you debug.

## 2026-08-16 — the Challenge button sat on top of the sound buttons
**Lesson:** A19
**What it produced:** `#nearby`, the button that appears when you walk up to someone, positioned with
`position: absolute; bottom: 7.5rem` so it would float over the game.
**Why it was wrong:** `bottom` is measured from the bottom of `#stage`, which is the whole column —
canvas, phrase bar, hint line and tools. 7.5rem up from there is exactly where the sound buttons live,
so the sound row was underneath something else.
**How I caught it:** the same `elementFromPoint` check, which named a different element than the one
being clicked.
**The fix:** put `#nearby` in the canvas's own grid cell (`grid-row: 1; align-self: end`) instead of
measuring from the page bottom. Now it is over the canvas by construction, whatever else is on the page.
**Worth telling students:** `position: absolute` is measured from an ancestor you have to go and look
up, and it is rarely the box you had in mind. Putting something in a grid cell says what you meant.

## 2026-08-16 — "sUSd left" is not what a person needs to read
**Lesson:** A19 / A22
**What it produced:** when an opponent closes their tab mid-duel, the other player is told the duel is
over and who left.
**Why it was wrong:** the message said `sUSd left` — the first four characters of their network id.
`net.js` deleted the peer record and *then* closed the duel link, and a link looks its opponent's name
up from the peer record. By the time anything asked, "Bob" no longer existed.
**How I caught it:** played it. Closed one of the two browsers mid-round and read the other one's screen.
**The fix:** close the link before forgetting the peer. Two lines swapped.
**Worth telling students:** the fallback name exists for a good reason — a peer we were never
introduced to. It just also fired in a case where the name was known a millisecond earlier. Ordering
bugs like this never appear on the happy path, only on the leaving-and-crashing path, which is exactly
the path you have to go and act out on purpose.

## 2026-08-16 — the goodbye was posted to someone who had already gone
**Lesson:** A22
**What it produced:** when a duel ends because the other player vanished, this side sends them an "I am
leaving" message so nobody is left staring at three buttons.
**Why it was wrong:** if they vanished because they *closed the tab*, that message goes to a peer
trystero no longer has, and it logged `Trystero: no peer with id … found` — several times, in a console
that is otherwise deliberately kept empty.
**How I caught it:** draining the browser's own event stream after acting out the tab-close case.
Warnings are easy to skim past; a rule of "the console is empty or I go and look" is what makes them
visible.
**The fix:** a link marks itself dead when the peer leaves, and a dead link swallows anything sent down
it. The duel code did not change — it should not have to know.
**Worth telling students:** a library warning in your console is usually your bug, not the library's.
"Send it anyway, it probably works" is how a console fills with noise you eventually stop reading.

## 2026-08-16 — two tabs of the game were the same player, and I nearly tested nothing
**Lesson:** A17–A18 (other people) / A11 (saving)
**What it produced:** the two-tab check for stage 2. Open the game in a second tab, walk in one, watch the
other. Both tabs were on `http://localhost:8821/`.
**Why it was wrong:** `localStorage` belongs to the *origin*, not the tab. The second tab read the first
tab's save, so it came up with the same name and the same monster, and the two tabs then wrote their
positions over each other in the same key. The peer half of the test would still have passed — trystero's
`selfId` is made fresh per tab, so they really are two peers — while proving almost nothing: I could not
have told "tab B is drawing the monster tab A chose" from "both tabs happen to be Scorchwing".
**How I caught it:** the second tab skipped the name panel and walked straight into the dungeon. A player
the game has never met should be asked two questions.
**The fix:** give each tab its own origin. `http://localhost:8821` and `http://127.0.0.1:8821` are the same
files on the same server and two different origins, so two different saves; for a third player, a second
`python3 -m http.server` on port 8822, because the port is part of the origin too.
**Worth telling students:** "open it in two tabs" is the standard way to test a game with other people in
it, and it quietly hands you one player wearing two hats. Anything *saved* is shared between those tabs.
Make the two players genuinely different — different names, different monsters — or the test cannot fail.

## 2026-08-16 — 127.0.0.2 was a reasonable idea that simply did not exist
**Lesson:** A17 (other people)
**What it produced:** a third player opened at `http://127.0.0.2:8821/`, on the theory that the whole
`127.x` range is loopback and the server was listening on all addresses.
**Why it was wrong:** the server was listening on `0.0.0.0`, but macOS only configures `127.0.0.1` on the
loopback interface by default. There was nothing at `127.0.0.2` to answer.
**How I caught it:** the tab sat on `about:blank`, and the failure surfaced as "element not found:
`#name-input`". The error pointed at the form; the fault was one layer below the page existing at all.
**The fix:** a second server on port 8822. A different port is a different origin, which was the only
thing actually wanted.
**Worth telling students:** when an element is "not found", check the page loaded before hunting the
selector. Asking the browser what URL it is actually on answers in one line what ten minutes of staring
at a selector will not.

## 2026-08-16 — I could not corrupt the save, because the game kept repairing it
**Lesson:** A11 (saving) / A16 (the game)
**What it produced:** the check for "a broken save must not break the game". I wrote rubbish into
`localStorage` from the console, reloaded, and the game came up perfectly happy with the *old* name,
monster and position — which reads exactly like the save code silently ignoring bad input, or like the
test doing nothing at all.
**Why it was wrong:** the test, not the game. The running game writes its save twice a second, and writes
once more on `pagehide` (which fires on reload). So between "console writes rubbish" and "page reloads"
the game wrote a perfectly good save back over it. Twice over.
**How I caught it:** read the save back after the reload and found the *original* uuid still in it — the
one thing that could not have survived a genuinely fresh start.
**The fix:** corrupt the save and disable the page's own writer in the same turn, then reload:
`localStorage.setItem(KEY, rubbish); localStorage.setItem = () => {}; location.reload()`. With that, both
cases behave: unparseable text and a `version: 0` object each log one warning and start fresh at the name
prompt, with no exception.
**Worth telling students:** a test that changes something the program is still actively writing is racing
it, and losing quietly. If your setup can be undone by the thing you are testing, it is not a setup.

## 2026-08-16 — the wall tests "passed" while nothing had moved
**Lesson:** A15 (walls) / A16 (the game)
**What it produced:** a batch of collision checks that walked into four walls and read the position back.
Every reading came out exactly equal to the position I had set beforehand, which looks like "the wall
stopped me" and is also what "the game never received a key" looks like.
**Why it was wrong:** twice, for two different reasons. (1) A held pointer beats the keyboard, and my
"click the canvas to focus it" click had left a pointer sitting on the monster's own feet — the monster was
being told to walk to where it already was, so the keys were ignored. (2) After a `reload`, synthetic key
events stopped reaching the page entirely: the debugger session has to be re-attached to the tab, exactly
like the console channels do.
**How I caught it:** planted a listener (`addEventListener('keydown', …)`) and read what the page had
actually seen. It had seen nothing.
**The fix:** re-attach after every navigation, and sample the input state mid-press — `{dx: 0, dy: -1}` —
before believing any position readback. The real numbers then came out exact: walking north stops at
y = 416 = 13 x 32, south at y = 690 = 22 x 32 - 14, west at x = 576 = 18 x 32, east at x = 940 = 30 x 32 - 20.
**Worth telling students:** "nothing changed" is not a result. Before reading a number that proves
something stopped, prove that it was moving in the first place.

## 2026-08-16 — two tabs, two different lies from my own test rig
**Lesson:** A19 (challenge someone)
**What it produced:** a two-tab check that reported the demo was fine when it was reading nothing at all.
**Why it was wrong:** two separate faults, both in the checker, not the demo.
(1) To get two tabs I opened `…/19-challenge/#a` and `…/19-challenge/#b`. When I later re-navigated a tab
to the same address with only the `#` part different, **the browser did not reload the page** — a hash-only
navigation changes no document. So I kept testing a stale copy of my own file: `window.getState()` was
missing a field I had added seconds earlier, and the random per-tab id stayed the same across a "reload",
which is what gave it away. The fix was `Page.reload` with the cache ignored, not a fresh address.
(2) The console reader returned an empty list — including no sign of the `console.warn('canary')` I had
just sent. The debugging channels have to be switched on again after every navigation, and I had not done
it. An empty console reading is not the same as a clean console, and the only way to tell them apart is to
put a known message in and check you can see it.
**How I caught it:** the canary. Every "console is clean" claim in this file was checked by first proving
the checker could see a message I planted.
**The fix:** re-enable the channels after every navigation, and never trust an empty result without a canary.

## 2026-08-16 — "both players challenge at the same moment" could not be produced by pressing two keys
**Lesson:** A19 (challenge someone)
**What it produced:** the rule for two players challenging each other at the same instant — treat it as
agreement and start the fight — was written, and then could not be tested. Twice, two quick key presses in
two tabs produced an ordinary sequential challenge instead: the first tab's message had already arrived
before the second key was pressed.
**Why it was wrong:** nothing was wrong with the demo. The race window is a few tens of milliseconds wide,
and a tab that is not on screen has its timers slowed down by the browser on purpose, to save battery. So
"press F in both tabs at about the same time" is not a thing a test can do by asking politely.
**How I caught it:** the state read back was `waiting` / `asked` — a normal challenge — not the
`fighting` / `fighting` the rule predicts.
**The fix:** picked a wall-clock instant a few seconds in the future, told both pages to wake up two
seconds early and then spin in a tight loop until that exact millisecond, and fire the key event there.
Both pages reported firing at the same millisecond, and both then went to `fighting`. The branch is real
and now proven.

## 2026-08-16 — a red error in the console during behaviour that is completely correct
**Lesson:** A19 (challenge someone)
**What it produced:** closing one of the two tabs — the exact thing the "the other player walked away"
rule is for — printed a red error in the surviving tab:
`RTCErrorEvent { error: OperationError: User-Initiated Abort, reason=Close called, target: RTCDataChannel }`
**Why it was wrong:** it is not wrong. The direct connection between the two browsers was closed by the
other side, and the library reports the closed channel as an error. The surviving tab handled it properly:
it dropped the missing player and left the "waiting for an answer" state on its own, about seven seconds
later. Same shape as the dead-relay warning in A12 — an error in the console is not the same as a broken
game.
**How I caught it:** read the console during the leave test instead of only checking the state afterwards.
**The fix:** none in code. It is written into the lesson so a student who sees it does not think they broke
something.

## 2026-08-16 — the loading message wiped out the message that was the whole point
**Lesson:** A17 (sound)
**What it produced:** the demo asks to play music on page load so that the browser's refusal can be seen.
The refusal was caught correctly — `window.firstPlayError` held it — but the line on the page said
`step.wav is ready.` instead.
**Why it was wrong:** two different messages were sharing one line, and `canplaythrough` is not a
once-per-page event. It fires again every time a sound is rewound to the start, so a footstep at any moment
could overwrite whatever the status line was saying. On load it simply arrived last and won.
**How I caught it:** drove the demo in a real browser and read the text of the element back, rather than
trusting that the code that set it had run. The value in `window.firstPlayError` and the text on screen
disagreed.
**The fix:** two separate lines on the page — one for "did the file load", one for "did it play" — which is
also the honest shape, because loading and playing fail separately. Plus `{ once: true }` on the load
listener.

## 2026-08-16 — the browser refused to play a sound, exactly as designed
**Lesson:** A17 (sound)
**What it produced:** `music.play()` called during page load, with nobody having touched the page, rejected
with:
`NotAllowedError: play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD`
**Why it was wrong:** it was not a mistake — it is the rule, and the demo now provokes it on purpose so
students meet it with an explanation instead of as a mystery. Worth recording because the failure is
*silent* unless you attach a `.catch`: `play()` hands back a promise, and an ignored rejected promise means
no sound, no error, and nothing to look at.
**How I caught it:** attached `.catch` to the promise and stored the message, then read it back from the
console after the page loaded untouched.
**The fix:** every `play()` in the demo has a `.catch`, and the first one puts its refusal on the screen.

## 2026-08-16 — a commit swept up two scratch files belonging to somebody else
**Lesson:** none directly — a working habit
**What it produced:** commit `a69e6db` ("Swap a dead relay in the peer-to-peer demos") contains
`_tileview.html` and `_makeframes.html`, two throwaway tools I had written in the repo root minutes earlier
to draw the sprite sheets at 4x and to test making my own walk frames. They have nothing to do with that
commit, and one of them tests an idea that was abandoned.
**Why it was wrong:** the commit was made with `git add -A` (or `git commit -a`), which stages *everything*
in the folder, including files somebody else is in the middle of writing. In a repository that only one
person is touching this is harmless. In a shared one it puts other people's unfinished work into your commit
message's history under your name.
**How I caught it:** deleting my own scratch files afterwards, and seeing git report them as `D` (tracked and
deleted) rather than simply vanishing. Untracked files do not show up like that.
**The fix:** deleted both in my own commit, and stage by name from now on — `git add demos/14-monster` — not
by "everything that changed".

## 2026-08-16 — two pictures that differ by 30 pixels, and none of them are the legs
**Lesson:** A14 (your monster)
**What it produced:** hunting for a walk cycle inside `tiny-dungeon.png`, I stopped trusting my eyes and
diffed every pair of the 20 character cells pixel by pixel. The two closest pairs looked like a jackpot:
cells 85 and 98 differ in only 30 pixels out of 256, **all of them in the bottom six rows**, with a
pixel-identical head. Cells 85 and 88 differ in 31 pixels, mostly around the arms. On the numbers, that is
exactly the shape of a walk frame: head still, legs moved.
**Why it was wrong:** I printed both cells as text, one character per pixel, and the shapes were identical —
only the **colours** had changed. 85 is a villager with bare hands and brown legs; 98 is the same villager
drawn in armour, with blue-grey hands and blue-grey legs. Nothing has moved. Alternating them at 8 pictures a
second would not be a monster walking, it would be a monster changing clothes.
**How I caught it:** looked at the actual pixels instead of the difference count. A pixel diff tells you
*how many* pixels changed and *where*; it cannot tell you whether the shape moved or the paint changed.
**The fix:** used `pixel-platformer-characters.png` cells 0 and 1, where the legs really are in two
different places — I checked those as text too before writing a line of the demo. Cell 0's legs sit under the
body on rows 20-23; cell 1's are spread wide and the whole body is one pixel higher.
**Worth telling students:** I nearly spent an hour drawing my own second frame because I trusted a number
over a picture. When you are working on something you can *see*, look at it.

## 2026-08-16 — the planning docs promised a Kenney pack that does not exist, and a walk cycle that is not there
**Lesson:** A14 (your monster), A16 (the world)
**What it produced:** `planning/kakkoi-online-sources.md` listed **"Kenney — Tiny Creatures"** as one of the
two art packs, and the whole art plan assumed Tiny Dungeon would supply an animated character.
**Why it was wrong:** two separate errors.
(1) Kenney publishes no pack called Tiny Creatures. His Tiny series is farm, town, battle, ski, dungeon.
*Tiny Creatures* is real and is CC0, but it is by **Clint Bellanger** on OpenGameArt, built as an expansion of
Kenney's sets "made with Kenney's permission". Crediting the wrong author on a public children's site is the
kind of mistake that is embarrassing rather than illegal, but it is still a mistake, and it was written down
as fact in a document whose entire job is provenance.
(2) Tiny Dungeon's 20 characters are **one pose each** — there is no second frame, so nothing in the pack can
walk. Tiny Creatures' 180 monsters are also one pose each.
**How I caught it:** loaded every atlas in a real browser, drew each one at 4x with a red 16 px grid and the
cell index printed in every cell, and looked at the picture. Cells 84-88, 96-100, 108-112 and 120-124 of
`tiny-dungeon.png` are twenty different people, not one person twenty times.
**The fix:** vendored **Kenney Pixel Platformer's** character sheet as well — 216x72, 24 px cells, characters
laid out as adjacent pairs (legs together, legs apart), which is a real two-frame walk. Different art style
from the 16 px dungeon set; A14 has to say so rather than pretend. Both corrections are now written into
`vendor/README.md` and `planning/kakkoi-online-sources.md`.

## 2026-08-16 — a guessed download URL 404'd, and the conclusion drawn was "the site blocks downloads"
**Lesson:** A14 / A16 / A17 (art and sound)
**What it produced:** `curl https://kenney.nl/media/.../kenney_tiny-dungeon.zip` returned 404, and that was
read as "kenney.nl only serves downloads to a browser", which blocked three lessons.
**Why it was wrong:** the URL had been guessed. Kenney's zip URLs contain a content hash that changes every
time he re-uploads a pack, so no zip URL can be guessed — but every asset page prints the current one in its
HTML, behind the "Continue without donating" link. Plain `curl` fetches it with no headers, no cookies and no
browser:
`curl -sL https://kenney.nl/assets/tiny-dungeon | grep -o "href='[^']*\.zip'"`
then curl that. Six Kenney packs were downloaded this way in about a minute.
**How I caught it:** read the asset page's HTML instead of assuming what was in it.
**The fix:** the real URLs are recorded in `vendor/README.md` and `planning/kakkoi-online-sources.md`, next to
the one-line command that regenerates them when they rot.

## 2026-08-16 — the audio format the plan chose is the one format that is not safe
**Lesson:** A17 (sound)
**What it produced:** the plan said "ship `.ogg` with an `.mp3` fallback", using Kenney's CC0 audio packs.
**Why it was wrong:** Kenney's audio packs contain `.ogg` **only** — there is no mp3 to fall back to. And this
machine has no `ffmpeg`, no `sox` and no `oggenc`, so nothing can convert one into the other. Ogg Vorbis is
also the one common audio format with patchy Safari support, so shipping ogg alone would have meant sound
that silently does nothing on a lot of the machines children actually use.
**How I caught it:** unzipped the packs and looked at the file extensions, then checked for an encoder before
planning around one.
**The fix:** picked sources that already ship the formats we need — Juhani Junkala's CC0 512-sound pack is
WAV (each effect here is under 0.3 s, so a WAV is 4-24 kB) and the music loop is a CC0 MP3. WAV and MP3 play
everywhere. All seven files were then played in a real browser, not just loaded: the six effects ran through
to `ended`, and the music was still playing when the check stopped it.


## 2026-08-16 — "the console is clean" was said about a console that was full of warnings
**Lesson:** A12 / A13 (other people, talking safely)
**What it produced:** both peer-to-peer demos were checked, twice, and reported as having a clean console.
The drained event queue came back with nothing in it.
**Why it was wrong:** the queue had never been switched on. Re-running the same check after
`await cdp('Runtime.enable')` — and after proving the checker could see a deliberate `console.warn('probe-warning')`
— produced a steady stream of real warnings from the library: `Trystero: relay failure from
wss://relay.nostromo.social/ - blocked: not on white-list` and `Trystero: relay failure from
wss://nostr.grooveix.com/ - blocked: only certain pubkeys are allowed to post`, repeating every few seconds
in both demos. Two of the library's default noticeboards refuse the notes we post. Peers still connect,
because the other noticeboards accept them — so the demo looked perfect while shouting into the console.
**How I caught it:** another agent's entry in this same file said `Runtime.enable` is required before draining.
Then the honest version of the check: print a warning I know is there, and confirm the checker sees it.
**The fix:** named the noticeboards explicitly instead of taking the defaults —
`joinRoom({appId, relayUrls: ['wss://relay.snort.social', 'wss://nostr.sathoarder.com',
'wss://eu.purplerelay.com', 'wss://nostr.vulpem.com']}, 'demo')`. An intermediate attempt that kept six
relays still warned, from a *different* one: `relay.nostraddress.com - auth-required: authenticate to
publish events`. With the four above, two tabs connected and both consoles drained completely empty.
**Worth telling students:** "no errors" is only worth something if you have seen the thing that reports
errors report one. And a library warning is still your problem, because it is your user's console.

## 2026-08-16 — a player who never said goodbye stayed on screen for minutes
**Lesson:** A12 (other people)
**What it produced:** with the demo open in two tabs, `others` in one tab contained three peers, not one:
`{"6pht…":{"x":411.7,"y":288},"VYsHeP…":{"x":100,"y":100},"kouGv2…":{"x":100,"y":100}}`. Two of them were
tabs from an earlier round that had been shut down by the test tooling.
**Why it was wrong:** `onPeerLeave` fires when a peer disconnects politely. A tab that is killed outright
never sends anything, so the square stands at its last known position — here, the starting position
`{x: 100, y: 100}` — until the connection eventually times out. One ghost was still there 25 seconds later.
**How I caught it:** the screenshot had more squares in it than there were tabs open.
**The fix:** none in the demo — this is honest behaviour and it is now the lesson's "Your turn" exercise
(remember when each message arrived, hide anyone silent for three seconds). The screenshot was retaken.
**Worth telling students:** "they left" and "we stopped hearing from them" are different facts, and a
network can only ever tell you the second one directly.

## 2026-08-16 — the "try to cheat" button could cheat honestly, one time in three
**Lesson:** A22 (no peeking)
**What it produced:** the cheat button reveals a move the player never committed to — specifically the move
that beats yours: `const swapped = MOVES.find((m) => BEATS[m] === you.move)`.
**Why it was wrong:** the fake opponent commits to a *random* move. About one time in three, the move that
beats yours is the move they actually committed to. In that case the cheat button reveals exactly what was
committed, the hashes match, and the demo reports an honest round — the button whose whole job is to be
caught quietly succeeds. The one visible feature of the demo would have failed on roughly a third of
presses, and it would have looked like the checking code was broken rather than the test button.
**How I caught it:** read it, before running it. Not by testing — a run has a two-in-three chance of looking
perfect, which is exactly the kind of bug a quick manual test blesses.
**The fix:** pick a different move when the "beats you" move is the one they committed to:
`const swapped = better !== them.move ? better : MOVES.find((m) => m !== them.move)`. Then drove the button
in the browser: committed `earth`, revealed `water`, `lastCheck` came back
`{"youHonest":true,"theyHonest":false}` and the page showed "Caught cheating!".
**Worth telling students:** a test that only fails sometimes is worse than one that always fails. If your
"make it break" button is itself random, it is not a test, it is a coin toss.

## 2026-08-16 — "SHA-256 will not work from a file, only from Live Server" turned out to be false
**Lesson:** A22 (no peeking)
**What it produced:** the plan for the lesson said flatly that `crypto.subtle.digest` needs a secure context,
so opening `index.html` by double-clicking it would fail and only Live Server would work. It was going to be
written into the lesson as a fact.
**Why it was wrong:** modern Chrome treats a `file://` page as a secure context. Opening the demo straight
off disk reported `window.isSecureContext === true`, `crypto.subtle` present, and the two hashes appeared on
screen normally: `9f138de5d15f1920608a2ebadbdb68a3…`. The rule ("secure context required") is real; the
consequence claimed for it was not, at least not in this browser.
**How I caught it:** loaded the demo over `file://` on purpose to photograph the failure, and there was no
failure to photograph.
**The fix:** the lesson now states the rule that browsers actually follow — the page must be a secure
context, and `http://localhost` from Live Server always is — instead of promising a breakage that does not
happen. No invented bug goes in the lesson.
**Worth telling students:** "this will not work unless…" is a claim, and claims get checked. Ours did not
survive first contact with the browser.

## 2026-08-16 — the "clean console" check was reading an empty pipe
**Lesson:** A11 (save the game)
**What it produced:** a verification round that drained the browser event queue after loading the demo,
found no console entries and no exceptions, and reported the console clean.
**Why it was wrong:** the queue never contained console messages at all. The demo had definitely printed
a warning — the corrupt-save path calls `console.warn` — and the drain came back `[]`. Proving that a
check works when there is nothing to find is impossible; proving it *fails to find something that is
definitely there* is easy. A probe of `console.warn('probe-warning'); console.error('probe-error')`
drained as `[]` too, and the only event kind ever seen was `Target.attachedToTarget`.
**How I caught it:** deliberately printing a message I knew was there and watching the checker miss it.
**The fix:** `await cdp('Runtime.enable')` before draining. The very next drain returned the whole
backlog, including the real one: `["save is not readable, starting fresh:", "Expected property name or
'}' in JSON at position 1 (line 1 column 2)"]` and `["save is version", 1, "and we speak", 2, "-
starting fresh"]`. Runtime.enable has to be re-issued after each navigation.
**Worth telling students:** a test that always says "fine" is not a test. Before you trust a checker,
break something on purpose and make sure it notices.

## 2026-08-16 — the square would not move, and the code was right
**Lesson:** A11 (save the game)
**What it produced:** a check that typed the name `Mika` into the name box, then held ArrowRight for
0.7 s and ArrowDown for 0.35 s. Position before: `{"x":100,"y":100}`. Position after: `{"x":100,"y":100}`.
Nothing moved. The keyboard block looked broken.
**Why it was wrong:** the keyboard was fine and so was the demo. Typing the name had left the keyboard
focus **in the input box**, and the demo deliberately ignores keys aimed at that box
(`if (e.target !== nameBox)`). The arrows were going into a text field, exactly as designed.
**How I caught it:** printed `document.activeElement.id` — it said `name`.
**The fix:** `click('#world')` first (activeElement then read `BODY`), and the same key holds gave
`{"x":253.98,"y":177}`. That click is now step 2 of the lesson's "See it work", because a student will
hit this the moment they type their name.
**Worth telling students:** "it does not respond to the keyboard" and "the keyboard is going somewhere
else" look identical from the outside. Ask the page which thing currently has the keyboard.

## 2026-08-16 — a browser rendering 2 frames a second made a working demo look broken
**Lesson:** A15 (walls)
**What it produced:** the slide test — hold Right into a rock plus Down — reported no movement at all
after a 0.5 s hold: `{"x":128,"y":60}` before, `{"x":128,"y":60}` after. Holding Down alone for a full
second moved the square 55 pixels, when it travels 220 pixels per second.
**Why it was wrong:** 55 is exactly `220 × 0.25`, and `0.25` is the demo's `dt` clamp. The page had
rendered **one single frame** in that whole second. A frame counter confirmed it: `frames in ~1s: 2`.
The automated browser window was not being painted at anything like 60 Hz, so `requestAnimationFrame`
barely ran. `document.visibilityState` still said `visible`, which is why this was not obvious.
**How I caught it:** the number 55. It was too round. Dividing it by the speed gave 0.25 — a constant
that appears exactly once in the file, in the `dt` clamp — so the loop must have run once.
**The fix:** stopped fighting it and held the keys long enough for the few frames available: 4 s into the
wall gave `{"x":128,"y":60}` (the wall's edge, exactly `160 - 32`), then 3 s of Right+Down gave
`{"x":128,"y":225}` — sideways pinned, downwards free. The slide had worked the entire time.
**Worth telling students:** before believing a game is broken, check that it is actually running. "It did
not move" can mean "it was never asked to move". The clamp that protects you from a giant `dt` is also
the fingerprint that tells you how many frames really happened.

## 2026-08-16 — two browser-driving helpers that do not exist
**Lesson:** A11 / A15 (verifying in a real browser)
**What it produced:** a verification script calling `pressKey('ArrowRight', { duration: 0.6 })`.
**Why it was wrong — verbatim errors:** `Error: Invalid parameters` with no hint of which parameter, and
then, when asked for its documentation, `Unknown helper: pressKey` — the helper was listed in the
tooling notes but is not actually present in this runtime. `help()` with no argument printed nothing.
**How I caught it:** the script exited with code 1 before a single key was pressed.
**The fix:** dropped to the raw browser protocol and held keys by hand —
`cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code })`, wait, then `type: 'keyUp'`. This is
also the only way to *hold* a key rather than tap it, which both demos need.
**Worth telling students:** a documented function and an existing function are not the same thing. When
a tool says "invalid parameters", check that the tool exists at all before you start guessing at
parameters.

## 2026-08-16 — the vendored library's file list was one file short, and nothing said so
**Lesson:** A12 (other people)
**What it produced:** a plan to vendor trystero as exactly five files: `nostr.js`, three files under `src/`,
and `node-crypto.js`. All five downloaded fine.
**Why it was wrong:** the very first line of `node-crypto.js` is `import"./chunk-ETRHX7GZ.mjs";` — a sixth
file nobody had listed. It imports nothing *from* it, so it is easy to miss when you skim for
`import {x} from "y"`. Left alone, the browser would have asked the server for a file that does not exist.
**How I caught it:** instead of reading the imports, I listed every `".../*.mjs"` string in all five files
with `grep -oE '"[^"]*\.mjs"'` and counted them. Six paths came back, not five.
**The fix:** fetched `https://esm.sh/node/chunk-ETRHX7GZ.mjs` as `node-chunk.js` and rewrote the specifier
with the others. The server log then showed six requests, all `200`, and no `404` except the browser's
automatic ask for `favicon.ico`.
**Worth telling students:** when you copy a library into your own project by hand, "the set is closed" is a
claim you have to *check*, not a thing you hope. The check is boring: list every path the files mention,
and make sure every one of them is a file you have.

## 2026-08-16 — the screenshot kept timing out, and the demo was innocent
**Lesson:** A13 (talking, safely)
**What it produced:** `Error: CDP request timed out: Page.captureScreenshot`, twice in a row, on a page
that was otherwise responding to every command.
**Why it was wrong:** nothing was wrong with the page. `pageInfo()` reported the visible area as
`w: 360, h: 204` — the browser window had ended up smaller than the 480×320 canvas inside it.
**How I caught it:** asked the page how big it thought it was before assuming the demo had hung.
**The fix:** set the size explicitly (`Emulation.setDeviceMetricsOverride`, 720×560) and the screenshot came
back immediately.
**Also, in the same session:** the first successful screenshot was useless — both players were still at their
starting position `{x: 100, y: 100}`, so the two squares sat on top of each other and their name labels
overlapped into unreadable mush. Moved one player before taking the picture again.

## 2026-08-16 — closing the last tab deleted the workspace out from under the next command
**Lesson:** A13 (talking, safely)
**What it produced:** `Error: listTabs: Task space not found: 1` on a browser session that had been working
for twenty minutes.
**Why it was wrong:** the previous command had closed both open tabs to tidy up before the next demo.
Closing every tab in a browser workspace closes the workspace itself.
**How I caught it:** the error names the thing that vanished, which is the good kind of error message.
**The fix:** opened a fresh workspace. No lasting damage — but it is a reminder that tidying up is an action
with consequences, and worth doing at the end rather than the middle.

## 2026-08-16 — the browser test "clicked to focus" and polluted the keyboard test
**Lesson:** A10 (a square you can move)
**What it produced:** the first automated check of the demo did `click('#world')` "to give the page focus",
then pressed ArrowRight three times and read the square's position.
**Why it was wrong:** the demo listens for **pointer** events on that canvas. The click *was* a pointerdown,
so the square started travelling toward the middle of the canvas before a single key was pressed. The
reading came back `{"x":125.04,"y":102.38}` from a start of `{"x":100,"y":100}` — the square had moved
diagonally, when ArrowRight can only move it along x. A test of the keyboard had silently become a test
of the mouse.
**How I caught it:** the `y` value. ArrowRight cannot change `y`. The number was wrong in a way that only
made sense if something else had also moved the square.
**The fix:** dropped the click (the key listeners are on `window`, nothing needed focusing) and held the
key down for half a second instead of tapping it: `{"x":100,"y":100}` → `{"x":210,"y":100}`, y untouched.
**Worth telling students:** when you check that a thing works, check that *only* the thing you meant to do
happened. A number that moved in the right direction is not the same as a number that moved for the right
reason — and a value that should not have changed is the cheapest alarm you will ever get.

## 2026-08-16 — the automated drag "worked" but moved the square 7 pixels
**Lesson:** A10 (a square you can move)
**What it produced:** a drag across the canvas to test the pointer controls. Before `{"x":210.00,"y":188.24}`,
after `{"x":217.38,"y":186.99}`. Technically it moved. It looked like the pointer code was broken.
**Why it was wrong:** the pointer code was fine — the *test* was too fast. The square moves at 220 pixels
per second, and the synthetic drag pressed, moved and released within a few milliseconds. In that time the
square is entitled to about one pixel per frame, and then the pointer was gone. A speed measured per second
only shows up if you let a second pass.
**How I caught it:** by not accepting "it moved a bit" as a pass. Held the button down for 1.5 s instead and
the square crossed the canvas properly: `{"x":217.38,"y":186.99}` → `{"x":23.21,"y":264.31}` toward the
bottom-left, then → `{"x":306.05,"y":94.72}` toward the top-right.
**Worth telling students:** almost everything in a game is expressed *per second*. A test that takes
milliseconds cannot see it. That is the same fact that makes the `dt` multiplication necessary in the first
place, arriving from the other direction.

## 2026-08-16 — two tool calls that failed outright before anything was verified
**Lesson:** A10 (verifying in a real browser)
**What it produced:** two browser-automation snippets, both rejected on the first run.
**Why it was wrong — verbatim errors:**
- `ReferenceError: Cannot determine intended module format because both 'require' and top-level await are
  present.` — mixed `require('fs')` with `await` in a script that is an ES module. Fixed with
  `import fs from 'node:fs'`.
- `ElementResolutionError: Element not found: ArrowRight` — called the key helper as
  `dispatchKey('ArrowRight', …)`, but its first argument is an *element*, not a key. Dropped to the CDP
  call underneath (`Input.dispatchKeyEvent`) instead, which also made it possible to hold a key down and
  release it later — which this demo actually needs, since it reads a set of *held* keys.
**How I caught it:** both were hard errors. Nothing subtle.
**Worth telling students:** the interesting part is the second one. The wrong call failed loudly, and the
replacement was *better* than what was originally reached for — being forced one level down exposed the
keyDown/keyUp split the demo is built around. A tool that refuses you is sometimes telling you your model
of the problem was too coarse.

## 2026-08-16 — nothing went wrong in the demos themselves
**Lesson:** A09, A10
**What it produced:** `demos/09-hello/` and `demos/10-player/`, plus the conversion of the repo to plain JS.
**What happened:** honestly, nothing. Both demos loaded with a completely empty console — no errors, no
warnings, no failed requests (checked against the browser's own event stream: no `Runtime.exceptionThrown`,
no `Log.entryAdded`, no `Network.loadingFailed`). The converted `tests/rules.test.html` printed
`3 passed, 0 failed` first try, and the main scaffold still reported `running (scaffold)`.
**Worth telling students:** this is recorded on purpose. A log of mistakes that only ever contains mistakes
teaches you that everything always breaks; the useful version also says when it didn't. Removing the build
step removed a whole category of things that *could* have gone wrong here — and that is most of why it
was removed.

## 2026-08-11 — the CNAME file did nothing
**Lesson:** A10 (deploying)
**What it produced:** a `CNAME` file in the repo root containing `online.kakkoi.dev`, copied into `dist/`
by the deploy workflow. It looked like the domain was configured. DNS was correct too.
**Why it was wrong:** a `CNAME` file only sets the custom domain for **branch-based** Pages publishing.
This repo publishes with **GitHub Actions**, where the domain lives in the Pages *configuration* — which
was `null`. So the file was inert, and the domain served nothing.
**How I caught it:** `gh api repos/OWNER/REPO/pages` showed `"cname": null` while `dig` showed the DNS
record resolving correctly. Checking both ends separately is what located it.
**The fix:** `gh api -X PUT repos/OWNER/REPO/pages -f cname=online.kakkoi.dev`, wait for the certificate,
then `-F https_enforced=true`.
**Worth telling students:** a file that looks like configuration is not configuration. When something
should be live and isn't, check each end on its own — is DNS right? is the host expecting this name? —
instead of staring at the middle.

## 2026-08-11 — index.html linked a file that was never vendored
**Lesson:** A10 (deploying) / A12 (CI)
**What it produced:** `index.html` with `<link rel="stylesheet" href="./vendor/basecoat.min.css">`, while
`vendor/` held only a README. Locally nothing complained — the page just rendered unstyled.
**Why it was wrong:** Bun's HTML bundler *resolves* linked assets, so the missing file was a hard build
error: `error: Could not resolve: "./vendor/basecoat.min.css"`. A broken link that a browser shrugs off is
fatal to a bundler.
**How I caught it:** CI. The typecheck and tests both passed; the deploy build failed. Exactly the split
the pipeline exists to expose — types being fine says nothing about the app existing.
**The fix:** downloaded the pinned `basecoat-css@1.0.2` stylesheet into `vendor/` and recorded the version
in `vendor/README.md`.
**Worth telling students:** "it looks fine locally" and "it builds" are different claims. This is also why
A10 deploys in week two — the gap shows up immediately instead of in month five.

## 2026-08-11 — CI workflow watched the wrong branch
**Lesson:** A12 (CI)
**What it produced:** `.github/workflows/deploy.yml` triggering on `branches: [master]`.
**Why it was wrong:** the repo was created with `main` as the default branch, so the workflow matched
nothing. No error, no red X — just silence.
**How I caught it:** noticed `HEAD -> main` in the output of `gh repo create --push` and checked the
workflow against it.
**The fix:** `branches: [main]`, and the same in the deploy job's `if:` guard.
**Worth telling students:** a CI that never runs looks exactly like a CI that passes. Green is not the
same as checked — go and look at the run.

## 2026-08-16 — read back a stale copy of my own edit and believed it
**Lesson:** A10 (running it locally) / verification discipline
**What it produced:** added a `<a id="learnLink">` to `index.html`, reloaded the page through the
browser tools, and read `document.querySelector('#learnLink')` back as `null` — twice. The obvious
conclusion was that the edit was wrong.
**Why it was wrong:** the edit was fine. `curl` on the same URL showed the new markup immediately, so
the file on disk and the file the server was sending were both correct. What was stale was the copy in
the tab: `Network.setCacheDisabled` was on, but reusing an already-open tab never re-fetched the
document at all, so nothing about the cache setting mattered.
**How I caught it:** checked the server's answer with `curl` before touching the code again — the one
place where the two stories could differ.
**The fix:** an explicit `Page.reload {ignoreCache: true}`, after which the element was there.
**Worth telling students:** when the browser disagrees with your editor, find out which copy the
browser is actually holding before you change the code. "It is not there" and "I am looking at
yesterday's page" are indistinguishable from the console, and one of them is not a bug.

## 2026-08-16 — tested "offline" against a network that was never cut
**Lesson:** A10 / testing a service worker
**What it produced:** `Network.emulateNetworkConditions {offline: true}`, then a reload, then
`Network.enable` so the console could be read — and a triumphant readback showing the game booting
"with no network".
**Why it was wrong:** enabling the Network domain resets the emulated conditions. The offline flag had
been thrown away before the reload, so the game booted from the network like any other page and the
service worker proved nothing at all.
**How I caught it:** the honesty check that should be in every offline test — `fetch()` something that
is deliberately NOT in the precache list. It returned `200`, which is impossible offline.
**The fix:** set the offline condition *after* every `Network.enable`, and prove the cut with both an
uncached same-origin request and an off-site one before believing any result. Re-run: the uncached
fetch fails, the cached one is served, and the game boots anyway.
**Worth telling students:** a test that cannot fail has not passed. Before trusting "it works
offline", check that something is genuinely broken offline — otherwise you have tested nothing but
your own optimism.

## 2026-08-16 — the docs named six monsters the game has never had
**Lesson:** A20–A22 (the duel) / keeping documents honest
**What it produced:** `DESIGN.md` describing the six playable creatures as "Scorchwing and Emberhorn
(fire), Brinescale and Frostguard (water), Mossgolem and Sporecap (earth)", and a comment in
`src/npc.js` calling monster 1 "Emberhorn". `data/monsters.json` has called them Sunmane, Bristle,
Rumble, Bandit, Fern and Coco since the day it was written.
**Why it was wrong:** the names came from an earlier design and were never revisited when the real
creatures were picked out of the atlas. Nothing broke, so nothing ever complained — the drift only
became visible when the six were read out on screen next to the document that described them.
**How I caught it:** grepping for the old element names while removing the concept, and comparing what
came back against `data/monsters.json`.
**The fix:** `DESIGN.md` now names the six that exist, and `npc.js` says Bristle.
**Worth telling students:** a document that is never executed is never tested. Data files are the
truth; anything that only repeats them will eventually be wrong, and the cheapest defence is to check
them against each other whenever you are in there for another reason.

## 2026-08-16 — the service worker served the game in place of every other page
**Lesson:** A10 (deploying) / PWA
**What it produced:** a `fetch` handler that answered *any* navigation with the cached
`index.html`, on the reasoning that offline there is nothing else it could answer with.
**Why it was wrong:** a service worker registered at the root has the whole origin for its scope, so
"any navigation" is not "the game" — it is every other page in the repo and every page a fork ever
adds. Opening `tests/rules.test.html` loaded the *game*: same URL in the address bar, the game's
markup underneath. Nothing errored. A test page that silently becomes a different page is worse than
one that fails, because the failure it hides is your own test run.
**How I caught it:** the last check of the session, re-running the tests through the same server after
the worker was installed. `document.querySelector('#summary')` was `null`, and the page title was
"Kakkoi Online" instead of "Kakkoi Online — rules tests".
**The fix:** answer with the shell only for navigations to the scope root (`start_url`) or
`./index.html`. Everything else falls through to the network and fails on its own honest terms. Cache
version bumped so the broken worker cannot survive.
**Worth telling students:** a service worker's scope is bigger than the page you were thinking about
when you wrote it. Before shipping one, open a *different* page on the same site — the one you were
not thinking about is the one it breaks, and it breaks it silently.

## 2026-08-17 — say no once and that person can never challenge you again
**Lesson:** A19 (the challenge state machine)
**What it produced:** while removing commit–reveal, two browsers on two origins. Bo challenged Ayu
while Ayu was still looking at a finished duel screen, so Ayu's machine politely refused — correct.
Ayu then went back to the world, and from that moment on **every** challenge Bo sent was refused
instantly, forever. `duel.challenge()` returned `true` and the state was back to `walking` before the
next line of the test could read it.
**Why it was wrong:** when a duel arrives while we are busy, `receive()` attaches a tiny
refuse-everything handler to that conversation and returns without adopting it. Nothing ever takes
that handler off. `net.js` announces a conversation to the duel only the *first* time it sees one, so
the next ask from the same person went straight back into the stale handler instead of reaching the
state machine that was, by then, perfectly free.
**How I caught it:** the second peer duel of the session failed where the first had worked. Reading
`game.duel.debug` immediately after `challenge()` showed `walking`, which is far too fast for a
timeout and could only be an answer that had already been decided.
**The fix:** the refusal now closes the link after sending it, so the transport forgets the
conversation and the next ask arrives as a new one.
**Worth telling students:** a handler you attach for one moment and never remove is a decision you
have made forever. If some code says "no" on your behalf, be sure you know what ends it — the bug it
causes will not look like the code that caused it.

## 2026-08-17 — the canvas measured its own box, and the box was sized by the canvas
**Lesson:** A16 (drawing) / making the world fill the screen
**What it produced:** the new `fitCanvas()` sized the canvas to the box it sits in. On a 390px phone
it reported a 640px box and made a 640px canvas — the whole width of the old fixed canvas, on a screen
that is not that wide, with the right-hand third of the world off the side of the phone.
**Why it was wrong:** `#arena` was a grid *item* with `width: 100%`. A grid column is sized by the
content in it, and the content was a canvas whose HTML `width="640"` attribute still gave it a 640px
intrinsic size. So the column became 640px wide, `100%` of it was 640px, and the canvas was measured
against a box that its own old size had created. The measurement was circular, and it happily agreed
with itself.
**How I caught it:** reading the numbers back rather than looking at the picture —
`getBoundingClientRect()` said `w: 640` on a viewport that said `innerWidth: 390`, which is impossible
for anything that fits.
**The fix:** `#arena` is `position: absolute; inset: 0` inside the fixed stage, so its size comes from
the screen and never from what is inside it.
**Worth telling students:** if you measure a box to decide the size of the thing inside it, make sure
the box is not being sized by that thing. The bug does not look like a loop; it looks like a number
that is confidently wrong.

## 2026-08-17 — my own edits were invisible because the game had cached itself
**Lesson:** A10 (deploying) / PWA
**What it produced:** the fix above, applied, saved, reloaded — and the page behaved exactly as it had
before. Twice. `Network.setCacheDisabled` was on, so the browser's HTTP cache was not the culprit.
**Why it was wrong:** the game now installs a service worker, and the worker serves the app shell
**cache first**. `Network.setCacheDisabled` does not touch the Cache Storage the worker reads from, so
every reload was served the stylesheet as it had been at install time. Unregistering the worker once
at the start of the session is not enough either — the page registers a fresh one on every load, and it
precaches whatever is on disk at that moment.
**How I caught it:** the second failed reload. The evidence said the CSS had not changed, and the CSS
on disk plainly had.
**The fix:** before every check of an edit, unregister every worker *and* delete every cache, then
reload — `navigator.serviceWorker.getRegistrations()` + `caches.keys()`, in that order.
**Worth telling students:** a service worker makes your own site lie to you. Disabling the browser
cache is not enough; you have to throw away the copy the worker is keeping, and you have to do it
again after every reload, because the page puts the worker back.

## 2026-08-17 — the challenge prompt was half off the bottom of the screen
**Lesson:** A19 (the challenge affordance) / layout
**What it produced:** the owner, playing the in-progress build: *"when alone in the world, the
'Challenge Flint' prompt is half cut off at the bottom of the screen. I think it is because the chat UI
is not visible."*
**Why it was wrong:** the prompt floated at `bottom: 4.2rem` — a number picked by hand to clear the row
of phrase buttons — and it was measured from `#arena`, which is the whole window rather than the
canvas. Both halves of that are guesses. The offset is only right while the phrase row is exactly that
tall and actually on screen, and the window is only the same box as the canvas while the world is
bigger than the window; on a screen larger than the map the canvas stops growing and is centred, and
anything measured from the window's bottom edge then sits below the world.
**How I caught it:** the owner caught it. Measuring afterwards at six sizes with the phrase row shown
and hidden is what showed *why*.
**The fix:** the canvas got its own wrapper, `#screen`, which is exactly its size, and every overlay is
positioned against that. The prompt and the phrase row became one bottom-anchored stack, so the prompt
sits above the phrases because it comes before them — no offset at all. Hide the phrases and the prompt
simply takes the bottom of the canvas. Checked at 390x780, 390x600, 1440x813, 1440x420 and 1700x1300
(letterboxed), with the phrase row shown and hidden: always inside the canvas, always on screen, and
the canvas rect and document height never move.
**Worth telling students:** a hand-tuned offset is a guess that happens to be right at the sizes you
tried. When you catch yourself picking a number to clear something else, ask whether the two things can
just be stacked instead — a stack cannot be off by a number nobody will remember to change.

## 2026-08-17 — a hint that leaves on a timer teaches the wrong half
**Lesson:** A19 / teaching a player how to play
**What it produced:** the first version of the help line said one thing and hid it after two and a half
seconds of walking. The owner, on a phone-sized window: it still named keys, and the whole line
vanished — including the half about challenging, which they had never done.
**Why it was wrong:** two mistakes with one shape. The device test was made once at boot from a media
query and never revisited, so a hybrid — or a desktop window narrowed to phone size — was labelled
wrong and stayed wrong. And "how to walk" and "how to pick a fight" were treated as one fact learned at
one moment, when they are plainly two, learned minutes apart.
**How I caught it:** the owner caught it, playing the build.
**The fix:** the device is a first guess from `(pointer: coarse)` + `(hover: none)`, corrected by the
first real `keydown` or touch `pointerdown` — corrected by what the person *does*, which is the only
evidence that cannot be wrong. The hints are two lines, retired one at a time: three tiles of actual
distance covered retires the movement line, starting a challenge retires the other. Both are
remembered in `kakkoi-online-learned`, beside the safety flag, so a new character does not re-teach the
same person.
**Worth telling students:** a timer is a guess about somebody else's understanding. If you can watch
for the thing itself — they moved, they pressed it — watch for that instead, and dismiss exactly the
one thing they have proved they know.

## 2026-08-17 — two panels that ran out of room and clipped the part you needed
**Lesson:** A19 / layout on real windows
**What it produced:** a sweep across sixteen window shapes found two. In a **short window (1440x300)**
the ⚙ menu was drawn 320px tall inside a 300px screen with `overflow: hidden`, so "Learn to build this"
was off the bottom **with no way to scroll to it** — and since that menu is now the only route to every
control that is not the game, the control had effectively ceased to exist. In the **duel**, at 1440x300
all three move buttons were below the fold, and on a **landscape phone (740x360)** "Give up" was. The
duel overlay does scroll, so nothing was permanently unreachable — but a player will not scroll for
buttons they cannot see, and 740x360 is what you get by turning a phone sideways to play a game.
**Why it was wrong:** both panels were laid out as though the window were tall enough. Neither had a
height bounded by the viewport, and neither said which of its parts matter — so when space ran short,
what got cut was whatever happened to be last in the markup, which in both cases was the part you
actually need.
**How I caught it:** I did not — a sweep across window shapes did, run by somebody else. My own
checks had covered ten shapes and every one of them was tall enough to hide it.
**The fix:** the menu is bounded by the box it hangs in and scrolls inside it. The duel card is bounded
by the window and states its priorities: the three moves and the button that leaves never shrink and
are never below the fold; everything above them compresses first, drops what the score row already says
on very short screens, and only then scrolls — with the buttons still sitting underneath, on screen.
**Worth telling students:** a panel needs to know what to sacrifice before it runs out of room, or it
will sacrifice the last thing in the file. And test the shape you did not think of: a phone turned
sideways is 360 pixels tall, which is shorter than almost anything you will try by accident.
