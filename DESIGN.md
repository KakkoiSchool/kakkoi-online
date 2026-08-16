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

## The game, as it actually stands (stage 2)

`index.html` at the repo root **is** the game: a 640x480 canvas with the DOM interface on top of it.
You are asked for a name, you pick one of six monsters, you read one short card about other people,
and then you are in the dungeon — walking, and sharing it with whoever else has it open.

```
index.html          canvas + DOM shell, imports src/main.js
src/
  main.js           boot and wiring only — loads, hands the modules to each other, runs the loop
  loop.js           requestAnimationFrame, dt in seconds, clamped at 0.25
  input.js          held keys + Pointer Events -> a direction
  sprites.js        loadAtlas() / drawTile(ctx, atlas, index, x, y, scale)
  world.js          the map, which tile numbers are solid, and per-axis collision
  render.js         camera (clamped to the map), tiles, monsters, nameplates, speech bubbles
  save.js           localStorage, versioned, refuses anything it does not recognise
  identity.js       a lasting random id, your name, your monster
  net.js            the ONLY module that knows trystero exists: room, presence, positions
  chat.js           six preset phrases; sends the index, checks every arrival
  ui/onboarding.js  the name panel, the monster picker and the card about other people
  ui/chatbar.js     one finger-sized button per phrase. no text box, anywhere
  duel.js npc.js audio.js ui/duel-screen.js
                    empty on purpose — stage 3 fills these in, nothing moves
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
Stage 2 added one field, `safety`, for "this player has read the card". A field that is allowed to be
missing does not need a new version number: absent means `false`, which is exactly right.

## Other people (stage 2)

**Finding each other.** `src/net.js` is the only file that has ever heard of trystero. It joins one
stable room — appId `kakkoi-online`, room `town` — through the same four nostr relays the A12 demo
uses, because relays die and that list is the one currently known to work. There is no server: the
relays are only a noticeboard where two browsers leave a note, and once they have found each other
they talk directly.

**Positions.** Ten times a second (`posHz` in `data/tuning.json`), never per frame. Each packet is
`{x, y, m}` — whole pixels and the sender's monster id, so a peer whose greeting we missed is still
drawn as the creature they chose. A `hello` carries the name.

**Smooth, not teleporting.** Ten updates a second drawn at sixty would jump about fifteen pixels at a
time. Every peer keeps a short history of the positions it has sent, and is drawn where it was
`interpDelayMs` (150ms) ago, sliding between the two samples either side of that instant. Being an
eyeblink behind is invisible; teleporting is not. The bob is driven by whether that interpolated
position is still changing, so a remote monster walks the same way yours does.

**Doubting everything.** Every field that arrives is checked before it becomes game state, and what
does not fit is counted in `net.dropped` and thrown away: a position that is not a finite number or is
off the map, a monster id that is not a whole number pointing at a real monster, a phrase index outside
the list. Nothing from the wire is ever drawn as text.

**Chat.** Six preset phrases and no text input anywhere in this game — not hidden, not as an option.
The readers are children, there is no server, so there is nobody to moderate a message and nobody to
report a person to; a fixed list is the only kind of talking this game can offer honestly. What goes
over the wire is the phrase's *number*. The words are looked up from our own list, so there is no path
from the network to a string on the screen. Bubbles sit above the nameplate for four seconds.

**The safety card.** Shown once, on the first run, between the monster picker and the world — not the
first time somebody else turns up, because that is the moment a player is least likely to read
anything. Three plain facts: other players see your name, your monster and where you stand and nothing
else; nobody is in charge here; if somebody is unkind, leave and tell an adult you trust. Remembered
in the save.

**The online count.** Always in the HUD, because a world with nobody in it and a world that is broken
look identical. Alone, it says "Just you here for now".

## Status at last commit

- **Live:** https://online.kakkoi.dev (stage 1 — stage 2 is committed but not yet pushed)
- **Deploy:** the repo is published verbatim as static files; no check job, no build
- **Lessons written:** A09, A10 (in the `izumo-io` repo, live in EN/JA/PT)
- **Not built yet:** stage 3 (the duel: challenge FSM, commit–reveal over the wire, the NPC).
  `duel.js`, `npc.js` and `ui/duel-screen.js` exist and are empty.
- **Also not done:** audio is present in `audio/` but nothing plays it yet.
