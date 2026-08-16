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
