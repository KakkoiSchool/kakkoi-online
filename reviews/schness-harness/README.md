# Harness for the Schness counter-review

Scripts used to produce the numbers in `../schness-adversarial-review.md`. They are plain Node
(`>=20`) ES modules and expect to sit in the root of a `kakkoidev/schness` checkout at `d47c46c`
with the shipped engine copied beside them and the pre-speedup engine under `old/`:

```sh
cd schness
mkdir old
git show 7924e41^:src/rules.js > old/rules.js
git show 7924e41^:src/bot.js   > old/bot.js
cp src/rules.js src/bot.js .
```

| script | what it measures |
|---|---|
| `perft_compare.mjs` | perft 1–5 for the old and new engine, with timings |
| `indep_perft.mjs` | perft 1–5 from a generator written from the rules dialog only |
| `diff_engines.mjs` | 400 seeded random games; legal sets, check, results, applied positions and depth-2 bot choices compared old vs new |
| `frozen_check.mjs` | the frozen-shared-occupant engine (`rules_frozen.mjs`, built by the review) against the shipped one |
| `cache_depth4.mjs` | the shipped depth-4 search against the same search with its transposition cache disabled (`bot_nocache.mjs`: `bot.js` with the `Map` replaced by a no-op) |
| `rep_growth.mjs` | depth-4 search time with an empty repetition map vs a 150-entry one |
| `selfplay.mjs D1 D2 CAP` | self-play from all 16 king placements at the given depths |
| `browser_checks.mjs` | Playwright + Chromium: tap-target heights at three viewports, a bot game under the meta CSP, a 3+2 clock run to zero with a faked timer |

`browser_checks.mjs` needs `python3 -m http.server 8899` serving the checkout and a Playwright
install; it points at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, which is the sandbox
path — change `executablePath` or drop it for a normal install.
