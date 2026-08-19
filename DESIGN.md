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
| M3 | duel: FSM, three moves, local AI | A22–A24 |
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

`index.html` at the repo root **is** the game: a canvas that fills the screen, with the DOM interface
floating on top of it.
You are asked for a name, you pick one of six monsters, you read one short card about other people,
and then you are in the dungeon — walking, sharing it with whoever else has it open, and duelling them
(or Flint, who is always in the plaza) at rock, paper, scissors.

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
  duel.js           the challenge state machine and the round loop
  npc.js            Flint: answers exactly the questions a peer answers
  audio.js          six effects and a music loop, OFF until you say otherwise
  ui/duel-screen.js the challenge, three thumb-sized moves, and the two moves meeting
  ui/settings.js    the ⚙: sound, music, start over and the way out to the lessons
  ui/help.js        one line of instructions, in the words that match the device
  battle/rules.js   PURE. imports nothing. the rock-paper-scissors triangle lives here
```

**Scale.** 16px art at 2x, so a tile is 32 screen pixels; how many of them you can see depends on the
size of the window, because the canvas is sized to fit it (see "The world fills the screen").
`ctx.imageSmoothingEnabled = false` plus `image-rendering: pixelated`, and the camera is rounded to
whole pixels — without that the tile grid shimmers as you walk.

**The map.** `data/maps/town.json`, hand-laid: 48x36 tiles = 1536x1152 pixels, which is 2.4 screens
wide and 2.4 screens tall. Seven rooms — a tiled central plaza, two north halls, the west cells, a
south camp, a vault, a closet — joined by two-tile corridors that form loops rather than a tree, so
there is more than one way to get anywhere. Two layers of tile numbers (`ground`, `decor`) and one
list of the numbers you cannot walk through; collision is "is the square I am moving into in that
list", checked one axis at a time so sliding along a wall works.

**The monsters.** Six cells picked out of `vendor/opengameart/tiny-creatures.png` and named for what
they look like. **The list itself is `data/monsters.json`** — names, atlas cells and all — and it is not
repeated here: this file said for weeks that the six were called something they had never been called,
because a name written in two places is a name that will disagree with itself. A monster carries no
stat and no type — it is an animal you like the look of, and nothing else.

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

**The moves are rock, paper and scissors, and nothing else.** Rock beats scissors, scissors beats
paper, paper beats rock. A duel is **first to three round wins**, and a draw replays the round. There
are no hit points, no charges and no damage numbers.

That is a deliberate reversal, twice over. `planning/kakkoi-online-trd.md` §3 describes a Strike /
Block / Charge duel with charges, HP and a damage formula, and it is **superseded** (decision-log row
52). The fire/water/earth triangle that replaced it is **also** superseded (decision-log row 53): the
same three-way cycle, but with a name every player already knows, and without an "element" that has to
be explained and then explained away. The mapping was `water → rock`, `fire → scissors`,
`earth → paper`, so every beats-relationship is the one it always was. `battle/rules.js` still exports
`actionWinner`, unused, because a test is written against it and the shape may come back;
`elementMultiplier` and `data/type-chart.json` are gone, because nothing was left for them to scale.

**Your monster is a costume in a duel.** It decides what you look like and gives you no bonus at all
in a fight. There is no lesson that teaches a creature bonus, and inventing mechanics that nothing
teaches is the exact mistake the paragraph above corrects.

**Starting one is physical.** Walk up to somebody and a Challenge button appears over the canvas, with
a small arrow over their head; `F` does the same. There is no list of players with a button beside each
name — finding your opponent is part of fighting them.

**One state at a time.** `walking → waiting → asked → fighting`, straight out of A19. Every awkward
case is one line in `src/duel.js` and every one of them ends back at `walking`: they refuse; they are
already in a duel, so yours is politely declined; you both press Challenge in the same instant, and
each side sees the other's ask while already waiting, so you simply start; they close the tab; they
stop answering. Nothing waits forever — `answerTimeoutMs` (10s) is armed whenever we are waiting on the
other side, and the one-sided endings tell the other player, because otherwise they sit looking at
three buttons for somebody who has gone.

**The move is sent straight, and here is what that costs.** Each player picks; when both have picked,
the round is shown. Until this was simplified, both sides sent a SHA-256 fingerprint of
`round:move:secret` first and unfolded only once the other fingerprint had arrived, so that neither
could wait and see; a tampered reveal really was caught, and the duel ended as *caught cheating*. It
worked. It was also real cryptography guarding a game of rock, paper, scissors between about five
people who know each other, and it was most of why the duel read as complicated to the child it is for.

The honest consequence, written down rather than hidden: **whoever's move arrives first has shown their
hand.** The game never displays a move that arrived before you chose — `view()` withholds it until the
round resolves, so an honest player gains nothing by waiting — but somebody who edited the game's own
code could read it off the wire and answer it. That is an accepted trade: there is no server, nothing
is at stake, and a duel a nine-year-old can follow is worth more here than one that cannot be cheated.
If this were ever a game between strangers, commit–reveal is the thing to put back, and
`demos/22-no-peeking/` still teaches exactly how it works.

**The round is shown, not narrated.** The two moves sit side by side for the whole round — yours fills
in the moment you pick it, theirs is a breathing question mark until both are in — and then the reveal
rings the winner, says one plain sentence (*"Rock beats scissors. You win the round."*) and holds it
there for `roundGapMs` before the next round opens. The version before this one put `Pick a move.` in
the headline and *"Last round: you played rock, they played paper"* underneath it in small grey text:
you never saw the two moves meet, and the thing that had just happened was demoted beneath the prompt
for the next thing. The three phases are also told apart **by eye** — choosing is lit and live, waiting
is cooled down with the buttons dimmed, the reveal is the loudest thing on the screen — because a
player who has to read the panel to know whose turn it is is playing a slower game than the one we
wrote. The score carries both names (`You 2 — 1 Bristle`); a bare `2 — 1` is the numbers without the
one thing you wanted them for.

**The duel card knows what to sacrifice.** It is never taller than the window, and it spends its space
in priority order: the three moves and the button that leaves never shrink and are never below the
fold, because they are how you play. Everything above them compresses first, drops the small print the
score row already says once the window is under 400px tall, and only then scrolls — with the buttons
still on screen underneath it. Before that rule existed, a phone turned sideways (740x360) put "Give
up" off the bottom and a short desktop window (1440x300) put all three moves off it, and an overlay
that scrolls is no answer at all: nobody scrolls for a thing they cannot see.

**Flint.** A seventh character stands in the plaza and is challenged exactly the way a person is. He
matters because this game will usually have one person in it. The point is the *shape*: he answers the
same questions a peer answers, over the same little `link` object — ask, reply, move — so
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
**"Start over"** button in the settings panel behind the ⚙, a DOM confirm panel in the same style as the
onboarding (never `confirm()`, which freezes the page and prefixes your words with "localhost:8840
says:"), and on yes: leave the room properly, clear the save, reload into the real name-and-animal
flow. Neither button is red; starting over is a reasonable thing to want.

Two details that are not obvious:

- **The safety card lives in its own key** (`kakkoi-online-safety`), and so do the instructions the
  player has outgrown (`kakkoi-online-learned`). They are about the person at the
  computer, not about the character, so they survive a reset — a child trying all six animals must not
  read the same three paragraphs six times.
- **A paused window cannot start over**: its card covers the whole viewport, buttons and all. Only
  the window that actually owns the game can reset it, which is how "two windows resetting the same
  save at once" stops being a state that exists. A paused window that is later resumed reloads, so it
  comes back as whatever character now exists — never as the one that was deleted.

## Nothing on this page is allowed to move the world

The "Challenge *name*" prompt appears and disappears constantly as you walk past people. It was
placed in the canvas's own grid cell, which quietly pushed the canvas into the *next* row, so the
entire page jumped down every time somebody came into reach and back up when they left.

The rule now: **anything that appears and disappears during play is out of flow, and is positioned
against the canvas's own box.** That box is `#screen`, which wraps the canvas and nothing else, so it is
exactly the canvas's size at every window size. Everything else lives inside it — the HUD badges, the ⚙
and its panel, the help line, the challenge prompt and the phrase row. `#arena` is the *space available*
and can be bigger than the world; anything measured from it would eventually sit below the canvas or
off the bottom of the screen, which is exactly what happened to the challenge prompt when it floated at
a hand-tuned `bottom: 4.2rem` chosen to clear the phrase row. The prompt and the phrase row are now one
bottom-anchored stack with no offset in it at all: hide the phrases and the prompt takes the bottom of
the canvas. Showing or hiding
any of them cannot change the layout. The duel screen, the onboarding overlay and the paused card are
all `position: fixed` for the same reason.

