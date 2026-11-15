// اختبار حيّ الفعاليات: المول (3 أدوار + درج)، البحيرة (سباحة + غرق)، الحلبة (قفزة + مسرّع)، سيارة تنزل بمكانك، رقص وجلوس
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_perf_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3999, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(HERE, 'chrome-prof-perf'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  // 1) تكلفة الدوال الثقيلة
  const T = JSON.parse(await ev(`(()=>{const t=(f,n=3)=>{const a=[];for(let i=0;i<n;i++){const s=performance.now();f();a.push(+(performance.now()-s).toFixed(1));}return a;};
    return JSON.stringify({buildCity:t(()=>__car.buildCity()),updLabels:t(()=>__car.updLabels(),5),updNPC:t(()=>__car.updNPC(),5)});})()`));
  console.log('تكلفة (ms):', JSON.stringify(T));
  // 2) مراقبة المهام الطويلة + بروفايل JS 12 ثانية بالمشي
  await ev(`window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))}).observe({entryTypes:['longtask']})`);
  await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 500 }); await send('Profiler.start');
  await down('ShiftLeft'); await down('KeyW'); await wait(12000); await up('KeyW'); await up('ShiftLeft');
  const prof = (await send('Profiler.stop')).profile;
  const self = new Map(), byId = new Map(prof.nodes.map(n => [n.id, n])); const dt = prof.timeDeltas;
  prof.samples.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('أثقل الدوال (ذاتي، من', Math.round(tot / 1000), 'ms كلي):');
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log('  ', Math.round(v / 1000) + 'ms', k));
  console.log('longtasks:', await ev('JSON.stringify(window.__lt)'));
  const fr = await ev('(()=>new Promise(r=>{let n=0,t0=performance.now(),mx=0,l=t0;const f=()=>{const t=performance.now();mx=Math.max(mx,t-l);l=t;n++;if(t-t0>4000)r(JSON.stringify({fps:+(n/4).toFixed(1),maxFrameMs:Math.round(mx)}));else requestAnimationFrame(f)};requestAnimationFrame(f)}))()');
  console.log('frames:', fr);
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
