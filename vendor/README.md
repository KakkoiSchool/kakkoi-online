# vendor/ — pinned third-party files

Nothing here is fetched at runtime. Every dependency is a **committed, pinned copy**, so a CDN
outage or a deleted package cannot break the live game or any student's fork.

Populate with `make vendor` (to be added) or by hand:

| File | Source | Licence |
|---|---|---|
| `basecoat.min.css` ✅ **vendored 2026-08-11, basecoat-css@1.0.2** (213 kB) | `https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/basecoat.cdn.min.css` | MIT |
| `trystero/` ✅ **vendored 2026-08-16, trystero@0.21.5** (nostr strategy, 6 files, 37 kB) | see table below | MIT |
| `kenney/` ✅ **vendored 2026-08-16** — three sprite atlases + their licence files (22 kB) | see "Sprite atlases" below | CC0 |
| `opengameart/` ✅ **vendored 2026-08-16** — one sprite atlas + its licence file (12 kB) | see "Sprite atlases" below | CC0 |

Record the exact version next to each file when you add it. See
`izumo-io/planning/kakkoi-online-sources.md` for the full provenance list.

## Sprite atlases — measured, not claimed

Each file below is one image holding a **grid of equal-sized cells with no gap between them**, which
is the whole point of A14: you cut rectangles out of one picture. The dimensions and grids here were
measured by loading each file in a real browser on **2026-08-16** and walking the cell size across
the image — not read off a readme.

| File | Real size | Cell | Grid | Cells | Licence |
|---|---|---|---|---|---|
| `kenney/tiny-dungeon.png` | 192 × 176 | 16 × 16 | 12 cols × 11 rows | 132 | CC0 |
| `kenney/tiny-town.png` | 192 × 176 | 16 × 16 | 12 cols × 11 rows | 132 | CC0 |
| `kenney/pixel-platformer-characters.png` | 216 × 72 | 24 × 24 | 9 cols × 3 rows | 27 | CC0 |
| `opengameart/tiny-creatures.png` | 160 × 288 | 16 × 16 | 10 cols × 18 rows | 180 | CC0 |

Cell index `n` sits at `x = (n % cols) * cell`, `y = floor(n / cols) * cell`.

Every one of these is the pack's **`tilemap_packed.png`** (or `tilemap-characters_packed.png`).
Kenney's packs also contain a plain `tilemap.png` with a **1 px gap** between tiles — do not use
those; the gap makes the arithmetic above wrong.

### Where each came from

| File | Downloaded from | Path inside the zip |
|---|---|---|
| `kenney/tiny-dungeon.png` | `https://kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip` | `Tilemap/tilemap_packed.png` |
| `kenney/tiny-town.png` | `https://kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip` | `Tilemap/tilemap_packed.png` |
| `kenney/pixel-platformer-characters.png` | `https://kenney.nl/media/pages/assets/pixel-platformer/33bb4921eb-1696667883/kenney_pixel-platformer.zip` | `Tilemap/tilemap-characters_packed.png` |
| `opengameart/tiny-creatures.png` | `https://opengameart.org/sites/default/files/tiny-creatures.zip` | `tiny-creatures/Tilemap/tilemap_packed.png` |

Those Kenney zip URLs contain a content hash and **change when Kenney re-uploads a pack**. They are
not guessable: read them off the asset page (`https://kenney.nl/assets/<name>`), where the link sits
behind "Continue without donating". `curl -sL https://kenney.nl/assets/tiny-dungeon | grep -o
"href='[^']*\.zip'"` prints the current one.

Each pack's own `License.txt` is kept next to the image as `*-LICENSE.txt`. All four say
*"License: (Creative Commons Zero, CC0)"* and point at
`http://creativecommons.org/publicdomain/zero/1.0/`. The Kenney asset pages state the same licence
in their **License** row; the OpenGameArt page states `License(s): CC0`.

### What is actually in them

- **`tiny-dungeon.png`** — floors, walls, doors, furniture, weapons, and 20 single-pose characters.
  For A16: cell **48** is a plain sandy floor and cell **40** is a solid stone wall.
  There is **no walk cycle in this file.** Its characters (cells 84–88, 96–100, 108–112, 120–124)
  are one frame each.
- **`tiny-town.png`** — the outdoor half of the same 16 px set: grass, paths, houses, fences.
- **`pixel-platformer-characters.png`** — this is where the **walk cycle** lives. The characters are
  laid out as **adjacent pairs**: cells 0/1, 2/3, 4/5 and 6/7 on the top row are four characters,
  each with a legs-together frame and a legs-apart frame. Swap between the two cells and the
  character walks. Different art style from the 16 px dungeon set, which is a known compromise.
- **`tiny-creatures.png`** — 180 monsters and animals, one pose each, drawn by Clint Bellanger as a
  deliberate expansion of Kenney's Tiny Dungeon and Tiny Town, *"made with Kenney's permission"*
  (his `License.txt`). It matches those two by construction. **It is not a Kenney pack**, and Kenney
  publishes no pack of that name.

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