The canvas's bounding rect is identical with the prompt shown and hidden, with a bubble up, with the
settings panel open and closed, and with the duel screen open and closed — at desktop width and at
390x780, with the document height unchanged throughout. If you add a panel, that is the check.

## The world fills the screen

It used to be a fixed 640x480 canvas stretched by CSS with four stacked bands of furniture underneath
it: the phrase row, a line of instructions, and four bare text toggles. On a 390px phone that left the
world **36% of the screen height**, most of the game hidden behind dead space; on a desktop it was 72%.
It is now **100% of both**: the canvas is the screen, and every control floats on top of it.

- **Sized in whole art pixels.** `fitCanvas()` in `render.js` gives the canvas a drawing surface the
  size of its box, one canvas pixel per CSS pixel, snapped down to a multiple of `world.scale × zoom`.
  So an art pixel is a whole number of CSS pixels and can never be resampled — the old fixed canvas
  showed 640 real pixels across 374 of them, which is 1.17 screen pixels per art pixel, and pixel art
  resampled is pixel art ruined. Resizing a canvas resets its 2D context, so `imageSmoothingEnabled` is
  set again on every fit rather than once at boot. Bigger screens see more of the world; past the edge
  of the map the camera stops and the background frames it.
- **One settings control, and everything is in it.** Four bare toggles in a row is four decisions asked
  of somebody who has not started playing yet, and it made the page look unfinished — so they are behind
  a ⚙ in the corner (`src/ui/settings.js`). Because it is now the only door to anything that is not the
  game, everything a player might want is behind it: **Sound**, **Music**, **How to play** (the same two
  sentences the hint gives, in this device's words, for the player who forgot or the friend they handed
  the phone to), **About other players** (reopens the safety card, which is otherwise shown once on the
  first run and never again — a child who wants to re-read it, or a parent who wants to see it at all,
  has to be able to), **Install**, **Start over**, and the link to the lessons. The ⚙ is a real
  `<button>` with an accessible name, so it takes focus and answers Enter and Space; Escape closes the
  panel and returns focus to it, and so does a click anywhere else.
