# Open issues

Known problems in the live game, written down so they are not rediscovered from
scratch. Newest first. When one is fixed, move it to `FAILURES.md` with what the
cause turned out to be — that file is lesson material, this one is a to-do list.

---

## 1. The game makes a phone hot while you are playing

**Reported by:** Cyril, 2026-08-17, playing on a phone.
**Status:** OPEN. Not diagnosed. One contributing cause fixed (see below), but the
owner confirms it still happens **during normal play**, not only in the background.

### What is known

- It happens with the game in the foreground and being played, so it is not only
  the background-drain case.
- The canvas is **not** oversized: on a 390x780 phone at `devicePixelRatio: 3` the
  backing store measures 390x780, i.e. 304,200 pixels — almost exactly the same as
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
  cause — and anyone whose service worker still holds an old cache is still
  running the old relay list.
- **A backgrounded tab cost full price.** `visibilitychange` only flushed the save:
  the render loop and the 10 Hz position broadcast both kept running with the
  screen off. Now the loop pauses and the broadcast sleeps while hidden, without
  leaving the room. This is a real battery fix but does not explain foreground heat.

### Where to look next, roughly in order

1. **Redraw cost per frame.** The world is redrawn from scratch 60 times a second
   whether or not anything moved. Count the `drawImage` calls in one frame on a
   real phone. A tile map that only changes when the camera moves is a candidate
   for drawing to an offscreen canvas once and blitting it.
2. **Frame rate.** Nothing caps it. A top-down pixel game at 30 fps would be
   indistinguishable and halve the work. Cheap to try, easy to revert.
3. **WebRTC.** A full mesh at `posHz` 10 with several peers, plus whatever the
   relays are doing after connection. Check whether relay sockets stay busy once
   peers are connected, and whether anything reconnects in a loop.
4. **The interpolation buffer** in `net.js` — confirm old snapshots are discarded
   and the per-peer history cannot grow without bound.

### How to reproduce properly

A real phone, screen on, game in the foreground, ideally with a second real player
present. Watch battery use per app, and profile with the phone attached to desktop
devtools. **Do not** trust numbers from an automated or backgrounded browser.

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
