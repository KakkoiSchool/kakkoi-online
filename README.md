# Kakkoi Online

A tiny top-down multiplayer game that runs with **no server at all**. Your browser talks straight to
the other players' browsers. Hosting is a static page, so it costs nothing to run, forever.

**Play:** https://online.kakkoi.dev (once M0 lands)
**Learn to build it:** lessons A09–A29 at https://school.kakkoi.dev

You are a monster — fire, water or earth. You walk around, you talk in set phrases, and you duel
other players with three buttons: **Strike, Block, Charge**. Water beats fire, fire beats earth,
earth beats water.

## Run it

```bash
curl -fsSL https://bun.com/install | bash   # once
make dev        # bun ./index.html — TypeScript runs as-is, hot reload
make check      # bunx tsc --noEmit  ← Bun strips types WITHOUT checking them, so this is the gate
make test       # bun test
make build      # production bundle into dist/
```

Open `http://localhost:3000` **twice** to be two players. `file://` will not work, on purpose —
browsers refuse modules and crypto without a real origin (lesson A10).

## How it fits together

```
index.html          canvas + Basecoat UI shell (Bun's entrypoint)
src/loop.ts         fixed-timestep game loop
src/battle/rules.ts PURE rules: element chart, action triangle — imports nothing, fully testable
data/*.json         every balance number, the type chart, the monsters, the map
vendor/             pinned third-party files (see vendor/README.md)
audio/              CC0 sound (see audio/README.md)
```

Two rules that shape the codebase:

- **`src/battle/rules.ts` imports nothing.** Both players in a duel must compute identical results
  from it, and it must be testable without a network.
- **Numbers live in `data/`, not in code.** Balancing is an edit, never a rewrite.

## No server means

- **Nobody is in charge.** Positions and stats are self-reported, so cheating them is easy and we
  don't mind. What *is* protected is the duel: both players commit a hash of their move before either
  reveals, so neither can peek and change their mind.
- **No moderation is possible** — no bans, no logs, no reports. So chat is **preset phrases only**.
  Abuse is designed out rather than policed.
- **Nothing is stored anywhere.** Your character lives in your own browser. Clear your browser data
  and it's gone — export your save first.
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