- **Install is only there when it is real.** The entry stays hidden until `beforeinstallprompt` actually
  hands us a prompt, and hides again on `appinstalled` or when the game is already running standalone.
  Only Chromium fires that event at all, so on Firefox and iOS there is simply no entry — which is
  right. A button that cannot do the thing it names is worse than no button.
- **The help line matches the device, and goes when it is no longer needed.** It named `WASD` and `F`
  on phones, which have neither — a child reads that, looks for the key, and concludes the game is
  broken. `src/ui/help.js` starts from `(pointer: coarse)` + `(hover: none)` and then corrects itself
  from what actually happens: a real `keydown` means a keyboard, a real `pointerdown` with
  `pointerType: 'touch'` means a finger, and the later of the two wins. Hybrids are real — a tablet
  with a keyboard, a laptop with a touchscreen — and neither a user-agent string nor a width breakpoint
  gets them right; a narrow window on a desktop is still a desktop.
  It is **two hints, retired separately**, because they are learned at different moments: the movement
  line goes once the player has actually travelled **three tiles** (far enough to be a journey across a
  room, not a frame of drift, and measured in distance covered so that pushing against a wall teaches
  nothing), and the challenge line goes the first time a challenge is actually started, by `F` or by
  the button. Somebody who has walked the whole map without ever challenging anyone still sees the half
  they have not used.
  Both facts are remembered in their own key, `kakkoi-online-learned`, beside the safety flag and for
  the same reason: knowing how to walk is a fact about the person, not about the character, so starting
  a new character must not re-teach them.
