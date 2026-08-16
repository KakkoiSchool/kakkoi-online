# Kakkoi Online

A tiny top-down multiplayer game that runs with **no server at all**. Your browser talks straight to
the other players' browsers. Hosting is a static page, so it costs nothing to run, forever.

**Play:** https://online.kakkoi.dev
**Learn to build it:** lessons A09–A29 at https://school.kakkoi.dev

You pick a name and one of six monsters, and you are in a dungeon. You walk around it, you see anyone
else who has the page open walking around it too, and you talk to them in six set phrases. Walk up to
one of them and a **Challenge** button appears: a duel is **rock, paper, scissors**, first to three
rounds. Rock beats scissors, scissors beats paper, paper beats rock. Neither player can peek — both sides
send a fingerprint of their move before either sends the move, and a move that does not match its
fingerprint is caught and the duel ends there.

Nobody else online? **Flint** is always standing in the plaza, and he fights exactly the way a person
does — he even remembers what you like playing and leans against it.

## Run it

**Plain JavaScript, no build step.** There is nothing to install and nothing to compile — the files
in this repo are exactly the files the browser runs.

1. Open this folder in your editor.
2. Install the **Live Server** extension.
3. Right-click `index.html` → *Open with Live Server*.

That's the whole toolchain. From a terminal, `make dev` (`python3 -m http.server 8000`) does the
same thing without the auto-reload.

**Controls.** Arrow keys or WASD to walk, or touch the floor — the whole game works on a phone.
`F` challenges whoever you are standing next to. Sound is **off** until you press the Sound button.

`file://` will not work, on purpose — browsers refuse modules and `crypto.subtle` without a real
origin (lesson A10), and the duel needs `crypto.subtle`. `http://localhost` is fine, and so is the
live https site.

**To be two players on one machine**, open the page on **two different origins** — say
`localhost:8000` and `127.0.0.1:8001`. Two tabs on the *same* origin share one `localStorage`, so
they are the same character; the newest of them takes the game over and the older one pauses with a
card explaining why. See "One window at a time" in `DESIGN.md`.

**To change your name or your animal**, press **Start over** next to the sound buttons. It asks
first, then puts you back at the name screen and the entrance.

**Tests** are a web page: open `tests/rules.test.html` through the same server and read the
PASS/FAIL rows. No test runner, no npm.

## How it fits together

```
index.html          canvas + Basecoat UI shell
src/main.js         boot and wiring only — everything else is one idea per file
src/loop.js         the requestAnimationFrame loop
src/net.js          the only file that knows trystero exists
src/duel.js         the challenge state machine, the rounds, and commit–reveal
src/npc.js          Flint — answers the same questions a peer does, so duel.js cannot tell
src/battle/rules.js PURE rules: the rock-paper-scissors triangle — imports nothing, fully testable
tests/*.test.html   tests you open in a browser
demos/NN-name/      one standalone demo per lesson: open its index.html and look at it
data/*.json         every balance number, the monsters, the map
vendor/             pinned third-party files (see vendor/README.md)
audio/              CC0 sound (see audio/README.md)
```

Three rules that shape the codebase:

- **No build step, ever.** What is in git is what runs in the browser. If you cannot open a file
  and read what actually executes, it does not belong here.
- **`src/battle/rules.js` imports nothing.** Both players in a duel must compute identical results
  from it, and it must be testable without a network.
- **Numbers live in `data/`, not in code.** Balancing is an edit, never a rewrite.

## No server means

- **Nobody is in charge.** Positions and stats are self-reported, so cheating them is easy and we
  don't mind. What *is* protected is the duel: both players commit a hash of their move before either
  reveals, so neither can peek and change their mind.
- **No moderation is possible** — no bans, no logs, no reports. So chat is **preset phrases only**.
  Abuse is designed out rather than policed.
- **Nothing is stored anywhere.** Your character lives in your own browser, in `localStorage`. Clear
  your browser data and it is gone; there is nowhere else it could have been kept.
- **Some networks can't connect at all** (roughly 8–15%, strict NAT). That's not your bug.

## Fork it

Fork, deploy to `your-name.github.io/kakkoi-online/`, and **you can still play with everyone else** —
peers find each other through a public relay, not through this domain. Your copy, same world.

## Plan and docs

Design rationale, technical spec, lesson track and asset provenance live in the school repo:
`izumo-io/planning/` — `kakkoi-online-design.md`, `kakkoi-online-trd.md`, `kakkoi-online-lessons.md`,
`kakkoi-online-sources.md`. See also `DESIGN.md` here.

## Licence

Code MIT. Art and audio are CC0 (see `CREDITS.md`).
