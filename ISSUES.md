# Open issues

Known problems in the live game, written down so they are not rediscovered from
scratch. Newest first. When one is fixed, move it to `FAILURES.md` with what the
cause turned out to be — that file is lesson material, this one is a to-do list.

---

## 1. The game makes a phone hot while you are playing

**Reported by:** Cyril, 2026-08-17, playing on a phone.
**Status:** OPEN. Two more contributing causes fixed below (frame rate, redraw
cost), on top of the relay storm and background-drain fixes already logged. This
issue stays open until confirmed on a real phone: none of these fixes have been
measured on a device yet, only reasoned about and read back.

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

### Where to look next, roughly in order

1. **WebRTC.** A full mesh at `posHz` 10 with several peers, plus whatever the
   relays are doing after connection. Check whether relay sockets stay busy once
   peers are connected, and whether anything reconnects in a loop.
2. **The interpolation buffer** in `net.js`, confirm old snapshots are discarded
   and the per-peer history cannot grow without bound.
3. **Per-frame allocation.** The `cast` array in `main.js`'s `render()` and
   `nearestTarget()`'s `challengeable()` list still allocate fresh arrays and
   objects every frame. Not touched in this pass: the frame cap already halves
   how often they run, and pooling them would add real complexity to lesson code
   for an unmeasured gain. Worth revisiting only if the device measurement below
   still shows heat.

### How to reproduce properly

A real phone, screen on, game in the foreground, ideally with a second real player
present. Watch battery use per app, and profile with the phone attached to desktop
devtools. **Do not** trust numbers from an automated or backgrounded browser.
**This has not been done yet for the frame-cap and offscreen-map fixes above.**
Until it is, treat them as a plausible cause addressed, not a confirmed fix.

---

## 2. Two real players on two devices do not see each other

**Reported by:** Cyril, 2026-08-17, one browser at each end.
**Status:** OPEN, partially explained.

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

Both devices on the current build, on different networks, at the same moment, with
the console open on each. If neither shows a peer, capture whether the relay
subscriptions succeed and whether any ICE candidates are exchanged.

---

## 3. Old service worker caches are not always deleted

**Status:** OPEN, low severity, but it makes every other bug harder to diagnose.

`sw.js` deletes every cache but the current one on `activate`, and yet
`kakkoi-online-v2` was observed alongside `kakkoi-online-v5` on the live site.
Either activate had not run yet for that client, or the deletion is not covering
every case. Worth confirming, because a stale cache is exactly how a fix appears
to have failed — which is the trap lesson A18 warns students about.