- **The phrase row never wraps.** `nowrap` and a font that shrinks with the viewport; at 390px all six
  fit on one line, and the horizontal scroll is only a safety net for something narrower than a phone.

## One unit, and a zoom — but only one of them touches the world

The interface used to be sized in `px` and the art was always ×2. Both are now decided from the size of
the window, in `src/ui/scale.js`, and the two decisions are deliberately different in kind.

- **The UI unit** is a whole number of pixels, 9 to 15, taken from the *smaller* side of the window and
  written to the root font size. Every length in `game.css` is a `rem`, so the whole interface is that
  one number: a phone gets small chrome, a desktop gets big chrome, and there is no breakpoint in the
  file except two, where the *shape* of the duel card changes rather than its size. Whole numbers
  because a `0.14rem` border has to land on a pixel boundary — a fractional unit gives fractional
  borders, which is exactly the smudge `image-rendering: pixelated` exists to prevent. The smaller side
  because a phone in landscape is 844×390, and sizing from width alone would give it desktop chrome with
  nowhere to put it.
  Interactive rows carry `max(Nrem, Npx)`: the unit can shrink, a thumb cannot, so the px floor is what
  a finger actually gets — 40px for a phrase, 44px for `Challenge` and the duel buttons, 34px for the ⚙.
- **The art zoom** is 1 or 2 screen pixels per world pixel, so the town is drawn at ×2 on a phone and ×4
  on anything roomier. A phone showing the whole 640×480 world made a 16px monster about four
  millimetres tall; now a small screen simply sees less of the town, which is how every game this one is
  pretending to be has always worked.

  **The zoom is not `world.scale`, and must never become it.** `world.scale` is the size of the
  coordinate space itself: the player's box, `walkSpeed`, `challengeReachPx`, every saved position and
  every position that goes over the wire are all in world pixels. Make that depend on the size of the
  window and a phone and a desktop stop agreeing about where anybody is standing — your x of 400 lands
  halfway across my map — and dragging a window wider teleports the player and rescales the map under
  them. So the coordinate space stays exactly where it was, at ×2, and the zoom is a transform
  `render.js` sets on the way to the screen. Both numbers are whole, which is all pixel art asks.
  Checked by resizing across the boundary: the player's position and the world's size do not move.

## The game draws its own buttons

`vendor/basecoat.min.css` is gone, and `src/ui/game.css` styles the whole interface itself. A
component library is built to make an admin panel look considered — rounded corners, soft shadows,
a blur — and a 16-pixel sprite and a soft shadow cannot share a screen without one of them looking
like a mistake. The replacement is one rule applied everywhere: **0.14rem of solid black and a hard
offset of the same black.** No radii, no blur, no gradient. That is what makes a name plate, a badge,
a bubble and a button read as the same object at four sizes, and it is why nothing needs a colour of
its own to look deliberate. Gold is the action colour and only ever that; rose is the opponent's side
of a duel and only ever that.

- **The moves are the game's own pixels.** ✊ ✋ ✌ were emoji, drawn by the operating system, so they
  were the one thing on the screen the game did not control: a rock was a grey lump on one phone, a
  cartoon on another, a flat outline on a third. `src/ui/glyphs.js` draws all three as rectangles on
  the same 16-pixel grid as the tiles, once, as `<symbol>`s — so a move button, a face-off box and a
  bubble over somebody's head are literally the same picture at three sizes. The ⚙ is one of them too.
- **Names and bubbles are DOM, not canvas.** `drawNameplate()` and `drawBubble()` are gone from
  `render.js`; `src/ui/bubbles.js` puts real elements over the canvas, positioned from the numbers
  `drawActor()` already returns. Canvas text cannot be read by a screen reader or found by the
  browser's own find, it is measured in device pixels so it fought the UI unit, and every glyph had to
  be laid out by hand. The elements are **kept between frames** and moved by writing two numbers: the
  obvious version rebuilds the layer every frame, which at 30fps is a few hundred elements a second
  plus a forced layout inside each frame, and ISSUES.md #1 is a phone getting hot.
