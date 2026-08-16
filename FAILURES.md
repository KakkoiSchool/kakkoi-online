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
