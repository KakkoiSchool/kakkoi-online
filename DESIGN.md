# Design pointers

The full plan lives in the school repo, `izumo-io/planning/`:

| Doc | Contents |
|---|---|
| `p2p-mmo.md` | Why every decision is what it is. 42-row decision log, six recorded reversals |
| `p2p-mmo-trd.md` | What to build: data model, network protocol, battle rules, milestones, tests |
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
