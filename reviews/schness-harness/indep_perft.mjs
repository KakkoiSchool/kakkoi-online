// Independent generator written from the rules dialog only.
// Board: index = row*4+col, row 0 = rank 4 (Black home), row 3 = rank 1 (White home).
const N = 16;
const rc = (i) => [i >> 2, i & 3];
const idx = (r, c) => (r < 0 || r > 3 || c < 0 || c > 3) ? -1 : r * 4 + c;
const KSTEP = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const NSTEP = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const RDIR = [[-1,0],[1,0],[0,-1],[0,1]], BDIR = [[-1,-1],[-1,1],[1,-1],[1,1]];
// state: { sq: Int8Array(16) of codes (0 empty; 1..4 white K R B N; -1..-4 black), res: {w:[..codes], b:[..]}, side: 1|-1, stage: 'wk'|'bk'|'play' }
function start() { return { sq: new Int8Array(16), res: { 1: [2,3,4], [-1]: [2,3,4] }, side: 1, stage: 'wk' }; }
function attacked(sq, target, bySide) {
  // does any piece of bySide attack `target` on board `sq`?
  for (let i = 0; i < N; i++) {
    const v = sq[i]; if (v === 0 || Math.sign(v) !== bySide) continue;
    const kind = Math.abs(v); const [r, c] = rc(i);
    if (kind === 1) { for (const [dr, dc] of KSTEP) if (idx(r+dr, c+dc) === target) return true; }
    else if (kind === 4) { for (const [dr, dc] of NSTEP) if (idx(r+dr, c+dc) === target) return true; }
    else { const dirs = kind === 2 ? RDIR : BDIR; for (const [dr, dc] of dirs) { let rr = r+dr, cc = c+dc; while (idx(rr, cc) >= 0) { const j = idx(rr, cc); if (j === target) return true; if (sq[j] !== 0) break; rr += dr; cc += dc; } } }
  }
  return false;
}
function kingOf(sq, side) { for (let i = 0; i < N; i++) if (sq[i] === side * 1) return i; return -1; }
function inCheck(sq, side) { const k = kingOf(sq, side); return k >= 0 && attacked(sq, k, -side); }
function moves(st) {
  const out = [];
  if (st.stage === 'wk') { for (let c = 0; c < 4; c++) out.push({ k: 'K', to: idx(3, c) }); return out; }
  if (st.stage === 'bk') { for (let c = 0; c < 4; c++) if (st.sq[idx(0, c)] === 0) out.push({ k: 'K', to: idx(0, c) }); return out; }
  const s = st.side, sq = st.sq;
  const tryMove = (from, to) => {
    if (to < 0) return false; const t = sq[to];
    if (t !== 0 && Math.sign(t) === s) return false; // own piece blocks
    if (Math.abs(t) === 1) return false; // never capture a king
    const b = Int8Array.from(sq); b[to] = b[from]; b[from] = 0;
    if (!inCheck(b, s)) out.push({ k: 'M', from, to });
    return t === 0; // ray may continue only through empty squares
  };
  for (let i = 0; i < N; i++) {
    const v = sq[i]; if (v === 0 || Math.sign(v) !== s) continue; const kind = Math.abs(v); const [r, c] = rc(i);
    if (kind === 1) for (const [dr, dc] of KSTEP) tryMove(i, idx(r+dr, c+dc));
    else if (kind === 4) for (const [dr, dc] of NSTEP) tryMove(i, idx(r+dr, c+dc));
    else for (const [dr, dc] of (kind === 2 ? RDIR : BDIR)) { let rr = r+dr, cc = c+dc; while (idx(rr, cc) >= 0 && tryMove(i, idx(rr, cc))) { rr += dr; cc += dc; } }
  }
  for (const p of new Set(st.res[s])) for (let to = 0; to < N; to++) {
    if (sq[to] !== 0) continue; const b = Int8Array.from(sq); b[to] = s * p;
    if (inCheck(b, s)) continue; if (inCheck(b, -s)) continue; // a deployed piece may not give check
    out.push({ k: 'D', p, to });
  }
  return out;
}
function apply(st, m) {
  const sq = Int8Array.from(st.sq); const res = { 1: [...st.res[1]], [-1]: [...st.res[-1]] };
  if (m.k === 'K') { sq[m.to] = st.side * 1; return { sq, res, side: st.stage === 'wk' ? -1 : 1, stage: st.stage === 'wk' ? 'bk' : 'play' }; }
  if (m.k === 'M') { const cap = sq[m.to]; sq[m.to] = sq[m.from]; sq[m.from] = 0; if (cap !== 0) res[Math.sign(cap)].push(Math.abs(cap)); return { sq, res, side: -st.side, stage: 'play' }; }
  sq[m.to] = st.side * m.p; res[st.side].splice(res[st.side].indexOf(m.p), 1); return { sq, res, side: -st.side, stage: 'play' };
}
function perft(st, d) { const ms = moves(st); if (d === 1) return ms.length; let t = 0; for (const m of ms) t += perft(apply(st, m), d - 1); return t; }
for (let d = 1; d <= 5; d++) console.log('independent perft', d, perft(start(), d));
