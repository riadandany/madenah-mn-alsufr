// اختبار شريط «هدفك الجاي» بالمتصفح: يظهر وقت المشي، نصّه من السيرفر، يختفي بالسيارة، والضغط يوديك للمكان
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_goalui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'g' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
for (const f of ['economy.json', 'stats.json']) { try { fs.unlinkSync(path.join(HERE, f)); } catch {} }
fs.mkdirSync(OUTDIR, { recursive: true });
const PORT = 3961, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9361', '--user-data-dir=' + path.join(HERE, 'chrome-prof-goalui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9361/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' ')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  for (let k = 0; k < 40; k++) { if (await ev('__wk.on&&!__wk.intro')) break; await wait(400); }
  await wait(1500);

  const g = await ev('JSON.stringify(window.__goal())').then(JSON.parse);
  ok(g.ng && g.ng.k === 'tut' && g.ng.a === 'games', 'السيرفر أرسل الهدف: العب مع لاعب', JSON.stringify(g.ng));
  ok(g.shown === 'flex', 'الشريط ظاهر وقت المشي', g.shown);
  const txt = await ev(`document.getElementById('goal').innerText`);
  ok(/🎯/.test(txt) && /الألعاب/.test(txt) && /1\/4/.test(txt), 'نص الشريط فيه الهدف والتقدّم', txt);
  const w = await ev(`document.querySelector('#goal .gl-b i').style.width`);
  ok(w === '25%', 'شريط التقدّم 25%', w);
  // 🎉 شريط الفعالية: يظهر بنص «الحين» أو «الجاية» مع عدّاد
  const e = await ev('JSON.stringify(window.__evt())').then(JSON.parse);
  ok(e.EVT && e.shown === 'flex' && (/الحين/.test(e.txt) || /الجاية/.test(e.txt)) && /\d:\d\d/.test(e.txt), 'شريط الفعالية ظاهر بعدّاد', e.txt);
  await shot('goal_1.png');

  // الضغط يوديك لقسم الألعاب
  const before = await ev('JSON.stringify({x:__wk.p.x,z:__wk.p.z})').then(JSON.parse);
  await ev(`document.getElementById('goal').click()`); await wait(1200);
  const after = await ev('JSON.stringify({x:__wk.p.x,z:__wk.p.z})').then(JSON.parse);
  const spot = await ev('JSON.stringify(__car.GM.spot())').then(JSON.parse).catch(() => null);
  const dist = spot ? Math.hypot(after.x - spot.x, after.z - spot.z) : 999;
  ok(Math.hypot(after.x - before.x, after.z - before.z) > 5 && dist < 12, 'الضغط ينقلك عند قسم الألعاب', `dist=${dist.toFixed(1)}`);

  // بالسيارة يختفي
  await ev(`document.querySelectorAll('.panel').forEach(p=>p.style.display='none')`);
  await ev(`document.getElementById('wCar').click()`); await wait(500);
  await ev(`(()=>{const b=document.querySelector('#carList [data-go]');if(b)b.click();})()`); await wait(1200);
  const inCar = await ev('__car.CAR.on');
  const shownCar = await ev(`document.getElementById('goal').style.display`);
  ok(inCar && shownCar === 'none', 'الشريط يختفي وأنت تسوق', `car=${inCar} shown=${shownCar}`);
  const g2 = await ev('JSON.stringify(window.__goal().ng)').then(JSON.parse);
  ok(g2 && g2.p === 2 && g2.a === 'games', 'بعد ركوب السيارة: التقدّم 2/4 والهدف لسه XO', JSON.stringify(g2));
  await shot('goal_2_car.png');
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`); console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM'); setTimeout(() => process.exit(0), 800);
}
