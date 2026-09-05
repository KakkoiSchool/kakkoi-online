# Open issues

Known problems in the live game, written down so they are not rediscovered from
scratch. Newest first. When one is fixed, move it to `FAILURES.md` with what the
cause turned out to be — that file is lesson material, this one is a to-do list.

---

## 1. The game makes a phone hot while you are playing

**Reported by:** Cyril, 2026-08-17, playing on a phone.
**Status:** OPEN. Four contributing causes now fixed (relay storm, background
drain, frame rate, redraw cost), plus a fifth below — the idle position
broadcast. Two of the three "where to look next" suspects have since been
**measured and ruled out**, which is written up below so nobody spends an
evening on them again. This issue stays open until confirmed on a real phone:
the fixes are reasoned about, read back, and in one case measured in a desktop
browser, but none of them has been measured on a device.

### What is known

- It happens with the game in the foreground and being played, so it is not only
  the background-drain case.
- The canvas is **not** oversized: on a 390x780 phone at `devicePixelRatio: 3` the
  backing store measures 390x780, i.e. 304,200 pixels, almost exactly the same as
  the old fixed 640x480 (307,200). Making the canvas fill the screen did **not**
  multiply the pixel count. This was measured, not assumed.
- Frame-rate measurements taken through an automated browser are worthless here:
  a tab that is not visible throttles `requestAnimationFrame` to about 1 fps, which
  is what a naive measurement returns. **Any timing evidence must come from a real
  device with the screen on.**

### Fixed, and ruled out as the whole story

- **A relay retry storm.** `nos.lol` began demanding proof-of-work to publish, so
  every announcement was rejected and retried, forever, logging
  `relay failure ... pow: 28 bits needed`. Removed in `991edf7`. This alone would
  heat a device, but the owner reports heat persisting, so it was not the only
  cause, and anyone whose service worker still holds an old cache is still
  running the old relay list.
- **A backgrounded tab cost full price.** `visibilitychange` only flushed the save:
  the render loop and the 10 Hz position broadcast both kept running with the
  screen off. Now the loop pauses and the broadcast sleeps while hidden, without
  leaving the room. This is a real battery fix but does not explain foreground heat.

### Fixed just now, not yet proven on a device

- **Frame rate.** Nothing capped it, so a 120Hz phone ran update+render at 120fps
  instead of the 60 a normal screen gets, doubling the assumed work again on top
  of that. `src/loop.js` now skips update and render for any `requestAnimationFrame`
  callback that lands less than about 33ms after the last one that did real work,
  which caps the game at 30fps everywhere. `dt` is still measured between the
  frames that actually ran and still clamped at 0.25, so movement speed is
  unaffected.
- **Redraw cost per frame.** `drawMap` re-issued close to 650 `drawImage` calls
  every single frame, whether or not the camera had moved, on top of running
  twice too often, that is the same picture painted twice as expensive as it
  needed to be. `src/render.js` now paints the tile map to an offscreen canvas
  only when the camera position or the canvas size actually changed, and blits it
  back with one `drawImage` otherwise. Combined with the frame cap above, the tile
  map should now redraw at most 30 times a second, and typically far less than
  that while standing still.

### Fixed just now, and measured — but in a desktop browser, not on a phone

- **A standing player still shouted ten times a second.** `net.js` broadcast a
  position every `posHz` tick whether or not anything had moved, to every peer
  in the mesh. In this game people stand still constantly — reading the phrase
  bar, deciding who to fight, and above all *the entire length of a duel*, where
  `main.js` refuses to move the player at all and the position therefore cannot
  change. Every one of those was an identical packet, encoded, chunked and
  pushed down a data channel at both ends, forever.

  `sendPosition` now skips a packet identical to the last one, and repeats it
  once every `posKeepaliveMs` (2s) so a lost packet still heals and a late
  arrival still converges. A packet aimed at one peer — the greeting pair sent
  when somebody joins — always goes; they have never heard from us.

  Measured in Chromium, standing still: **24 of 25 packets suppressed over two
  and a half seconds.** `net.saved.positions` counts them, live, in the console.

### Ruled out, with numbers, so nobody looks here again

- **The relays are NOT the heat.** They do stay busy after connection — trystero
  re-announces to every relay every 5.333s, forever, and each announcement is a
  Schnorr signature over secp256k1 in pure JavaScript BigInt arithmetic, which
  looks exactly like the sort of thing that cooks a phone. It is not. Measured
  by driving the vendored bundle directly: **2.2 ms per announcement**, so six
  relays every 5.333s is **2.4 ms of main-thread work per second, 0.2% of one
  core** on a desktop. Even at ten times slower on a phone it is 2.5%.
  Nothing reconnects in a loop; the socket retry backs off and doubles.
- **The interpolation buffer cannot grow without bound.** `HISTORY` is 12, the
  push is followed by a `shift` past that, and `prune()` drops everything walked
  past on every frame while always keeping the sample being interpolated from.
  Read, not guessed. There is nothing here.

### Where to look next, roughly in order

1. **A real device.** Everything above is now either reasoned about or measured
   on a desktop, and the one measurement that matters has never been taken. This
   is the top of the list and has been for a while.
2. **Per-frame allocation.** The `cast` array in `main.js`'s `render()` and
   `nearestTarget()`'s `challengeable()` list still allocate fresh arrays and
   objects every frame. Not touched, deliberately: the frame cap already halves
   how often they run, and pooling them would add real complexity to lesson code
   for an unmeasured gain. Worth revisiting only if the device measurement still
   shows heat.
