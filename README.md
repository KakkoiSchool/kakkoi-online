# Kakkoi Online

A tiny top-down multiplayer game that runs with **no server at all**. Your browser talks straight to
the other players' browsers. Hosting is a static page, so it costs nothing to run, forever.

**Play:** https://online.kakkoi.dev
**Learn to build it:** lessons A09–A29 at https://school.kakkoi.dev

You pick a name and one of six monsters, and you are in a dungeon. You walk around it, you see anyone
else who has the page open walking around it too, and you talk to them in six set phrases. Walk up to
one of them and a **Challenge** button appears: a duel is **rock, paper, scissors**, first to three
rounds. Rock beats scissors, scissors beats paper, paper beats rock. Each player picks; when both have
picked, the two moves are shown side by side and the round is scored. You can watch somebody else's
fight from across the plaza, too: what each fighter has chosen, and who won, appears over their head.

Nobody else online? **Flint** is always standing in the plaza, and he fights exactly the way a person
does — he even remembers what you like playing and leans against it.

**Aniki** — Flint's big brother — stands in the plaza for the first ten minutes of every hour. He has
ten lives, you have three, and everybody who walks up to him fights him at the same time in the same
rounds. Nobody announces him: every browser works out that he is due from the clock it already has.
His wounds last the hour and yours last the fight, so being knocked out means walking back up to him,
not waiting for next time. Beat him and you get a mark no chest can give.

**There is a way out of town.** An archway in the north wall of the north-west room leads down into
**The Old Mine** — the same sand the town stands on, with the rock left around it. It is open to
everybody: a game that usually has one person in it should not put its only new place behind its
hardest fight. Flint and Aniki both stay in the plaza, so the mine is somewhere to go *with* somebody
rather than somewhere to fight. Where you are is in the HUD, other players in the mine cannot see you
in the town and vice versa, and the game remembers which one you were in when you come back.

**Chests** open at 10, 25, 50 and 100 duels won: a colour, a pair of shades, another colour, a crown.
They are looks and nothing else — the animal you picked already changes nothing in a fight, and a
reward that changed one would undo the only promise the duel makes. Everyone else sees what you are
wearing; the ⚙ menu's **Looks** is where you change it.

## Run it

**Plain JavaScript, no build step.** There is nothing to install and nothing to compile — the files
in this repo are exactly the files the browser runs.

1. Open this folder in your editor.
2. Install the **Live Server** extension.
3. Right-click `index.html` → *Open with Live Server*.

That's the whole toolchain. From a terminal, `make dev` (`python3 -m http.server 8000`) does the
same thing without the auto-reload.

**Controls.** Arrow keys or WASD to walk, or touch the floor — the whole game works on a phone, and
the line on screen says whichever of those applies to the thing you are holding, never the other. `F`
challenges whoever you are standing next to. Each half of that line disappears for good once you have
done it — walked a few tiles, or started a fight — and stays gone on your next visit. Sound is **off**
until you turn it on behind the **⚙** in the corner.

`file://` will not work, on purpose — browsers refuse ES modules without a real origin (lesson A10).
`http://localhost` is fine, and so is the live https site.

**To be two players on one machine**, open the page on **two different origins** — say
`localhost:8000` and `127.0.0.1:8001`. Two tabs on the *same* origin share one `localStorage`, so
they are the same character; the newest of them takes the game over and the older one pauses with a
card explaining why. See "One window at a time" in `DESIGN.md`.

**Everything that is not the game is behind the ⚙** in the corner: sound, music, **How to play**,
**About other players** (the safety card again, whenever you want it), **Install** when your browser
offers it, **Start over** — a new name and a new animal, which asks first — and the link to the
lessons.

**Make a map.** `editor/` is a map maker: paint with the tile sheet, put the start square somewhere,
press **Check** — it walks the map from the start and lights up everywhere your feet can reach — and
then **Propose it on GitHub**, which opens GitHub's own new-file page with your map already in it. No
account details ever reach this page, because a page that is served to everybody cannot keep a
secret; you sign in as yourself and it becomes a pull request. It is also the piece meant to be used
*with* an AI: copy the map's text, ask Claude to put a pillar in the middle, paste it back, look at
what happened. The map maker works with no network too — everything but the one GitHub button, which
says so and tells you what to do instead. It paints **places**: floors, walls, doors and furniture.
The tile sheet it comes from is a dungeon set with monsters, weapons and potions in it, and
`src/tiles.js` is the list of what this tool will and will not draw — the map checker refuses the
rest as well, so pasting one in does not get round it.

