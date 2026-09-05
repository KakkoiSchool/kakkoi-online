import { chooseAction } from './bot.js';
import { chooseAction as chooseNoCache } from './bot_nocache.mjs';
import { applyAction, legalActions, getResult, createInitialPosition, actionKey } from './rules.js';
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let checked = 0, differ = 0; const t0 = performance.now();
for (let g = 0; g < 12; g++) { let p = createInitialPosition();
  for (let ply = 0; ply < 30; ply++) { const acts = legalActions(p); if (!acts.length) break;
    if (p.phase === 'play' && ply % 6 === 4) { checked++;
      const a = chooseAction(p, { depth: 4 }), b = chooseNoCache(p, { depth: 4 });
      if (actionKey(a) !== actionKey(b)) { differ++; console.log('DIFF', `cached=${actionKey(a)}`, `exact=${actionKey(b)}`, 'at', p.turn, 'ply', ply); } }
    p = applyAction(p, acts[Math.floor(rnd() * acts.length)]); if (getResult(p)) break; } }
console.log({ depth: 4, checked, differ, seconds: ((performance.now() - t0) / 1000).toFixed(0) });
