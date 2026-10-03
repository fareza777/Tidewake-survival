// Automated play harness: drives the dev build in headless Edge, runs scripted steps and saves screenshots.
// Usage: node tools/play.mjs <script.json> [outDir]
// Steps: {"goto": url} {"wait": ms} {"eval": "js"} {"shot": "name"} {"tap": [x,y]} {"hold": [x,y,ms]}
//        {"until": "js-expression", "timeout": ms} {"press": "ArrowRight", "ms": 800}
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [, , scriptPath, outArg] = process.argv;
const steps = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const outDir = outArg ?? 'tools/.cache/shots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
// Optional overrides, e.g. VIEW=360x640 DPR=3 for 1080x1920 store screenshots.
const [vw, vh] = (process.env.VIEW ?? '390x844').split('x').map(Number);
const dpr = Number(process.env.DPR ?? 2);
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack ?? e.message}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });

for (const s of steps) {
  try {
    if (s.goto) await page.goto(s.goto, { waitUntil: 'load' });
    else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.eval) {
      const r = await page.evaluate(s.eval);
      if (r !== undefined) console.log('eval ->', typeof r === 'string' ? r : JSON.stringify(r));
    } else if (s.shot) {
      await page.screenshot({ path: path.join(outDir, `${s.shot}.png`) });
      console.log('shot', s.shot);
    } else if (s.profile) {
      // CPU profile for s.profile ms; prints the functions with the most self time.
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
      await cdp.send('Profiler.start');
      await page.waitForTimeout(s.profile);
      const { profile } = await cdp.send('Profiler.stop');
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const self = new Map();
      profile.samples.forEach((id, i) => {
        const n = byId.get(id);
        const f = n.callFrame;
        const key = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`;
        self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0));
      });
      const total = [...self.values()].reduce((a, b) => a + b, 0);
      const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, s.top ?? 25);
      console.log(`profile total ${(total / 1000).toFixed(0)}ms`);
      for (const [k, v] of top) console.log(`  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
    } else if (s.tap) {
      await page.mouse.click(s.tap[0], s.tap[1]);
    } else if (s.hold) {
      await page.mouse.move(s.hold[0], s.hold[1]);
      await page.mouse.down();
      await page.waitForTimeout(s.hold[2]);
      await page.mouse.up();
    } else if (s.press) {
      await page.keyboard.down(s.press);
      await page.waitForTimeout(s.ms ?? 300);
      await page.keyboard.up(s.press);
    } else if (s.until) {
      await page.waitForFunction(s.until, null, { timeout: s.timeout ?? 15000 });
    }
  } catch (err) {
    logs.push(`[step ${JSON.stringify(s).slice(0, 80)}] ${err.message}`);
  }
}
const errs = await page.evaluate('JSON.stringify(window.__errs ?? [])').catch(() => '[]');
console.log('page errors:', errs);
for (const l of logs) console.log(l);
await browser.close();