**Install it on your phone.** The live site is a proper PWA: open it and use your browser's "Add to
Home Screen". It then opens like an app, with no browser bar, **and it works with no network** — the
world, your saved character and Flint are all cached. Other players are the one thing offline cannot
give you, because finding them needs a real connection.

**Tests** are web pages: open `tests/rules.test.html`, `tests/net.test.html`,
`tests/spectate.test.html`, `tests/wins.test.html`, `tests/map.test.html` and
`tests/boss.test.html` through the same server and read the PASS/FAIL rows. No test runner, no npm.

## How it fits together

```
index.html          canvas + the UI shell
manifest.webmanifest  makes it installable on a phone's home screen
sw.js               caches the app shell so the game opens offline. BUMP ITS CACHE VERSION
icons/              the tab icon and the home-screen icons, one drawing on a 16x16 grid
src/main.js         boot and wiring only — everything else is one idea per file
src/loop.js         the requestAnimationFrame loop
src/net.js          the only file that knows trystero exists
src/duel.js         the challenge state machine and the rounds
src/npc.js          Flint — answers the same questions a peer does, so duel.js cannot tell
src/boss.js         Aniki: a shared clock, a seeded dice, and what browsers can agree on
src/spectate.js     what the room is told about a duel, so bystanders can watch it
src/wins.js         duels won, chests earned, and what is being worn
src/looks.js        a look painted onto a sprite: a hue turned, or pixels on top
src/battle/rules.js PURE rules: the rock-paper-scissors triangle — imports nothing, fully testable
src/ui/game.css     the whole look: one stylesheet, no component library under it
src/ui/scale.js     how big the interface is, and how far the art is zoomed, on this device
src/ui/glyphs.js    the pixel glyphs — the three moves, three faces, and the ⚙
src/ui/bubbles.js   name plates and head bubbles, as DOM over the canvas
src/map-check.js    is this map a place? — shared by the map maker and its tests
src/tiles.js        which pictures a map may be made of, and which are left out
src/places.js       every map there is, and whether the doors between them join up
src/build.js        which cached copy of the game this device is actually running
editor/             the map maker: paint a map, check it, propose it as a pull request
tests/*.test.html   tests you open in a browser
demos/NN-name/      one standalone demo per lesson: open its index.html and look at it
data/*.json         every balance number, the monsters, the looks
data/maps/          every place there is, and maps.json, which names them
vendor/             pinned third-party files, fonts included (see vendor/README.md)
audio/              CC0 sound (see audio/README.md)
```

Three rules that shape the codebase:

- **No build step, ever.** What is in git is what runs in the browser. If you cannot open a file
  and read what actually executes, it does not belong here.
- **`src/battle/rules.js` imports nothing.** Both players in a duel must compute identical results
  from it, and it must be testable without a network.
- **Numbers live in `data/`, not in code.** Balancing is an edit, never a rewrite.
- **Change a shipped file, bump `CACHE` in `sw.js`.** A service worker that keeps serving the old
  cache is how a PWA becomes unfixable: the fix deploys and nobody ever receives it.

## No server means

- **Nobody is in charge.** Positions, moves and everything else are self-reported, so cheating them is
  easy and we don't mind. In a duel each move is sent as soon as it is chosen: the game never shows you
  a move that arrived before you picked, but a player who edited the code could read one off the wire.
  For five friends playing rock, paper, scissors that is a fair trade for a duel a child can follow —
  see "The move is sent straight" in `DESIGN.md`.
- **No moderation is possible** — no bans, no logs, no reports. So chat is **preset phrases only**.
  Abuse is designed out rather than policed.
- **Nothing is stored anywhere.** Your character lives in your own browser, in `localStorage`. Clear
  your browser data and it is gone; there is nowhere else it could have been kept.
- **Some networks can't connect at all** (roughly 8–15%, strict NAT). That's not your bug.

## Fork it

Fork, deploy to `your-name.github.io/kakkoi-online/`, and **you can still play with everyone else** —
peers find each other through a public relay, not through this domain. Your copy, same world.

## What is next

`PLAN.md` is the design for **stage 4** — chests of cosmetic rewards, Aniki the hourly boss, and a
level editor whose Submit button opens a pull request. Written before the code, with the arguments
and the open questions in it.

## Plan and docs

Design rationale, technical spec, lesson track and asset provenance live in the school repo:
`izumo-io/planning/` — `kakkoi-online-design.md`, `kakkoi-online-trd.md`, `kakkoi-online-lessons.md`,
`kakkoi-online-sources.md`. See also `DESIGN.md` here.

## Licence

Code MIT. Art and audio are CC0 (see `CREDITS.md`).
