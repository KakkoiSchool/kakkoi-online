import { chooseAction } from './bot.js';
import { applyAction, legalActions, getResult, createInitialPosition, createPosition } from './rules.js';
let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let p = createInitialPosition(); for (let i = 0; i < 12; i++) { const a = legalActions(p); p = applyAction(p, a[Math.floor(rnd() * a.length)]); }
const fresh = createPosition({ ...p, repetitions: {} });
const bloated = createPosition({ ...p, repetitions: Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`play|white|fake${i}|R|B`, 1])) });
const time = (pos) => { const t = performance.now(); chooseAction(pos, { depth: 4 }); return performance.now() - t; };
time(fresh); // warm
const a = time(fresh), b = time(bloated), c = time(fresh), d = time(bloated);
console.log({ emptyMapMs: ((a + c) / 2).toFixed(0), map150Ms: ((b + d) / 2).toFixed(0), ratio: ((b + d) / (a + c)).toFixed(2) });
