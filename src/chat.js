/**
 * Talking, safely (lesson A13).
 *
 * There is no text input anywhere in this game, and there is not going to be
 * one. Not a hidden one, not an option in a menu. The people reading this are
 * children, there is no server, and so there is nobody to moderate a message
 * and nobody to report a person to. A fixed list of phrases is the only kind of
 * talking this game can offer honestly.
 *
 * What goes over the wire is the phrase's NUMBER, never its words. Number 2
 * means "Let's fight!" because both pages have the same list. So the worst a
 * modified game can send is a number — and a number that is not a whole number
 * pointing at a phrase we actually have is dropped on arrival.
 */

/** The only things anyone can say. Keep it short: it has to fit under a thumb. */
export const PHRASES = ["Hi!", "Nice one!", "Let's fight!", "Follow me", "Good game", "Bye"];

/** How long a phrase stays above a head, in milliseconds. */
export const SHOW_FOR = 4000;

export function createChat({ net, self }) {
  // Register the action now, so the first phrase to arrive is not the thing
  // that creates the handler that was supposed to hear it.
  net.expect('say');

  net.onMessage((kind, payload, id) => {
    if (kind !== 'say') return;
    const peer = net.peer(id);
    if (!peer) { net.dropped.message++; return; }

    // Never believe what another computer sends you. It must be a whole number,
    // and it must point at a phrase this build actually has. Anything else —
    // a string, a decimal, null, 9999 — is counted and thrown away.
    if (!Number.isInteger(payload) || payload < 0 || payload >= PHRASES.length) {
      net.dropped.message++;
      return;
    }

    peer.saidIndex = payload;
    peer.said = PHRASES[payload];
    peer.saidUntil = performance.now() + SHOW_FOR;
  });

  return {
    PHRASES,

    /** Say phrase number `i`: send the number, and show it above our own head. */
    say(i) {
      if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length) return false;
      net.send('say', i);
      self.saidIndex = i;
      self.said = PHRASES[i];
      self.saidUntil = performance.now() + SHOW_FOR;
      return true;
    },

    /** Let a bubble time out. Peers' bubbles expire inside net.update(). */
    update(now) {
      if (self.saidUntil && self.saidUntil < now) {
        self.said = '';
        self.saidIndex = -1;
        self.saidUntil = 0;
      }
    },
  };
}
