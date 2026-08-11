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