- **Tracking is a whole pixel, not a fraction of the type size.** `0.04em` of a 12.35px font is
  0.494px, and a browser cannot put half a pixel between two letters — it rounds each gap as it goes,
  so a word comes out with visibly uneven spaces. Reported as "the letter spacing looks off", and it
  was. `--track: 1px` now travels with `--pixel` wherever that family is set, which also fixes the
  places that had none and where `WASD` and `walk.` ran their letters together. The need comes from
  the pixel grid, not from the type size, which is exactly why a flat pixel is the right answer at
  every size.
- **Two fonts, vendored.** `DotGothic16` for chrome, `Space Grotesk` for anything longer than a few
  words — a paragraph set in a pixel font is a paragraph nobody reads. Latin subsets only, 33 kB the
  pair, in `vendor/fonts/` and precached: the game is installable and must open with no network, so a
  webfont from a CDN is a webfont that is missing on a plane, and a page a child opens should not be a
  request to somebody else's server.

## There is no element, anywhere

An animal used to carry an `element`, printed under it in the picker. That reads as a promise that
your choice matters, and it never did: a duel is decided entirely by the move you pick each round.
The label went first, then the concept (decision-log row 53). `data/type-chart.json` is deleted,
`elementMultiplier()` is gone from `battle/rules.js`, the `element` field is out of
`data/monsters.json`, and `elementAdvantage` / `elementResist` are out of `data/tuning.json`. Nothing
reads any of them; `grep -ri element src data tests` finds only DOM elements. A creature is an animal
you like the look of.

## Installable, and it opens with no network

The game is a static HTTPS page, so making it installable on a phone's home screen costs three files
and no build step.

**`manifest.webmanifest`** at the repo root, linked from `index.html`. `display: "standalone"`, so an
installed copy opens without a browser bar; `start_url` and `scope` are both `"./"`, which resolves to
the domain root on online.kakkoi.dev and to `/kakkoi-online/` in a fork, without either having to be
written down. Theme and background are `#0c0c12`, the colour the canvas already is, so the splash and
the status bar match the game rather than flashing white in front of it.

**The icons are the game's own art.** Sunmane the lion — cell 156 of
`vendor/opengameart/tiny-creatures.png` — scaled up from 16px with smoothing OFF and centred on
`#0c0c12`. Nothing new was imported and nothing was drawn: the icon on the home screen is a sprite
from the game. They live in `icons/`, at 192 and 512, plus 180 for iOS. Every scale is a whole
multiple of 16 or the pixels stop being square.

The two **maskable** variants exist because Android crops an icon to whatever shape the launcher
likes. The safe area is a circle of 80% of the square, so the animal has to fit the square inscribed
in that circle — 0.8/√2 ≈ 0.566 of the side, rounded down to a multiple of 16: 96px inside 192, 288px
inside 512. Without that, the launcher crops the lion's head off.

**`sw.js`** caches the app shell. It answers with the cached page for exactly two navigations — the
scope root, which is `start_url`, and `./index.html` — and for nothing else. The first version answered
*every* navigation with the shell, and so served the game in place of `tests/rules.test.html`: the
scope is the whole origin, and "every navigation" is every other page in the repo. It precaches a
hand-written list of every file the game actually loads — html, css, js, the six trystero modules, the two atlases it draws with, `data/*.json` and the
audio — and serves exactly those cache-first. Everything else goes to the network and is never cached,
so nothing can go stale by accident. The list is written out rather than crawled because there is no
build step here to crawl with, and a list you can read is a list you can check.

**The cache has a version in its name and `activate` deletes every other cache on the origin.** That
is the whole reason a PWA does not become unfixable. Without it the old cache survives every deploy,
the stale copy is what answers, and the fix ships to nobody. **Bump `CACHE` in `sw.js` on any deploy
that changes a file in `SHELL`.** Verified in the browser, both directions: after a version change
`caches.keys()` is exactly one name, never two.