3. **The canvas itself.** Untouched and unmeasured: every frame clears the whole
   canvas and blits the whole tile layer back over it, which on a 390x780 phone
   is about 600,000 pixel writes a frame at 30fps whatever is happening. The
   clear is only needed where the map does not reach the edge of the canvas.
   Cheap to try, and nobody has.

### How to reproduce properly

A real phone, screen on, game in the foreground, ideally with a second real player
present. Watch battery use per app, and profile with the phone attached to desktop
devtools. **Do not** trust numbers from an automated or backgrounded browser.
**This has not been done yet for the frame-cap, offscreen-map or idle-broadcast
fixes above.** Until it is, treat them as plausible causes addressed, not
confirmed fixes.

Before doing it, open the ⚙ menu and read the bottom line on both devices. It
says which cached build is answering. Measuring the old build is the way to
spend an evening proving that a fix which shipped three weeks ago does not
work — see issue #3.

---

## 2. Two real players on two devices do not see each other

**Reported by:** Cyril, 2026-08-17, one browser at each end.
**Status:** OPEN, partially explained — and the check that would settle it no
longer needs a laptop. See "the check that would settle it" at the bottom.

### What is known

- Peer discovery **does** work from this machine: a second browser context on the
  live site reported *"3 here — you and 2 others"*.
- All six relays answer a real subscription, not merely open a socket. Verified
  2026-08-17.

### Ruled out

- **A dead relay.** `nos.lol` was silently refusing every announcement (see issue 1)
  and is gone. The list is now six relays, each verified to answer.

### Still possible, and worth eliminating in this order

1. **A stale service worker.** This is the strongest candidate. A device that has
   the game installed, or has simply visited before, can keep serving an old cached
   build — including the old relay list with the dead relay in it. `caches.keys()`
   on the live site returned **both `kakkoi-online-v2` and `kakkoi-online-v5`** at
   one point, so old caches have survived an activate at least once. **Before
   testing, hard-reload or use a private window on both devices**, and confirm both
   are on the current cache version.
2. **Same-browser testing.** Since session ownership landed, two windows of the
   same browser are deliberately *not* two players: the newest takes the game and
   the older goes inactive. Two separate devices are unaffected, but this makes a
   quick local check impossible and is easy to mistake for a bug.
3. **The network.** Some home and school networks will not let two computers reach
   each other directly. This is real, it is called out in lesson A12, and there is
   no fix without a TURN server. Test on two different networks (one on mobile
   data) to eliminate it.

### The check that would settle it

**The last line of the ⚙ menu now answers most of this, on the phone itself.**
It says three things:

    Offline copy: kakkoi-online-v20. Relays: 6 of 6 answering.
    This browser is u84m40tU to everybody else.

- **The build.** Asked of the service worker that is genuinely serving that
  page, not read out of the source — so it reports what the *cache* is answering
  with, which is the whole point. If the two phones do not say the same version,
  stop: that is candidate 1 above and nothing else can be concluded until both
  are current. A hard reload, or a private window, and read it again.
- **The relays.** If this says 0 of 6 on a device, nobody can find that device
  and the answer is its network, not the game.
- **The peer id.** Two devices showing the *same* id are the same browser
  profile, which is candidate 2 and is not two players.

If both phones are on the current build, both say 6 of 6, both show different
ids, and neither sees the other — then it is candidate 3, the network, and the
next step is one of them on mobile data. That is the case with no fix in it
without a TURN server, and it is the one worth being sure about before building
anything.

The console is still where the detail is: whether the relay subscriptions
succeed and whether any ICE candidates are exchanged. But it is no longer where
the first three questions have to be asked.

---

## 3. Old service worker caches are not always deleted

**Status:** EXPLAINED, and the thing that made it matter is fixed. Left open
only until somebody confirms on the live site that the ⚙ menu says one cache.

### What it turned out to be

**"Two caches" was never evidence of a fault.** `install` creates the new cache
and fills it; `activate` — which is what deletes the old ones — does not run
until that has finished. Between those two moments both are on disk and both are
supposed to be. Close the tab mid-install and they stay that way until the next
visit finishes the job. `kakkoi-online-v2` sitting beside `-v5` is exactly what
an install that had not finished looks like.

That was worth an hour to work out and it is now written into `sw.js` itself,
where the next person will find it.

### What was actually wrong, found while looking

- **`activate` deleted every cache on the origin, not only ours.** Fine on
  `online.kakkoi.dev`, wrong everywhere else: the README asks people to fork
  this and deploy to `their-name.github.io/kakkoi-online/`, and on that origin
  every other thing they have ever put on GitHub Pages is a neighbour with a
  cache of its own. Installing this game emptied their other PWAs. The sweep is
  now limited to the `kakkoi-online-` family.
- **A precache miss was warned about and then forgotten.** One file that 404s
  must not take the whole install down — that is right and stays — but the game
  then called itself installed with half a cache and only disagreed later, on a
  train. The names now go into a receipt in the cache, and the ⚙ menu reads it
  back: *"2 of 118 files missing"*.
- **A new worker could take over a running page.** `skipWaiting()` and
  `clients.claim()` mean the worker serving the page can change while the page
  is open — and the modules already loaded came from the old cache. A page
  running two builds at once is a fine way to spend an afternoon. It now says so
  in the status line and leaves the reload to the player, rather than restarting
  the game under somebody mid-duel.

### What is still worth doing

Open the ⚙ menu on the live site after a deploy and read the last line. It says
how many old caches are still on disk. One extra, briefly, is an install in
progress. Several, persistently, would mean this issue is real after all — and
now there is a way to tell without a cable.
