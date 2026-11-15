// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_guessexit_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3976, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9343', '--user-data-dir=' + path.join(HERE, 'chrome-prof-guessexit'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9343/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const down = code => send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code }), up = code => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code });
  const click = idn => ev(`document.getElementById('${idn}').click()`);
  const st = () => ev('JSON.stringify({x:+__wk.p.x.toFixed(1),z:+__wk.p.z.toFixed(1),y:+__wk.y.toFixed(2),mv:__wk.mv,car:__car.CAR.on,sp:+__car.CAR.speed.toFixed(1),sw:__car.SW.on})').then(JSON.parse);
  const waitWalk = async () => { for (let k = 0; k < 40; k++) { if (await ev('__wk.on&&!__wk.intro')) return; await wait(400); } };
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(1500); await waitWalk();
const txt = id => ev(`document.getElementById('${id}').innerText`);
  const btn = txt => ev(`(()=>{const b=[...document.querySelectorAll('#gBody button')].find(b=>b.textContent.includes(${JSON.stringify(txt)}));if(b&&!b.disabled){b.click();return true}return false})()`);
  const body = () => ev(`document.getElementById('gBody').innerText`);
  ok((await ev(`__car.GM.stations.length`)) === 10 && (await ev(`__car.GM.stations.filter(s=>s.k==='جماعي').length`)) === 3, '10 محطات: 3 منها جماعية (لودو، سباق النقر، خمّن الرقم)');
  // ===== لودو =====
  const pos = async () => JSON.parse(await ev('JSON.stringify({x:__wk.p.x,z:__wk.p.z,em:__wk.emote,go:!!window.__gameOpen,ae:document.activeElement&&document.activeElement.tagName+":"+(document.activeElement.type||""),gov:document.getElementById("gOv")?getComputedStyle(document.getElementById("gOv")).display:"?"})'));
  const joyWalk = async () => {
  const jr = JSON.parse(await ev('JSON.stringify((()=>{const r=document.getElementById("joy").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,d:getComputedStyle(document.getElementById("joy")).display}})())')); console.log('joy', jr);
  const hit = await ev(`(()=>{const e=document.elementFromPoint(${jr.x},${jr.y}-30);return e&&(e.id||e.tagName)})()`); console.log('element at joystick', hit);
  await ev(`(()=>{const j=document.getElementById('joy');const o={bubbles:true,pointerId:7,pointerType:'touch',clientX:${jr.x},clientY:${jr.y}};j.dispatchEvent(new PointerEvent('pointerdown',o));j.dispatchEvent(new PointerEvent('pointermove',{...o,clientY:${jr.y}-40}));})()`);
  await wait(1200); await ev(`document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7}))`); await wait(200);
  };
  { const p0 = await pos(); await joyWalk(); const p1 = await pos(); console.log('CONTROL moved', Math.hypot(p1.x-p0.x,p1.z-p0.z).toFixed(2)); }
  await ev(`__car.GM.openGame('guess')`); await wait(900); await btn('ضد بوت'); await wait(2500);
  // ركّز على المنزلق مثل لمسة حقيقية
  await ev(`(()=>{const s=document.querySelector('#gBody input[type=range]');s.focus();})()`);
  console.log('before close', await pos());
  await ev(`document.getElementById('gClose').click()`); await wait(800);
  const a = await pos(); console.log('after close', a);
  await joyWalk();
  const b = await pos(); console.log('AFTER moved', Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)); console.log('after W', b);
  ok(Math.hypot(b.x - a.x, b.z - a.z) > 1, 'يمشي بالكيبورد بعد الخروج من خمّن الرقم وسط الجولة');
  await wait(4000); const c = await pos(); console.log('later', c); ok(!c.go, 'اللعبة ما ترجع تفتح');
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`); console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM'); setTimeout(() => process.exit(0), 800);
}
