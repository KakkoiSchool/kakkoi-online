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

## The game, as it actually stands

`index.html` at the repo root **is** the game: a 640x480 canvas with the DOM interface on top of it.
You are asked for a name, you pick one of six monsters, you read one short card about other people,
and then you are in the dungeon — walking, sharing it with whoever else has it open, and duelling them
(or Flint, who is always in the plaza) with fire, water and earth.

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
  duel.js           the challenge state machine, the round loop, commit–reveal
  npc.js            Flint: answers exactly the questions a peer answers
  audio.js          six effects and a music loop, OFF until you say otherwise
  ui/duel-screen.js the challenge, three thumb-sized moves, and what happened
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

## The fight (stage 3)

**The moves are the three elements, and nothing else.** fire, water, earth; water beats fire, fire
beats earth, earth beats water — the same triangle the rest of the game already runs on. A duel is
**first to three round wins**, and a draw replays the round. There are no hit points, no charges and no
damage numbers.

That is a deliberate reversal. `planning/kakkoi-online-trd.md` §3 describes a Strike / Block / Charge
duel with charges, HP and a damage formula, and it is **superseded** (decision-log row 52). No lesson
teaches it, and the live game has to be the game the course builds — otherwise every student who
finishes A22 opens the real thing and finds a different game. `battle/rules.js` still exports
`actionWinner` and `elementMultiplier`, unused, because the tests are written against them and the
shape may come back.

**Your monster is a costume in a duel.** It decides what you look like and which element you *are*,
and it gives you no bonus at all in a fight. There is no lesson that teaches an element bonus, and
inventing mechanics that nothing teaches is the exact mistake the paragraph above corrects.

**Starting one is physical.** Walk up to somebody and a Challenge button appears over the canvas, with
a small arrow over their head; `F` does the same. There is no list of players with a button beside each
name — finding your opponent is part of fighting them.

**One state at a time.** `walking → waiting → asked → fighting`, straight out of A19. Every awkward
case is one line in `src/duel.js` and every one of them ends back at `walking`: they refuse; they are
already in a duel, so yours is politely declined; you both press Challenge in the same instant, and
each side sees the other's ask while already waiting, so you simply start; they close the tab; they
stop answering. Nothing waits forever — `commitTimeoutMs` (10s) is armed whenever we are waiting on the
other side, and the one-sided endings tell the other player, because otherwise they sit looking at
three buttons for somebody who has gone.

**Nobody can peek.** Both sides send a SHA-256 fingerprint of `round:move:secret` first, and neither
sends the move itself until the other fingerprint has arrived. When a move turns up it is fingerprinted
again and checked against what that player folded; a mismatch ends the duel as **caught cheating**
rather than being quietly counted. The round number is in the fingerprint so a commit cannot be
replayed in a later round, and the random secret is in it because with only three moves anyone could
fingerprint all three and see which matched. Both folded fingerprints are shown on the duel screen
while both moves are still hidden, because that is the whole idea and it is worth being able to watch.
`crypto.subtle` needs a secure context: `localhost` and the live https site both qualify, `file://`
does not, and the failure says so in words.

**Flint.** A seventh character stands in the plaza and is challenged exactly the way a person is. He
matters because this game will usually have one person in it. The point is the *shape*: he answers the
same questions a peer answers, over the same little `link` object — ask, reply, commit, reveal — so
`src/duel.js` has no branch for him anywhere and the fight you practise is the fight you play. He does
not roll a dice, either: he remembers your last five moves and leans against your favourite, rolling a
dice about a third of the time so he never becomes predictable himself.

**The link.** `net.linkTo(id)` and `npc.link()` return the same five things — `id`, `name`, `send`,
`onMessage`, `onClose` — and that is the entire interface between the duel and the outside world. All
five duel messages ride one trystero action, because a duel is one conversation and one action keeps
it in order. `net.js` is still the only file that has heard of trystero.

## Sound (stage 3)

Six short effects and one music loop, plain `Audio` elements, no Web Audio graph and no library.
**Off by default** with two obvious buttons, because ten unmuted laptops in one classroom is miserable
and somebody may be listening to something else. A browser refuses to play before the page has been
touched, so every `play()` ends in a `.catch` that records the refusal and forgets it — a refused sound
never breaks the frame it happened in. `audio.firstPlayError` holds what the browser said the first
time, deliberately, because "it was refused" is a fact worth being able to see. A sound on each round
result, a fanfare on winning a duel; the 637 kB music file is only fetched if somebody actually asks
for music.

**The footstep is not like the other effects, and must not be tuned like them.** It fires the entire
time you are walking, and the first version — an 8-bit blip at full effect volume, every 26 pixels,
which is nearly six times a second — was genuinely unpleasant. A sound you hear two hundred times a
minute needs its own two numbers: `stepVolume` (0.22, against 0.6 for everything else) and
`stepIntervalMs` (400). It is timed rather than measured in pixels, because a footstep is a leg
moving and legs move at a pace. The sample itself is a recorded, muted dirt step from Kenney's CC0
RPG Audio pack — see `audio/README.md` for the licence trail and the one-line conversion.

## Which way a monster is looking

Every creature in `tiny-creatures.png` is drawn looking right, and several of the six are strict
profiles — the boar's tusk, the elephant's trunk, the deer's head. A monster walking left while
facing right is obviously broken, so:

