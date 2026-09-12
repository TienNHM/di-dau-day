/**
 * Horizontal-overflow check against a running build.
 *
 * A phone-width layout that overflows is invisible in code review and invisible in
 * a desktop browser, and `body { overflow-x: hidden }` hides the symptom rather than
 * the cause. This drives headless Chrome over CDP — no extra dependency, Node 22 has
 * WebSocket built in — and reports every element whose box escapes the viewport.
 *
 * Usage (with `pnpm preview` running):
 *   node scripts/check-layout.mjs http://localhost:3000/ 390
 *
 * Note: Chrome's own `--screenshot` flag is not trustworthy here — it lays the page
 * out at a default width and crops to the window size, which looks exactly like an
 * overflow bug. Always measure through CDP with device metrics overridden.
 */

import { spawn } from 'node:child_process';

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const URL_TO_TEST = process.argv[2] ?? 'http://localhost:3000/';
const WIDTH = Number(process.argv[3] ?? 390);

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}/cr-probe`,
  `--window-size=${WIDTH},900`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      if (list.length) return list;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome did not expose CDP');
}

const list = await targets();
const page = list.find(t => t.type === 'page') ?? list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const myId = ++id;
  pending.set(myId, resolve);
  ws.send(JSON.stringify({ id: myId, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: true,
});
await send('Page.navigate', { url: URL_TO_TEST });
await sleep(2500);

const expr = `(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 70),
        left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      });
    }
  }
  return JSON.stringify({
    viewport: vw,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    offenders: offenders.slice(0, 12),
  }, null, 1);
})()`;

const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res));

ws.close();
chrome.kill();
