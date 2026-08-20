# Stage 4 — chests, Aniki, and the level editor

The plan for the three features that make up **part 3 of the course**. It was written before any of
it existed, so that the expensive decisions were made in prose where they are cheap to change.

**Status: M5, M6 and M7 are built.** What was decided here is what shipped, with the recommended
answers taken for every open question, and `DESIGN.md` now carries the design of each as it actually
turned out. Three things below did not survive contact with the code, and each is marked **[changed]**
where they appear: Aniki's lives, the new area, and the map maker's palette. The rest of this
document stands as written.

Read `DESIGN.md` first if you have not: it is the record of why the game is what it is, and this plan
is bound by it.

---

## The rules all three have to live inside

These are not preferences. Every design below is shaped by them, and where a feature fights one, this
plan says so out loud rather than quietly losing.

1. **There is no server.** Nothing can be authoritative, refereed, counted centrally, or verified.
   Anything a player's own browser says about them is a claim, not a fact.
2. **There is no build step.** What is in git is what the browser runs. No bundler, no npm, no
   compiler, plain files.
3. **The people playing are children**, there is no moderation and none is possible, and every new
   thing that crosses the network is a new thing a stranger's computer can say to a child's.
4. **Numbers live in `data/`, not in code.** Balance is an edit.
5. **Whole pixels.** Every size is a whole number of art pixels or the picture stops being pixel art.
6. **Change a shipped file, bump `CACHE` in `sw.js`.** A fix nobody receives is not a fix.
7. **The lesson is the point.** These features exist to be *built on camera*, in order, by somebody
   learning. A feature that works but cannot be explained in one sitting is a worse feature.

---

## 1. Chests — 10, 25, 50, 100 wins

### What a player sees