- Every body carries **`facing`**, either `+1` or `-1`. Never `0`.
- `render.js` mirrors a `-1` body: translate to the middle of the sprite, `ctx.scale(-1, 1)`, draw
  half a sprite left of the new origin. `imageSmoothingEnabled = false` is set **again** inside that
  transform, or the mirrored pixels come out fuzzy.
- **Standing still keeps the last facing.** `facing` is a memory, not a wish; snapping back to right
  when you let go of the key looks like a bug.
- Your own monster takes its facing from what you *asked* for, so pushing west against a wall still
  turns you west. A **peer's facing is worked out from the direction they are sliding**, in
  `net.update()`, rather than sent. It is free, it needs no new field in a `move` packet and no new
  version of the protocol, and "walking left" is exactly "x going down". Flint never walks, so he
  keeps the atlas's own direction.

## One window at a time

Open the game twice in the same browser and both tabs read the same save, so both are honestly you —
same name, same monster — and the world sees two of you. The rule is **the newest window owns the
game** (`src/session.js`, over a `BroadcastChannel`):

1. Every tab makes a random session id at boot and broadcasts a **claim**.
2. A tab already playing hears it, **saves its live state**, replies with a **handover** carrying
   that state, and only then goes inactive: loop stopped, **`net.leave()`**, calm card on screen.
3. The claimer waits 400 ms for a handover. If it comes, it adopts that state — the save on disk is
   up to half a second old, the handover is the position at the instant of the knock. If it does not
   come, `localStorage` is used exactly as before.
4. The card says what happened in plain words and has one button, which re-claims and reloads.

**Leaving the room is the part that matters.** Stopping the loop alone would leave a second copy of
you standing in the world for as long as the old tab was open, which is the whole bug.

`BroadcastChannel` is same-origin, and that is exactly the scope of this problem. Two browsers, or
`localhost` and `127.0.0.1`, are genuinely two players and must stay that way.

Taking the game back — and starting over — both **reload**. Rebuilding the room, the loop, the camera
and the peer list by hand would be three chances to leave half the old one behind; the boot path
already does all of it correctly. Anything that deliberately leaves sets a `leaving` flag first, so
the `pagehide` flush cannot write a stale save over the one it just chose.

## Start over

The only way to change your name or animal used to be clearing `localStorage` by hand, which no
twelve-year-old is going to do — and students will want to try all six animals. So: a plain
**"Start over"** button beside the sound controls, a DOM confirm panel in the same style as the
onboarding (never `confirm()`, which freezes the page and prefixes your words with "localhost:8840
says:"), and on yes: leave the room properly, clear the save, reload into the real name-and-animal
flow. Neither button is red; starting over is a reasonable thing to want.

Two details that are not obvious:

- **The safety card lives in its own key** (`kakkoi-online-safety`). It is about the person at the
  computer, not about the character, so it survives a reset — a child trying all six animals must not
  read the same three paragraphs six times.
- **A paused window cannot start over**: its card covers the whole viewport, buttons and all. Only
  the window that actually owns the game can reset it, which is how "two windows resetting the same
  save at once" stops being a state that exists. A paused window that is later resumed reloads, so it
  comes back as whatever character now exists — never as the one that was deleted.

## Nothing on this page is allowed to move the world

The "Challenge *name*" prompt appears and disappears constantly as you walk past people. It was
placed in the canvas's own grid cell, which quietly pushed the canvas into the *next* row, so the
entire page jumped down every time somebody came into reach and back up when they left.

The rule now: **anything that appears and disappears during play is out of flow.** The canvas has its
own positioned box, `#arena`, and the HUD badges and the challenge prompt are absolutely positioned
inside it. Showing or hiding them cannot change the layout, and the prompt floating over the bottom
of the world reads better than a bar underneath it. The duel screen, the onboarding overlay and the
paused card are all `position: fixed` for the same reason.

The canvas's bounding rect is identical with the prompt shown and hidden, at desktop width and at
390x780. If you add a panel, that is the check.

## The element is not shown anywhere

Each animal has an `element` in `data/monsters.json`, and it does nothing: a duel is decided entirely
by the move you pick each round. It used to be printed under every animal in the picker, which reads
as a promise that your choice matters. The label is gone. The field stays in the data — it is
flavour, it is documented as such, and the v2 design uses it — but nothing on screen mentions it. The
fire/water/earth on the duel screen is the *move* you choose, which is real.

## Status at last commit

- **Live:** https://online.kakkoi.dev (stage 1 — stages 2 and 3 are committed but not yet pushed)
- **Deploy:** the repo is published verbatim as static files; no check job, no build
- **Lessons written:** A09, A10 (in the `izumo-io` repo, live in EN/JA/PT)
- **Tests:** `tests/rules.test.html` — 7 passing, covering both triangles, the round result, the
  agree-from-both-sides property the duel rests on, and the first-to-three ending
- **Verified in two real browsers** (different origins, so two real players): a full duel end to end
  with both sides agreeing on the score, both fingerprints on the table before either move, a tampered
  reveal caught by the other side, refusing, timing out, a tab closed mid-duel, both challenging at
  once, and a duel against Flint
