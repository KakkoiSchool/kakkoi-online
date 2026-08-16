# audio/ — CC0 sound

No synthesis, no audio library: plain `HTMLAudioElement`. Files only.

Everything here is **CC0** and was fetched with `curl` on **2026-08-16**. The licence text for the
sound effects is copied into `sfx-512-LICENSE.txt`; the music track's licence is stated on its
OpenGameArt page (linked below).

## Vendored files

| File | Length | Size | Original file | Pack / source | Licence |
|---|---|---|---|---|---|
| `step-soft.wav` | 0.273 s | 16 kB | `Audio/footstep05.ogg` | RPG Audio, Kenney | CC0 |
| `step.wav` | 0.049 s | 4.4 kB | `Movement/Footsteps/sfx_movement_footsteps1a.wav` | 512 Sound Effects (8-bit style), Juhani Junkala | CC0 |
| `strike.wav` | 0.111 s | 9.7 kB | `Weapons/Melee/sfx_wpn_sword1.wav` | same | CC0 |
| `block.wav` | 0.046 s | 4.2 kB | `General Sounds/Impacts/sfx_sounds_impact3.wav` | same | CC0 |
| `charge.wav` | 0.188 s | 16 kB | `General Sounds/Positive Sounds/sfx_sounds_powerup15.wav` | same | CC0 |
| `ping.wav` | 0.039 s | 3.6 kB | `General Sounds/Menu Sounds/sfx_menu_move1.wav` | same | CC0 |
| `win.wav` | 0.280 s | 24 kB | `General Sounds/Fanfares/sfx_sounds_fanfare2.wav` | same | CC0 |
| `music-loop.mp3` | 46.8 s | 637 kB | `happy_adveture.mp3` | Happy Adventure (Loop), TinyWorlds | CC0 |

Total **~715 kB**, inside the 1–2 MB budget.

`step.wav` is **no longer used by the game** — it is kept only because `demos/17-sound/` loads it by
name and the demos are lesson material that must not be edited. The game plays `step-soft.wav`.

### The footstep, replaced 2026-08-16

The owner played the game and said the footstep was annoying, which it was: an 8-bit blip at the same
volume as everything else, firing every 26 pixels — about six times a second at walking speed. Three
things changed, and all three matter:

- **A softer sample.** Kenney's `footstep05.ogg` from RPG Audio: a recorded, muted step on dirt, one
  clean transient with a short decay, not a synthesised click.
- **Quieter than the rest.** `stepVolume: 0.22` in `data/tuning.json`, against `sfxVolume: 0.6` for
  everything else. A sound you hear two hundred times a minute must not be as loud as one you hear
  when you win.
- **A walking pace, not a frame rate.** `stepIntervalMs: 400` — two and a half steps a second, timed,
  not measured in pixels. A footstep is a leg moving, and legs move at a pace.

### Where each came from

- **Sound effects** — page: https://opengameart.org/content/512-sound-effects-8-bit-style
  (author *SubspaceAudio* / Juhani Junkala; the page states `License(s): CC0`).
  Zip: `https://opengameart.org/sites/default/files/The%20Essential%20Retro%20Video%20Game%20Sound%20Effects%20Collection%20%5B512%20sounds%5D.zip`
  — 20.6 MB, 512 WAVs, 44100 Hz / 16-bit / mono. The pack's own `INFO.txt` also says CC0; that text
  is kept in `sfx-512-LICENSE.txt`.
- **Footstep** — page: https://kenney.nl/assets/rpg-audio (author *Kenney Vleugels*; the page's
  **License** row reads "Creative Commons CC0", and the zip's own `License.txt` reads
  "License (Creative Commons Zero, CC0)" — that file is kept here as
  `kenney-rpg-audio-LICENSE.txt`).
  Zip: `https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip`
  — 1.0 MB, 52 OGGs. Take `Audio/footstep05.ogg` and decode it:
  `afconvert -f WAVE -d LEI16@22050 -c 1 footstep05.ogg step-soft.wav`. Nothing else was done to it;
  the volume lives in `data/tuning.json`, not in the file.
- **Music** — page: https://opengameart.org/content/happy-adventure-loop
  (author *TinyWorlds*; the page states `License(s): CC0`).
  File: `https://opengameart.org/sites/default/files/happy_adveture.mp3`

## Why WAV and MP3, not OGG

The earlier plan said "ship `.ogg` with an `.mp3` fallback". That is not what is here, for two
reasons:

1. **No encoder on this machine.** There is no `ffmpeg`, `sox` or `oggenc`, so an `.ogg` cannot be
   turned into an `.mp3` locally. Whatever format a source ships in is the format we get.
2. **Ogg Vorbis is the one format that is not safe everywhere.** WAV and MP3 play in every browser
   including Safari and iOS; Ogg Vorbis support in Safari is patchy. Choosing sources that already
   ship WAV/MP3 removes the problem and removes the need for two copies of every file.

WAV is only viable because these effects are *tiny* — the longest is 0.28 s, and a WAV of a 0.05 s
footstep is 4 kB. Do not add a long WAV here; use MP3 for anything over a second or two.

Kenney's audio packs (RPG Audio, UI Audio, Music Jingles) are CC0 and **are** downloadable — the
exact zip URLs are in `izumo-io/planning/kakkoi-online-sources.md` — but they ship `.ogg` only, so
they were not used. Kenney still has no background-music pack, only short jingles; loops come from
OpenGameArt.

## Rules

Audio is **off by default** — ten unmuted laptops in one classroom is chaos. Lazy-load after first
paint. Browsers refuse to play sound until the page has had a real click or key press, so the first
sound must be triggered by something the player did.

## Verified

2026-08-16, in a real Chromium over `python3 -m http.server`: all seven files reached
`loadedmetadata` with the durations above, and all seven actually played after a click — the six
effects ran to `ended`, and `music-loop.mp3` was still playing when the check stopped it. No failed
network requests.
