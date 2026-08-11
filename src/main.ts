/**
 * Kakkoi Online — boot.
 *
 * Scaffold only: opens a canvas and runs the loop. Everything else arrives
 * milestone by milestone (see the planning docs listed in DESIGN.md).
 */
import { startLoop } from './loop.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#world');
const status = document.querySelector<HTMLElement>('#status');
if (!canvas) throw new Error('no #world canvas in index.html');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');

// Pixel art: never smooth it.
ctx.imageSmoothingEnabled = false;

let frames = 0;
let fps = 0;
let fpsClock = 0;

startLoop({
  // Fixed-step simulation. dt is always the same number, which is the point:
  // movement must not depend on how fast the computer is (lesson A12).
  update(dt) {
    fpsClock += dt;
    if (fpsClock >= 1) {
      fps = frames;
      frames = 0;
      fpsClock -= 1;
    }
  },

  render() {
    frames++;
    ctx.fillStyle = '#1b1b22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e8e8ef';
    ctx.font = '16px monospace';
    ctx.fillText('Kakkoi Online — scaffold', 16, 28);
    ctx.fillText(`${fps} fps`, 16, 48);
  },
});

if (status) status.textContent = 'running (scaffold)';