**What works offline:** the world, walking and collision, your saved name, animal and position, the
whole interface, sound, and a complete duel against Flint — all of it, from the cache, with the
network genuinely cut. **What does not:** other people. Finding them is a WebSocket to a relay on
another origin, which never comes near the service worker, and no amount of caching invents a second
player. Offline the HUD honestly says "Just you here for now".

The worker is registered from `index.html`, last, in a `catch`, and only over https or localhost —
everywhere else `navigator.serviceWorker` is absent and asking for it would throw for no reason. A
service worker is an improvement to a game that already works, so it is never allowed to stop the game
starting.

**It does not touch `localStorage`.** There are real saved characters on the live site; a cache is not
a save, and nothing here clears or migrates one.

## The lessons link

`index.html`'s tools row has a quiet "Learn to build this" link to the lesson track, beside the sound
buttons and styled exactly like them. Somebody who was sent the game link should be able to find out
they could build one — that is the whole reason the game exists — and a README is not where they would
look. It is deliberately not a banner or a call to action.

## Status at last commit

- **Live:** https://online.kakkoi.dev (stage 1 — stages 2 and 3, the rock-paper-scissors duel and the
  PWA are committed but not yet pushed)
- **Deploy:** the repo is published verbatim as static files; no check job, no build
- **Lessons written:** A09, A10 (in the `izumo-io` repo, live in EN/JA/PT)
- **Tests:** `tests/rules.test.html` — 7 passing, covering the rock-paper-scissors triangle by name,
  the leftover action triangle, the round result, the agree-from-both-sides property the duel rests
  on, and the first-to-three ending
- **Verified in two real browsers** (different origins, so two real players): a full duel end to end
  with both sides agreeing on the score (3–0 on one machine is 0–3 on the other), a move that arrives
  before you have chosen held back until the reveal, refusing, giving up mid-duel, never answering, a
  challenge sent to somebody who is already busy, and a duel against Flint
- **Verified offline** with the local server stopped *and* the browser put offline: an uncached request
  fails, the game boots from the cache, the save comes back, you can walk, and a full duel against
  Flint plays out to 0–3 with every request still failing at the end
- **Verified for layout**: the canvas is 100% of the viewport height at 390x780 and at 1280x800 (88.6%
  at 1700x1300, where the world itself runs out); the canvas rect and the document height do not move as
  the challenge prompt, a chat bubble, the settings panel or the duel screen appear and disappear; the
  challenge prompt and the phrase row stay inside the canvas and inside the viewport at 320x568,
  360x1200, 390x700, 390x780, 740x360, 820x1180, 1280x720, 1440x400, 1440x813 and 1700x1300; the ⚙
  menu's last row is reachable at 1440x300; and in a duel, all three moves and the leave button are on
  screen without scrolling at 1440x300, 740x360, 667x375, 320x480, 390x780, 1024x768, 1280x720, 280x600
  and 1920x1080, in every phase
- **Verified for the pixel skin** (2026-08-19, in Chromium, at 390x780, 740x360, 820x1180, 1280x800 and
  1440x300): the game boots with no page errors and no failed requests; both vendored fonts load and
  the pixel/prose split holds; the ⚙ and all three move glyphs draw; the name plate and the head bubble
  are elements that are *kept* across frames rather than rebuilt (marked and still there after a second
  of walking) and a phrase bubble appears and expires on its own; a full duel against Flint plays out
  through choosing, waiting, the reveal and the final score, with the card fitting the window and
  nothing scrolling at every size above; nothing scrolls the page anywhere; the 7 rules tests still
  pass; and the game still boots with the browser offline, from a v9 cache holding 53 files including
  the fonts and the three new modules
- **Verified across the zoom boundary**: resized 390x780 → 1280x800 → 375x667, which takes the art zoom
  from 1 to 2 and back. The player's position (742, 558) and the world's size (1536x1152) do not move —
  which is the whole reason the zoom is a transform and not `world.scale`
