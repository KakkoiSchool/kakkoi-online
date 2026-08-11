# vendor/ — pinned third-party files

Nothing here is fetched at runtime. Every dependency is a **committed, pinned copy**, so a CDN
outage or a deleted package cannot break the live game or any student's fork.

Populate with `make vendor` (to be added) or by hand:

| File | Source | Licence |
|---|---|---|
| `basecoat.min.css` ✅ **vendored 2026-08-11, basecoat-css@1.0.2** (213 kB) | `https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/basecoat.cdn.min.css` | MIT |
| `trystero.js` | bundle `trystero@0.25.3` (nostr strategy) — `bun build --target=browser` | MIT |
| `tiny-dungeon.png` | https://kenney.nl/assets/tiny-dungeon | CC0 |
| `tiny-creatures.png` | https://opengameart.org/content/tiny-creatures | CC0 |

Record the exact version next to each file when you add it. See
`izumo-io/planning/kakkoi-online-sources.md` for the full provenance list.
