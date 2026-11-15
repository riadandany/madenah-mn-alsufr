// اختبار: الخزانة + الجوائز + تفاصيل المدينة والساحة + طبقة الحياة
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_life_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
// ألوان وزينة وقبعات عشوائية للبيوت (بيانات تجربة محلية فقط)
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; h.st = [i % 7, i % 5, i % 7, i % 3 === 0 ? 1 + (i % 6) : 0, i % 4 === 0 ? 1 + (i % 4) : 0]; });
const OWNER = base.find(h => h.type === 1);                 // بيت طين
OWNER.days = 3; OWNER.last = '2000-01-01'; OWNER.st = [0, 0, 0, 0, 0];   // يوم 4 قدّامه → جائزة b1
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3992, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(HERE, 'chrome-prof-life'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  await send('Page.navigate', { url: URL0 + 'vendor/OrbitControls.js' }); await wait(400);
  await ev(`localStorage.clear();localStorage.setItem('mnalsifr_dev','${OWNER.dev}')`);
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  // تنبيه الجائزة اليومية (بعد حوالي 3.3 ثانية من الفتح)
  let rw = ''; for (let k = 0; k < 14; k++) { await wait(500); const t = await ev(`document.getElementById('toast').textContent`); if (/جائزة اليوم/.test(t)) { rw = t; break; } }
  console.log('daily reward toast:', rw || '(none)');
  console.log('walking in plaza:', await ev(`JSON.stringify({on:__wk.on,x:+__wk.p.x.toFixed(0),z:+__wk.p.z.toFixed(0)})`));
  // ===== الخزانة =====
  await ev(`document.getElementById('wChar').click()`); await wait(1500);
  console.log('wardrobe info:', (await ev(`document.querySelector('#wardrobe .info').innerText`)).replace(/\n/g, ' '));
  console.log('buttons: enabled', await ev(`document.querySelectorAll('#wardrobe .opts button:not(:disabled)').length`), '| locked', await ev(`document.querySelectorAll('#wardrobe .opts button:disabled').length`), '| first locked label:', await ev(`document.querySelector('#wardrobe .opts button:disabled').textContent`));
  await shot('life_1_wardrobe.png');
  const click = (k, v) => ev(`document.querySelector('#wardrobe [data-k="${k}"][data-v="${v}"]').click()`);
  await click(0, 1); await wait(900); console.log('hat → walker key:', await ev('__wk.walker.key'));
  await click(3, 1); await wait(1200); await click(4, 1); await wait(1200);
  console.log('server st after picks:', await ev(`fetch('/api/houses').then(r=>r.json()).then(d=>JSON.stringify(d.houses.find(h=>h.id==='${OWNER.id}').st))`));
  await click(2, 1); await wait(600);
  console.log('locked item (day 7+) refused? msg:', await ev(`(async()=>{const r=await fetch('/api/style',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:'${OWNER.dev}',st:[6,0,0,0,0]})});return r.status})()`));
  await ev(`document.getElementById('cancel6').click()`);
  // ===== بيتي بعد التخصيص =====
  await ev(`document.getElementById('wHome').click()`); await wait(300); await ev(`document.getElementById('goHome').click()`); await wait(1800);
  await ev(`__wk.camYaw=0.9;__wk.dist=16;__wk.cur=16;__wk.pitch=.4`); await wait(1200);
  await shot('life_2_my_house.png');
  // ===== الساحة من فوق: المدينة + السوق + الزوّار الآليين =====
  await ev(`document.getElementById('wHome').click()`); await wait(300); await ev(`document.getElementById('goPlaza').click()`); await wait(2500);
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+4,0,P.z-26);__wk.camYaw=Math.PI;__wk.dist=34;__wk.cur=34;__wk.pitch=.55;})()`); await wait(6000);
  console.log('bots visible:', await ev(`__car.LIFE.bots.filter(b=>b.w.root.visible).length`), '| names:', await ev(`'ok'`));
  await shot('life_3_plaza.png');
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x,0,P.z+30);__wk.camYaw=Math.PI;__wk.dist=30;__wk.cur=30;__wk.pitch=.3;})()`); await wait(1500);
  await shot('life_4_tower.png');
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x-70,0,P.z-30);__wk.camYaw=-Math.PI/2;__wk.dist=22;__wk.cur=22;__wk.pitch=.35;})()`); await wait(1500);
  await shot('life_5_stalls.png');
  console.log('counter:', await ev(`document.getElementById('count').textContent`));
  // ===== الحياة بالمدينة: سيارات تمشي + ناس =====
  await ev(`__wk.p.set(22,0,34);__wk.camYaw=0.4;__wk.dist=24;__wk.cur=24;__wk.pitch=.45`); await wait(2000);
  const p0 = await ev(`JSON.stringify(__car.LIFE.cars.map(c=>[+c.g.position.x.toFixed(0),+c.g.position.z.toFixed(0),c.g.visible]))`); await wait(2000);
  const p1 = await ev(`JSON.stringify(__car.LIFE.cars.map(c=>[+c.g.position.x.toFixed(0),+c.g.position.z.toFixed(0),c.g.visible]))`);
  console.log('traffic cars moved:', p0 !== p1, '| visible now:', await ev(`__car.LIFE.cars.filter(c=>c.g.visible).length`), '| peds visible:', await ev(`__car.LIFE.peds.filter(p=>p.w.root.visible).length`), '| birds:', await ev(`__car.LIFE.birds.b.length`), '| clouds:', await ev(`__car.LIFE.clouds.c.length`));
  await shot('life_6_city_street.png');
  await ev(`document.getElementById('wExit').click()`); await wait(2500);
  await shot('life_7_overview.png');
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
