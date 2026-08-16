# vendor/ — pinned third-party files

Nothing here is fetched at runtime. Every dependency is a **committed, pinned copy**, so a CDN
outage or a deleted package cannot break the live game or any student's fork.

Populate with `make vendor` (to be added) or by hand:

| File | Source | Licence |
|---|---|---|
| `basecoat.min.css` ✅ **vendored 2026-08-11, basecoat-css@1.0.2** (213 kB) | `https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/basecoat.cdn.min.css` | MIT |
| `trystero/` ✅ **vendored 2026-08-16, trystero@0.21.5** (nostr strategy, 6 files, 37 kB) | see table below | MIT |
| `tiny-dungeon.png` | https://kenney.nl/assets/tiny-dungeon | CC0 |
| `tiny-creatures.png` | https://opengameart.org/content/tiny-creatures | CC0 |

Record the exact version next to each file when you add it. See
`izumo-io/planning/kakkoi-online-sources.md` for the full provenance list.

## `trystero/` — trystero 0.21.5, nostr strategy

There is no bundler in this project, so trystero is vendored as a **closed set of ES modules with
relative imports**. Each file was fetched from esm.sh (which pre-compiles the package to browser
ES2022) on **2026-08-16**, unmodified except for the import specifiers.

| Saved as | Fetched from |
|---|---|
| `trystero/nostr.js` | `https://esm.sh/trystero@0.21.5/es2022/nostr.bundle.mjs` |
| `trystero/src/strategy.js` | `https://esm.sh/trystero@0.21.5/es2022/src/strategy.mjs` |
| `trystero/src/utils.js` | `https://esm.sh/trystero@0.21.5/es2022/src/utils.mjs` |
| `trystero/src/crypto.js` | `https://esm.sh/trystero@0.21.5/es2022/src/crypto.mjs` |
| `trystero/node-crypto.js` | `https://esm.sh/node/crypto.mjs` |
| `trystero/node-chunk.js` | `https://esm.sh/node/chunk-ETRHX7GZ.mjs` |

`node-chunk.js` was not anticipated: `node/crypto.mjs` opens with a bare `import
"./chunk-ETRHX7GZ.mjs"`. Without it the set is not closed and the page 404s.

**The only edits made** were to import specifiers, so that they resolve as plain relative paths in a
browser with no import map:

- `"/node/crypto.mjs"` → `"./node-crypto.js"`
- `"./chunk-ETRHX7GZ.mjs"` → `"./node-chunk.js"`
- `"./src/strategy.mjs"` / `"./src/utils.mjs"` → `.js` (in `nostr.js`)
- `"./utils.mjs"` / `"./crypto.mjs"` → `.js` (inside `src/`)

Re-fetching (all six URLs, then the same rewrite) is the whole update procedure:

```
perl -pi -e 's{"/node/crypto\.mjs"}{"./node-crypto.js"}g;
             s{"\./chunk-[A-Z0-9]+\.mjs"}{"./node-chunk.js"}g;
             s{"(\./(?:src/)?(?:strategy|utils|crypto))\.mjs"}{"$1.js"}g' \
  nostr.js node-crypto.js node-chunk.js src/*.js
```

Verified 2026-08-16 by loading `import {joinRoom, selfId} from './nostr.js'` over
`python3 -m http.server`: six module requests, all `200`, no console errors, and two browser tabs
exchanged positions over a real peer connection.
