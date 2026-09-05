import * as F from './rules_frozen.mjs'; import * as N from './rules.js';
import { chooseAction as cf } from './bot_frozen.mjs'; import { chooseAction as cn } from './bot.js';
const perft = (R, p, d) => { const a = R.legalActions(p); if (d === 1) return a.length; let t = 0; for (const x of a) t += perft(R, R.applyAction(p, x), d - 1); return t; };
console.log('frozen perft 4/5:', perft(F, F.createInitialPosition(), 4), perft(F, F.createInitialPosition(), 5));
let seed = 31; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let mism = 0, pos = 0; const samples = [];
for (let g = 0; g < 150; g++) { let a = N.createInitialPosition(), b = F.createInitialPosition();
  for (let ply = 0; ply < 100; ply++) { pos++; if (N.positionKey(a) !== F.positionKey(b) || JSON.stringify(N.legalActions(a).map(N.actionKey)) !== JSON.stringify(F.legalActions(b).map(F.actionKey))) mism++;
    const acts = N.legalActions(a); if (!acts.length || N.getResult(a)) break; if (ply % 9 === 6 && samples.length < 12) samples.push([a, b]);
    const pick = acts[Math.floor(rnd() * acts.length)]; a = N.applyAction(a, pick); b = F.applyAction(b, pick); } }
console.log({ positions: pos, mismatches: mism });
let tn = 0, tf = 0, same = 0; for (const [a, b] of samples) { let t = performance.now(); const x = cn(a, { depth: 4 }); tn += performance.now() - t; t = performance.now(); const y = cf(b, { depth: 4 }); tf += performance.now() - t; if (N.actionKey(x) === F.actionKey(y)) same++; }
console.log({ depth4Positions: samples.length, sameMove: same, liveMs: tn.toFixed(0), frozenSharedMs: tf.toFixed(0), speedup: (tn / tf).toFixed(2) });
// enforcement: a mutation now throws in strict mode
try { const p = F.createInitialPosition(); const q = F.applyAction(p, { type: 'place-king', to: 13 }); q.board[13].piece = 'rook'; console.log('mutation silently allowed'); } catch (e) { console.log('mutation throws:', e.constructor.name, e.message.slice(0, 60)); }
