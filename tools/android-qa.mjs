// Smoke test of the QA build (VITE_QA=1) running in the Android emulator or on a phone with USB debugging.
//   adb forward tcp:9222 localabstract:webview_devtools_remote_<pid of com.fajar.tidewake>
//   node tools/android-qa.mjs
// Build the QA APK first with `npm run android:qa` (a normal build has no test hooks). Needs Node 22 or newer.
// (Android's WebView speaks only a small part of the DevTools protocol, so this talks to the page directly.)
const targets = await (await fetch('http://localhost:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('No page to talk to: start the app and run the adb forward command above first.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};

/** Run JavaScript in the page and return its value (promises are awaited). */
async function run(expression) {
  const id = nextId++;
  const reply = new Promise((resolve) => pending.set(id, resolve));
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  const msg = await reply;
  if (msg.result?.exceptionDetails) throw new Error(msg.result.exceptionDetails.exception?.description ?? 'page error');
  return msg.result?.result?.value;
}

async function until(expression, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await run(expression)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${expression}`);
}

const out = (label, value) => console.log(`${label}:`, typeof value === 'string' ? value : JSON.stringify(value));

await until('window.__game && (__game.scene.isActive("Onboarding") || __game.scene.isActive("Menu"))');
out('first scene', await run('["Onboarding","Menu"].find((k) => __game.scene.isActive(k))'));
if (await run('__game.scene.isActive("Onboarding")')) {
  await run('__game.scene.getScene("Onboarding").chooseLanguage("en"), __game.scene.getScene("Onboarding").finish(), 1');
  await until('__game.scene.isActive("Menu")');
}
out('menu reached', true);
await run('__game.scene.getScene("Menu").goTo("NewGame"), 1');
await until('__game.scene.isActive("NewGame")');
await run('(() => { const s = __game.scene.getScene("NewGame"); s.name = "Ari"; s.seedText = "1234"; s.begin(); return 1; })()');
await until('__game.scene.isActive("Intro")');
await run('__game.scene.getScene("Intro").finish(), 1');
await until('__game.scene.isActive("Game") && __game.scene.isActive("Hud")');
await new Promise((r) => setTimeout(r, 1500));
out('in the game', await run('(() => { const g = __game.scene.getScene("Game"); return g.slotData.name + " seed " + g.slotData.seed + " day " + g.session.clock.day; })()'));
const fps = await run('new Promise((res) => { const s = []; const id = setInterval(() => { s.push(__game.loop.actualFps); if (s.length >= 10) { clearInterval(id); res(s); } }, 500); })');
fps.sort((a, b) => a - b);
out('fps (min, median, max)', [fps[0].toFixed(0), fps[fps.length >> 1].toFixed(0), fps[fps.length - 1].toFixed(0)]);
out('device', await run('({ dpr: devicePixelRatio, w: innerWidth, h: innerHeight, canvas: __game.scale.width + "x" + __game.scale.height, renderer: __game.renderer.type })'));
out('page errors', await run('JSON.stringify(window.__errs)'));
socket.close();
