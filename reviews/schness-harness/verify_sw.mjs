import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const S = '/tmp/claude-0/-home-user-kakkoi-online/3a53d063-6766-5ed7-9cf8-1004b0e08e5a/scratchpad/sw';
const base = 'http://127.0.0.1:8897'; const url = `${base}/game.html?game=11111111-2222-4333-8444-555555555555&mode=bot`;
const serve = (dir) => execSync(`rm -rf ${S}/live && cp -r ${S}/${dir} ${S}/live`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const variant of ['old', 'new']) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const read = () => page.evaluate(() => ({ html: document.documentElement.dataset.build, css: getComputedStyle(document.documentElement).getPropertyValue('--build').trim().replace(/"/g, ''), controlled: Boolean(navigator.serviceWorker.controller) }));
  serve(`${variant}-A`);
  await page.goto(url); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(800);
  await page.goto(url); await page.waitForTimeout(500);
  const v1 = await read();
  serve(`${variant}-B`);                      // the deploy: HTML, CSS and CACHE all change together
  await page.goto(url); const v2 = await read();   // first visit after the deploy
  await page.waitForTimeout(2500);            // the new worker installs, activates and claims
  await page.goto(url); const v3 = await read();   // next visit
  console.log(`[${variant} sw] before deploy: html=${v1.html} css=${v1.css} controlled=${v1.controlled} | first visit after: html=${v2.html} css=${v2.css} | next visit: html=${v3.html} css=${v3.css}`);
  await ctx.close();
}
await browser.close();
