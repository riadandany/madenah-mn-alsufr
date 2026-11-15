// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_free_houses.json');
const GAPS = new Set([203, 500, 677]);
const base = []; for (let p = 0; p < 700; p++) if (!GAPS.has(p)) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: 'بيت' + p, t: 1, dev: 'dev' + p + '-xxxxxxxx', ip: 'ip' + (p % 900), days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3983, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9336', '--user-data-dir=' + path.join(HERE, 'chrome-prof-free'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9336/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
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
  const info = async () => JSON.parse(await ev(`(()=>{const f=__car.free(),t=__car.ctl.target;return JSON.stringify({n:f.l.length,i:f.i,pick:f.pick,mode:f.mode,first:f.l[0]&&f.l[0].p,tx:t.x,tz:t.z,fx:f.l[f.i]&&f.l[f.i].x,fz:f.l[f.i]&&f.l[f.i].z,fn:document.getElementById('freeN').innerText,p2:document.getElementById('p2').style.display})})()`));
  ok(await ev('__net.NET && true'), 'المدينة كبيرة: ' + await ev('document.getElementById("count").innerText'));
  await ev(`document.getElementById('wBuild').click()`); await wait(1200);
  await ev(`document.getElementById('name').value='لاعب جديد';document.getElementById('pin').value='1234';document.getElementById('next').click()`);
  await wait(2500);
  let f = await info();
  ok(f.p2 === 'block' && f.mode === 'pick', 'دخل شاشة اختيار الأرض');
  ok(f.n >= 3 && /مكان 1 من/.test(f.fn), 'قائمة الأماكن المتاحة: ' + f.n + ' • ' + f.fn);
  ok(f.pick === f.first && f.pick === 203, 'اختار تلقائياً أقرب مكان متاح للوسط: ' + f.pick);
  ok(Math.hypot(f.tx - f.fx, f.tz - f.fz) < 25, 'الكاميرا تقرّبت للمكان المتاح (' + Math.round(f.tx) + ',' + Math.round(f.tz) + ') ≈ (' + Math.round(f.fx) + ',' + Math.round(f.fz) + ')');
  await shot('free_1_first.png');
  await ev(`document.getElementById('nextFree').click()`); await wait(2200); f = await info();
  ok(f.i === 1 && f.pick !== f.first && /مكان 2 من/.test(f.fn) && Math.hypot(f.tx - f.fx, f.tz - f.fz) < 25, 'زر ◀ ينقل لمكان متاح ثاني ويقرّب: ' + f.pick);
  await shot('free_2_second.png');
  await ev(`document.getElementById('prevFree').click()`); await wait(300); f = await info(); ok(f.i === 0 && f.pick === 203, 'زر ▶ يرجع للأول');
  ok(!(await ev(`document.getElementById('confirm').disabled`)), 'زر «ابنِ هنا» مفعّل');
  await ev(`document.getElementById('confirm').click()`); await wait(2500);
  const hs = await (await fetch(`http://127.0.0.1:${PORT}/api/houses`)).json();
  ok((hs.houses || hs).some(h => h.plot === 203), 'البيت انبنى على الأرض المختارة 203');
  await shot('free_3_built.png');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