You win duels. At 10, 25, 50 and 100 wins a chest appears in the corner with a soft nudge; opening it
is a small ceremony — the chest, then the thing inside, then your monster wearing it. What is inside
is **only ever a look**: a recolour, a pair of shades, a small crown. Nothing you unlock makes you win
more often, because the animal you pick already changes nothing in a fight (`DESIGN.md`, "There is no
element, anywhere") and a reward that changed that would undo the one promise the duel makes.

Everyone else sees what you are wearing. That is the whole point of a cosmetic.

### Decisions

**Wins are counted in your own browser, and cheating them is easy.** There is nowhere else to count
them. A child who edits `localStorage` gets a hat. This is the same trade the game already takes for
positions and moves, it is written in the README under "No server means", and the lesson is worth
more than the hat: *what can and cannot be enforced without a referee.* No obfuscation, no checksum
theatre — those teach the wrong thing and do not work anyway.

**A win against Flint counts.** This game usually has one person in it. A reward loop that needs other
people would be locked for most players most of the time. Flint wins about a third of his rounds, so
he is not a free chest either.

**Chests survive "Start over".** Wins and unlocks live with `safetySeen` and `learned` — the facts
about the *person*, not the character. Starting over asks for a new name and a new animal; it should
not take away the hundred duels you played. (See `save.js`, which already keeps two such keys.)

**Cosmetics are data, not new art files.** Two kinds, both described in `data/cosmetics.json`:

- a **palette**: pairs of colours to swap in the creature's own 16×16 sprite, applied once at boot
  into an offscreen canvas per (monster, palette) and cached. `getImageData` on a vendored,
  same-origin PNG, so no CORS, no new download, and one of the best lessons in the whole track — *a
  picture is a list of numbers, and you can do arithmetic on it.*
- an **overlay**: a short list of coloured pixels painted over the sprite, exactly the way
  `src/ui/glyphs.js` already draws the three moves. Shades are eight pixels. A crown is eleven. They
  are readable in the JSON, editable by a student, and cost nothing to download.

**What crosses the wire, and how often.** A cosmetic id must reach other players or nobody sees it.
It does **not** go in the position packet: that is sent ten times a second and ISSUES #1 is a phone
getting hot. It rides in `hello`, plus a `look` message re-sent when it changes and sent directly to
anybody who joins — the pattern `src/spectate.js` already uses for duel faces. An id this build does
not recognise is counted in `net.dropped` and thrown away, like every other field.

### The shape of it

    data/cosmetics.json      the four rewards: id, name, chest (10|25|50|100), kind, and the pixels
    src/wins.js              counting wins, opening chests, remembering what is unlocked
    src/looks.js             palettes and overlays applied to a sprite; the tinted-atlas cache
    src/ui/chest.js          the opening ceremony, in the card vocabulary game.css already has
    src/save.js              + wins, + unlocked[]  (kept across Start over)
    src/net.js               + peer.look, and the `look` message
    src/render.js            drawActor draws the overlay after the sprite
    tests/wins.test.html     thresholds, "each chest opens once", a corrupt save, the wire validation

### Lessons it carries

Counting and thresholds; reading and writing your own save format; **image data as numbers**; adding
a field to a protocol without breaking the players who have not updated; and the honest one —
client-side state is a claim.

### Risks

- **Grind.** 100 duels is a lot for a child. `data/tuning.json` owns the four numbers; expect to move
  them after watching one real player.
- **Palette swap on six monsters × four palettes** is 24 small canvases. Measure the memory before
  assuming it is free.

**Size: S–M.** No new subsystems, no network beyond one message.

---

## 2. Aniki — Flint's big brother, on the hour

### What a player sees

At the top of every hour Aniki is standing in the plaza for ten minutes: the same creature as Flint,
recoloured and drawn at twice the size, because he is the big brother. Anyone can walk up and join
the fight, and everybody in it fights him *at the same time*, in the same rounds. He has ten lives.
You have three. Every round, everyone who beat him takes one of his lives, and everyone he beat loses
one of theirs. Beat him and you get an achievement — and the door to somewhere new.

### The one hard problem, stated plainly

Everything about a shared boss is easy except the thing that matters: **without a referee, how do five
browsers agree on what happened?** This is the central design problem of the feature and the reason it
is worth teaching. Three sub-problems, three answers.

**(a) When is he here?** Not by announcement — by arithmetic. Every browser computes
`Math.floor(Date.now() / 3600000)`; he is present for the first `bossMinutes` of each hour. Nobody
sends anything, nobody has to be first, and a player who arrives late sees exactly what everybody else
sees. Cost: a device with a badly-set clock sees him at the wrong time. That is acceptable and worth
saying in the lesson — *a shared clock is a shared fact you did not have to send.*

**(b) What does he play?** **A seeded dice, not a memory.** His move for round *r* is
`prng(hourIndex, r)` — the same tiny hash function in every browser, so every browser computes the
same move without a single message. Nobody can be ahead of him, because he was decided before anyone
chose.

This is a real departure from "he plays like Flint", and it is deliberate. Flint's algorithm leans
against *your* favourite move, and in a fight with five people there is no "your". Making him lean on
what the room played needs every client to have received every player's move before choosing his next
one — and a single dropped packet then makes two browsers compute *different Aniki moves*, which means
they disagree about who got hit. A boss who is unpredictable-but-identical everywhere is a better
fight and a far better lesson than a boss who is adaptive and inconsistent. **This is open question 1
below.**

**(c) Who lost what?** Split the question, because half of it has a perfect answer:

- **Your own lives are yours to compute.** Your move against his move, both of which you have with
  certainty. No packet can make you wrong about your own health, and nobody else can take a life off
  you. This is the half that must never wobble, and it does not.
- **His lives are an estimate — everybody's own.** You count one hit for each player whose move you
  *saw* beat him. A player whose packet you missed simply did not hit him as far as you know. So two
  people can see him on 3 and 4, and the fight can end a round apart on two screens.

That last sentence is the honest cost, and the plan accepts it rather than pretending. Mitigations:
each move is broadcast once at the reveal (the machinery already exists — `spectate.js` does exactly
this shape); the display says *his lives as you have seen them*; and the achievement is awarded to
anybody who was still standing when **their own** browser saw him fall. Two friends may get it a round
apart. Nobody is robbed.

### Rounds run on a timetable, not a handshake

The duel waits for both players; a raid cannot wait for five, and must not break when one locks their
phone. So rounds come from the clock, like his arrival: round *r* runs from `hourStart + r*roundMs`,
you choose during the first part of it, and it resolves at the end whatever anyone did. Miss a round —
asleep, offline, walked away — and you neither deal nor take damage. That is kinder than punishing a
dropped packet, and it makes joining mid-fight free: there is no state to catch up on.

### Keep it out of `duel.js`

`src/duel.js` is a tested, lesson-critical 1-versus-1 state machine, and a boss is not a duel with
more people — it is a different game with the same three moves. New file, `src/boss.js`, importing the
same pure `battle/rules.js`. The duel screen's look is reused; its logic is not touched.

### The shape of it

    data/tuning.json         bossMinutes, bossLives, playerLives, bossRoundMs, bossChooseMs
    src/boss.js              the timetable, the seeded dice, damage, and who is in it
    src/ui/boss-screen.js    the raid panel: his lives, your lives, everybody else's moves
    src/net.js               + a `raid` message: {r: round, m: move}
    src/npc.js               Aniki's body and where he stands (Flint's neighbour, twice the size)
    src/main.js              the countdown in the HUD, and the challenge that joins a raid
    tests/boss.test.html     two "browsers" agreeing on his move; damage; a missed round; his fall

