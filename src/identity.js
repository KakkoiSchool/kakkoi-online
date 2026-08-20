/**
 * Who you are: a random id that lasts, a name you typed, and the monster you
 * picked.
 *
 * The id is not a login. It exists so that when other people arrive in stage
 * two, two tabs of the same game are two different players — and so a peer can
 * tell "the same person moved" from "someone new appeared".
 */
import { loadSave, writeSave, loadSafetySeen } from './save.js';

export const MAX_NAME = 12;

export function makeId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Old browsers, and file:// in some of them. Good enough for a room key.
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Names are shown to strangers, so they are trimmed, length-capped and
 * stripped of anything that is not a plain letter, digit, space, - or _.
 * Nothing here is a safety system; it just stops a name breaking the layout.
 */
export function cleanName(raw) {
  return String(raw ?? '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

export async function loadMonsters(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`monsters ${url}: ${response.status}`);
  const data = await response.json();
  const monsters = Array.isArray(data.monsters) ? data.monsters : [];
  if (!monsters.length) throw new Error('monsters file has no monsters in it');
  return monsters;
}

/**
 * Build the identity from the save, if the save is usable. A save that names a
 * monster this build no longer has is treated as no choice at all: better to
 * ask again than to draw a picture that does not exist.
 */
export function createIdentity(monsters) {
  const saved = loadSave();
  const known = saved && monsters.some((m) => m.id === saved.monster);

  const identity = {
    id: saved?.id || makeId(),
    name: saved ? cleanName(saved.name) : '',
    monster: known ? saved.monster : -1,
    /** Where the save says we were, or null for "put me at the spawn". */
    position: saved && known ? { x: saved.x, y: saved.y } : null,
    /**
     * Has this player read the card about other people? Shown once, then never.
     * It is kept in its own key so that "Start over" does not bring it back;
     * an older save that has it inside still counts.
     */
    safetySeen: loadSafetySeen() || saved?.safety === true,
    /**
     * What we are wearing, as a look id from `data/cosmetics.json`, or 0 for
     * none. It is NOT read from the save here: chests live in their own key,
     * beside the safety card, because they belong to the person rather than to
     * the character — `main.js` sets this from `wins.js` once that is loaded.
     */
    look: 0,

    get chosen() { return identity.monster >= 0 && identity.name.length > 0; },
    get creature() { return monsters.find((m) => m.id === identity.monster) || monsters[0]; },

    setName(raw) { identity.name = cleanName(raw); },
    setMonster(id) { identity.monster = id; },
    setLook(id) { identity.look = Number.isInteger(id) && id > 0 ? id : 0; },
  };

  if (saved && !known) console.warn('save named monster', saved.monster, '— not in this build, asking again');
  return identity;
}

/** One place that knows the shape of what gets written down. */
export function persist(identity, box) {
  return writeSave({
    id: identity.id,
    name: identity.name,
    monster: identity.monster,
    x: box.x,
    y: box.y,
    safety: identity.safetySeen,
  });
}
