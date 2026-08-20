/**
 * Someone to fight when nobody else is here (lesson A21).
 *
 * Most of the time this game has exactly one person in it, so it has to be worth
 * opening on your own. Flint stands in the plaza; you walk up to him and
 * challenge him exactly the way you challenge a person.
 *
 * **The whole point is the shape.** Flint answers the same questions a peer
 * answers, in the same order, over the same little `link` object — ask, reply,
 * move — so `src/duel.js` has no idea he is not a person and contains no branch
 * for him. Everything the fight knows how to do, it does with him: the
 * ten-second timeout, the three round wins.
 *
 * He does not roll a dice, either. He remembers your last few moves and leans
 * against your favourite, with a dice roll about a third of the time so he never
 * becomes predictable himself. Without that floor you can beat him every round
 * by hand, which is worse than random.
 */
import { MOVES, beats } from './battle/rules.js';

/** Short, because it goes in a nameplate over his head. */
export const NAME = 'Flint';

/** Which of the six he is (an `id` in data/monsters.json), and where he stands. */
export const NPC_MONSTER = 1;
export const NPC_TILE = { col: 27, row: 20 };

/**
 * And his big brother, who is only here for the first ten minutes of an hour.
 *
 * The same animal, drawn at twice the size and in the hot colours of the
 * `Ember` look — a big brother should read as a big brother from across the
 * plaza, before anybody has read a word. He needs no code of his own here
 * because he does not duel: `src/boss.js` is a different fight with the same
 * three moves, and this is only where he stands.
 */
export const ANIKI = {
  id: 'npc:aniki',
  name: 'Aniki',
  monster: NPC_MONSTER,
  tile: { col: 21, row: 20 },
  /** A look id from data/cosmetics.json, borrowed for its recoloured sheet. */
  look: 3,
  /** Twice the world's own scale: he is drawn bigger, and stands the same. */
  size: 2,
};

/** Aniki's body, in world pixels. Made in main.js, which knows the world. */
export function anikiBody(world, monsters, box = { w: 20, h: 14 }) {
  const monster = monsters.find((m) => m.id === ANIKI.monster) || monsters[0];
  const t = world.tile;
  return {
    x: ANIKI.tile.col * t + (t - box.w) / 2,
    y: ANIKI.tile.row * t + (t - box.h) - 4,
    w: box.w,
    h: box.h,
    cell: monster.cell,
    moving: false,
    walked: 0,
    facing: 1,
  };
}

export function createNpc({ monsters, world, tuning = {}, box = { w: 20, h: 14 } }) {
  const monster = monsters.find((m) => m.id === NPC_MONSTER) || monsters[0];
  const t = world.tile;

  /** He stands still, so his body is the same shape as a player's and never moves. */
  const body = {
    x: NPC_TILE.col * t + (t - box.w) / 2,
    y: NPC_TILE.row * t + (t - box.h) - 4,
    w: box.w,
    h: box.h,
    cell: monster.cell,
    moving: false,
    walked: 0,
    /** He never walks, so he never turns. He is drawn looking right, like the art. */
    facing: 1,
  };

  const memory = int(tuning.npcMemory, 5);
  const diceChance = num(tuning.npcDiceChance, 0.34);
  const think = Array.isArray(tuning.npcThinkMs) ? tuning.npcThinkMs : [450, 900];

  /** Your last few moves, oldest first. Survives between duels: he is learning you. */
  const seen = [];

  function remember(move) {
    seen.push(move);
    while (seen.length > memory) seen.shift();
  }

  const dice = () => MOVES[Math.floor(Math.random() * MOVES.length)];

  function chooseMove() {
    if (seen.length === 0 || Math.random() < diceChance) return dice();
    let favourite = seen[0];
    const count = (m) => seen.filter((s) => s === m).length;
    for (const move of MOVES) if (count(move) > count(favourite)) favourite = move;
    return MOVES.find((move) => beats(move) === favourite) || dice();
  }

  const pause = () => think[0] + Math.random() * Math.max(0, think[1] - think[0]);

  /**
   * One duel's worth of conversation. Same five fields a network link has, so
   * the fight cannot tell them apart.
   */
  function link() {
    const handlers = [];
    let open = true;
    const pending = new Set();

    /** He answers after a beat, the way a person on the other end of a wire does. */
    const later = (fn) => {
      const id = setTimeout(() => { pending.delete(id); if (open) fn(); }, pause());
      pending.add(id);
    };

    const say = (kind, payload) => { for (const fn of handlers) fn(kind, payload); };

    return {
      id: `npc:${monster.id}`,
      name: NAME,
      monster: monster.id,

      send(kind, payload) {
        if (!open) return;
        if (kind === 'ask') return later(() => say('reply', { yes: true }));

        if (kind === 'move') {
          // Your move is in `payload`, and he is not allowed to look at it until
          // he has chosen his own. Nothing but these two lines in this order
          // enforces that — no cryptography, only code you can read. He is the
          // one player here whose source is not in the other player's hands, so
          // reading it is the whole guarantee. What you played is remembered
          // afterwards, and leans his next choice.
          const move = chooseMove();
          remember(payload.move);
          return later(() => say('move', { round: payload.round, move }));
        }
        // 'quit' — nothing to do; the duel closes the link straight after.
      },

      onMessage(fn) { handlers.push(fn); },
      onClose() { /* Flint is always in the plaza. He never leaves. */ },
      close() {
        open = false;
        for (const id of pending) clearTimeout(id);
        pending.clear();
      },
    };
  }

  return {
    id: `npc:${monster.id}`,
    name: NAME,
    monster: monster.id,
    body,
    link,
    /** For checking from the console. */
    get seen() { return [...seen]; },
  };
}

function int(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}