### Lessons it carries

The best material in the whole track, and it is not the boss: **agreement without a referee.** A
shared clock as a shared fact. A seeded random that is the same everywhere. Which quantities you can
be certain of (yours) and which you can only estimate (everybody else's). Designing for the packet
that does not arrive. Then, secondarily: a second AI opponent, and a fight with more than two people
in it.

### Risks

- **He might be lonely.** An hourly boss in a game with one player in it is an hourly boss you fight
  alone with three lives against ten. Balance for the solo case first — either fewer lives when fewer
  people are present (everyone can count the room), or a solo fight that is honestly winnable.

  **[changed]** Scaling his lives to the crowd was the recommendation and it was wrong: how many
  people are here is another thing browsers cannot agree on, and disagreeing about how much health he
  *started* with is worse than disagreeing about how much he has left. What shipped instead keeps his
  ten and your three exactly as asked, and makes the fight repeatable: **his wounds last the hour,
  yours last the fight.** Lose your three and you are out — then walk back up to him with three more,
  while his damage stays where it is until the hour ends. A crowd fells him in a couple of minutes;
  one person can still do it, slowly. Same numbers, no agreement needed.
- **Ten minutes is a long window to keep six browsers in step.** Expect the first version to disagree
  more than the plan hopes, and instrument it: log the round, his move, and your damage, so a
  disagreement can be read afterwards rather than argued about.
- **The new area** it unlocks is a second map, which the game cannot do yet (one map is loaded at
  boot). That is a real piece of work — see the order of play below, because the editor is what makes
  maps.

  **[changed] The new area was deferred, and the achievement is a look instead.** Beating him gives
  *Aniki's mark*, which no chest can hand out, and which everybody else can see on you. The reason is
  scope told honestly: a second map is not "load another file", it is a door tile, a save that knows
  which map you are in, a camera and a world that can be swapped underneath the loop, and — the part
  that makes it a milestone rather than an afternoon — **peers who are in a different room**, which
  the position protocol has no way to say. Half of that shipped as a broken door would be worse than
  none of it. It wants its own milestone and its own plan.

**Size: L.** The biggest of the three, and the one to build last.

---

## 3. The level editor, and a Pull Request at the end of it

### What a player sees

A separate page — `editor/index.html`, not part of the game — with the tile sheet down one side and a
map in the middle. Click to paint, drag to draw a line of wall, pick the ground layer or the decor
layer, drop the spawn point, name it. Load the town to see how it was made, or start empty. When it
looks right, press **Check** and then **Submit**, and you are taken to GitHub with your map ready to
propose. Cyril reviews it. If he merges it, your map is in the game everybody plays.

**[changed] The tile sheet is not offered whole.** "The tile sheet down one side" was written without
looking hard enough at what is in it: `tiny-dungeon.png` has a wizard, a skeleton, a ghost, a red
devil, potions and wands in its lower rows. None of that is going in a map — it was asked for
plainly, and it is also wrong for a game where every creature on screen is a player. `src/tiles.js`
now lists the 81 pictures the palette offers, the rest are not drawn at all, and `check()` refuses a
map that uses one so that pasting JSON in does not go round the palette.

### How the submit button works, and why it is the interesting part

**A static page cannot hold a GitHub token.** Anything the page knows, every child who opens it knows,
and a token in a web page is a token that has been given away. There is no server here to hold one
either. So the button does not use the API at all:

    https://github.com/KakkoiSchool/kakkoi-online/new/main?filename=data/maps/<name>.json&value=<the map>

That is GitHub's own "create a new file" page, arriving pre-filled. The student is signed in as
themselves, GitHub forks the repo for them, makes the branch, and opens the pull request through its
own interface. No token, no server, no secret — and they have done the real thing, under their own
name, with their own commit.

**The size limit is real and has to be designed around.** `data/maps/town.json` is **10,966 bytes**,
which is past what a URL can carry safely. Three answers, in order of preference:

1. **New areas are smaller than the town.** 32×24 is 768 tiles, about 4.5 KB. Comfortable, and a first
   map should be small anyway.
2. **A compact form for long runs.** Maps are mostly the same tile repeated; run-length encoding the
   two layers would cut a full-size map to a fraction and make the pull request *readable* — a diff of
   runs instead of a wall of 1,728 numbers. It costs one branch in `world.js` and it is a genuinely
   nice lesson on its own.
3. **Copy and paste.** The always-works fallback: copy the JSON, open the new-file page, paste. Less
   magic, no limit, and it is what the editor falls back to when the URL would be too long.

**Validation happens in the editor, not in CI.** This repo has no check job by design. A map that
traps the player behind a wall, or names a tile that does not exist, or has no spawn, should be caught
by **Check** before it is ever proposed — with a flood fill from the spawn point drawing the reachable
floor in green, which is both the check and the explanation of what a flood fill *is*.

**A merged map is content in a game children play.** The game's position is that moderation is
impossible — no server, no logs, no reports. This is the one place that changes: a pull request is a
gate, and the person merging it is the moderator. Worth stating in the lesson, because it is the
honest difference between "chat is six preset phrases" and "anybody can send you a map".

### The AI half

The intent — *"maybe can be used in conjunction with the AI chatbot to build"* — is **open question 3
below**, because it could be two quite different features. The plan assumes the one that costs nothing
and teaches most: the editor's JSON is the thing the student and the AI talk about. You describe a
room to Claude, it writes or edits the map JSON, you paste it into the editor and look at it, and you
fix by hand what the machine got wrong. That is the actual workflow this course exists to teach, and
it needs no API key — which a static page could not hold anyway, for exactly the reason the submit
button does not use one.

### The shape of it

    editor/index.html        the page, plain, reusing src/ui/game.css
    editor/main.js           painting, layers, spawn, load, export
    editor/submit.js         the JSON, the size check, the GitHub URL, the fallback
    src/world.js             + the compact form, if we take option 2
    src/map-check.js         validation shared by the editor and the tests
    tests/map.test.html      a good map, a trapped spawn, an unknown tile, a map with no floor
    .github/pull_request_template.md   what a map PR should say

### Lessons it carries

Fork, branch, commit, pull request, review, merge — the real cycle, on their own map. Why a web page
cannot keep a secret. Flood fill. Working *with* an AI on a data file rather than asking it for
everything. And reading a review: someone will ask them to change something.

### Risks

- **Desktop first.** Drag-to-paint on a phone is a different interface; do not promise both at once.
- **A stream of map PRs is a stream of review work.** Worth deciding the acceptance bar before the
  lesson goes out, not after twenty of them arrive.

**Size: M.** Mostly self-contained, and the only one that touches the game's own files lightly.

---

## The order to build them, and why it is not the order they were asked for

| M | Ships | Why here |
|---|---|---|
| **M5** | Chests, cosmetics, the `look` message | Smallest, self-contained, and it establishes how a cosmetic crosses the wire before anything else needs to |
| **M6** | The level editor, validation, the PR button | Independent of the other two, teaches the highest-value thing, and it is what *makes* the new area |
| **M7** | Aniki, the raid, the achievement | Hardest, and it is the only one that wants something the other two have already built |
| **M8** | A second map, and the door into it | Split out of M7: see the note on the new area above |

The boss is last because it needs the most from the rest: an achievement worth showing off (M5's
cosmetics), and somewhere to unlock (M6's editor, which is how the new area gets drawn). Building it
first would mean building all three at once.

Lesson numbering is provisional — roughly **A30–A38**, three or four lessons per milestone, and each
one written *after* its code, from `FAILURES.md`, exactly as the build order in `DESIGN.md` insists.

---

## Open questions

These change what gets built. My recommendation is given for each, so the plan is usable either way.

*(All six were answered by "implement now", which took the recommendation in each case. They are
kept here as the record of what was decided and why.)*

1. **Aniki's moves: seeded dice, or Flint's memory?** I recommend the seeded dice — identical in every
   browser, impossible to be ahead of, and it removes the whole class of "we disagree about what he
   played". Flint's memory in a five-player fight either has to pick one player to learn from, or
   needs every move delivered to everybody before he chooses, which is where the disagreements come
   from. If you want him adaptive, the honest version is: he leans against **the moves he beat last
   round**, and we accept that two screens can occasionally show different fights.
2. **Solo Aniki.** Ten lives against your three, alone, is a long fight to lose. Scale his lives to how
   many people are standing near him, or leave it hard and make him a thing you gather friends for?
   I lean towards scaling, with the numbers in `data/tuning.json` either way.
3. **"In conjunction with the AI chatbot"** — do you mean (a) the student uses Claude alongside the
   editor to write and fix map JSON, which is what this plan assumes and what costs nothing, or (b) a
   chat box *inside* the editor that talks to a model? (b) needs an API key, which a static page
   cannot keep, and would need a server — the first thing in this project that ever did.
4. **The new area** — is it a second map you walk into through a door, or a separate world you are
   moved to? The first needs `world.js` to hold more than one map and a tile that means "go here"; the
   second is simpler and less interesting. I lean towards the door.
5. **Do wins against Flint count towards chests?** I say yes — most players are alone most of the time.
   Say no and the reward loop is locked for them.
6. **Where do the lessons live?** These are course material; `izumo-io/planning/kakkoi-online-lessons.md`
   is where the track is written down, and this plan does not touch it.

---

## Deliberately not in this plan

- **Trading, gifting or a shop.** Anything that moves a cosmetic between players needs somebody to
  believe one browser over another, and there is nobody to do that.
- **Leaderboards.** Same reason, plus they are a list of children ranked in public.
- **Anything that makes a cosmetic change a fight.** The duel is rock, paper, scissors; the moment a
  hat wins rounds, the game is a different game.
- **Server-side anything.** Including for the boss, the editor, and the AI. The day this project needs
  a server is a day that deserves its own decision, not a footnote in a feature plan.
