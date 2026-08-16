# Design pointers

The full plan lives in the school repo, `izumo-io/planning/`:

| Doc | Contents |
|---|---|
| **`HANDOFF.md`** | **Start here if you are picking this up cold** — repo locations, state, environment gotchas, settled decisions |
| `kakkoi-online-design.md` | Why every decision is what it is. 42-row decision log, six recorded reversals |
| `kakkoi-online-trd.md` | What to build: data model, network protocol, battle rules, milestones, tests |
| `kakkoi-online-lessons.md` | The 20 lessons (A09–A28), writing standard, safety lesson, build process |
| `kakkoi-online-sources.md` | Every asset pack, library and reference, with licences |

## The build order (don't skip step 3)

```
1. Docs current for milestone M
2. Build the MVP slice
3. PLAY IT — two tabs, then with a person     ← this is what generates truth
4. Fix what is actually wrong
5. Update the docs to match reality
6. NOW write the lesson, from real failures (FAILURES.md)
7. Screenshot + tag aNN-end. Repeat.
```

The lesson is written **last**. A lesson written before the code contains invented verification steps
and invented AI mistakes, and students notice immediately.

## Milestones

| M | Ships | Lessons |
|---|---|---|
| M0 | canvas, loop, map, collision, movement, monster pick, save | A12–A16 |
| M1 | peers, presence, position sync, nameplates | A17–A20 |
| M2 | preset chat, mute, validation, safety card | A18, A21 |
| M3 | duel: FSM, commit–reveal, three actions, local AI | A22–A24 |
| M3.5 | NPCs: townsfolk, tutor, trainer ladder | A25–A26 |
| M4 | audio, polish, "you're the only one here", NAT diagnostic | A27–A28 |

A10 deploys to the live URL **before M0**, so every milestone lands in public.

## The toolchain (settled)

**A code editor and the Live Server extension. That is all of it.**

Plain JavaScript, plain HTML, no TypeScript, no npm, no Bun, no bundler, no build step. Every file in
this repo is a file the browser loads directly, and the deploy workflow publishes the repo as-is.

The reason is the lesson track, not taste. A student in week one has to be able to open a folder,
right-click `index.html`, and see the thing run. Every tool between "the file I edited" and "the
thing that runs" is a tool that can break in a way the student cannot yet debug — and it hides the
one fact the whole course rests on: **the browser runs the file you wrote**.

Consequences, all deliberate:

- Tests are web pages (`tests/*.test.html`) that print PASS/FAIL rows. No runner.
- Third-party code is *vendored* into `vendor/` as a plain file, never installed.
- CI does not check types or run tests before deploying — there is no compiler to run. Verification
  is opening the page and reading the console.

## Demos

Each lesson ships one standalone demo in `demos/NN-name/`, showing one feature, cut into 2–4 named
blocks. A demo runs by opening its `index.html` on a static server. It stays around one screen of
code, comments included, because a student has to be able to hold all of it at once.

- `demos/09-hello/` — editor + Live Server + a `<script>` all working: write a name into the page.
- `demos/10-player/` — a square you can move. **Notice / Decide / Draw**: held keys plus Pointer
  Events, movement multiplied by elapsed time, clear-and-fill on a canvas.

## The game, as it actually stands (stage 1)

`index.html` at the repo root **is** the game: a 640x480 canvas with the DOM interface on top of it.
You are asked for a name, you pick one of six monsters, and then you are in the dungeon, walking.

```
index.html          canvas + DOM shell, imports src/main.js
src/
  main.js           boot and wiring only — loads, hands the modules to each other, runs the loop
  loop.js           requestAnimationFrame, dt in seconds, clamped at 0.25
  input.js          held keys + Pointer Events -> a direction
  sprites.js        loadAtlas() / drawTile(ctx, atlas, index, x, y, scale)
  world.js          the map, which tile numbers are solid, and per-axis collision
  render.js         camera (clamped to the map), tiles, monsters, nameplates
  save.js           localStorage, versioned, refuses anything it does not recognise
  identity.js       a lasting random id, your name, your monster
  ui/onboarding.js  the name panel and the monster picker, in DOM
  net.js chat.js duel.js npc.js audio.js ui/chatbar.js ui/duel-screen.js
                    empty on purpose — stages 2 and 3 fill these in, nothing moves
  battle/rules.js   PURE. imports nothing. the element triangle lives here
```

**Scale.** 16px art at 2x, so a tile is 32 screen pixels and the canvas shows 20x15 of them.
`ctx.imageSmoothingEnabled = false` plus `image-rendering: pixelated`, and the camera is rounded to
whole pixels — without that the tile grid shimmers as you walk.

**The map.** `data/maps/town.json`, hand-laid: 48x36 tiles = 1536x1152 pixels, which is 2.4 screens
wide and 2.4 screens tall. Seven rooms — a tiled central plaza, two north halls, the west cells, a
south camp, a vault, a closet — joined by two-tile corridors that form loops rather than a tree, so
there is more than one way to get anywhere. Two layers of tile numbers (`ground`, `decor`) and one
list of the numbers you cannot walk through; collision is "is the square I am moving into in that
list", checked one axis at a time so sliding along a wall works.

**The monsters.** Six cells picked out of `vendor/opengameart/tiny-creatures.png` and named for what
they look like: Scorchwing and Emberhorn (fire), Brinescale and Frostguard (water), Mossgolem and
Sporecap (earth). Your monster is your element.

**A deliberate difference from A14.** Tiny Creatures has no walk frames — it is a 16px top-down set
that matches the dungeon tiles exactly, which matters more here than legs. So a walking monster
**bobs one art pixel up and down about seven times a second** instead of cycling frames. Motion
without inventing art.

**The save.** One key, `kakkoi-online`, stamped `version: 1`, written twice a second and once more on
the way out. Anything unreadable, any other version number, any missing field, any monster this build
does not have, any position inside a wall — all of them warn once and start fresh instead of crashing.

## Status at last commit

- **Live:** https://online.kakkoi.dev (stage 1: name, monster, and a dungeon to walk around)
- **Deploy:** the repo is published verbatim as static files; no check job, no build
- **Lessons written:** A09, A10 (in the `izumo-io` repo, live in EN/JA/PT)
- **Not built yet:** stage 2 (other people: presence, positions, preset chat) and stage 3 (the duel:
  challenge FSM, commit–reveal, the NPC). The module files exist and are empty.
- **Also not done:** audio is present in `audio/` but nothing plays it yet.
