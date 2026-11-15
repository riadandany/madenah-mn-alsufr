// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_fair_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3979, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9353', '--user-data-dir=' + path.join(HERE, 'chrome-prof-fair'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9353/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx')}catch{}" });
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
  const vis = id => ev(`getComputedStyle(document.getElementById('${id}')).display!=='none'`);
  const txt = id => ev(`document.getElementById('${id}').innerText`);
  const goto = async (lx, lz) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+(${lx}),0,P.z+(${lz}));__wk.y=0.3;__wk.yaw=1.57;__wk.camYaw=1.57+Math.PI;})()`); await wait(1200); };
  const info = async () => JSON.parse(await ev(`JSON.stringify({on:__fair.on,id:__fair.ride&&__fair.ride.id,mv:__wk.mv,vis:__wk.walker.root.visible,p:__fair.seatPose(),wx:+__wk.p.x.toFixed(1),wy:+__wk.y.toFixed(2),wz:+__wk.p.z.toFixed(1)})`));
  const spots = { wheel: [-52.5, -26], carousel: [-45.6, 18.9], chairs: [43.5, 16.5], tower: [58.1, -7] };
  ok(await ev('typeof __fair==="object"'), 'مدينة الألعاب تحمّلت');
  for (const id of ['wheel', 'carousel', 'chairs', 'tower']) {
    await goto(...spots[id]); const shown = await vis('fairBtn'); const t = await txt('fairBtn');
    ok(shown && /اركب/.test(t), id + ': زر «اركب» يظهر بالقرب', t);
    await ev(`document.getElementById('fairBtn').click()`); await wait(700); let a = await info();
    ok(a.on && a.id === id && a.mv === 5 && a.vis === false, id + ': ركبت (جالس، والشخصية مخفية = شخص أول)', JSON.stringify([a.on, a.mv, a.vis]));
    ok(await vis('fairBox') && /انزل/.test(await txt('fairBox')) && /اسحب/.test(await txt('fairBox')), id + ': لوحة الجولة فيها التعليمات وزر «انزل»');
    let mv = 0; for (let k = 0; k < (id === 'tower' ? 4 : 1); k++) { await wait(id === 'tower' ? 3500 : 3500); const q = await info(); mv = Math.max(mv, Math.hypot(q.p.x - a.p.x, q.p.z - a.p.z, q.p.y - a.p.y)); }
    await shot('f_' + id + '.png'); const b = await info();
    ok(mv > 1.5, id + ': المقعد يتحرك مع اللعبة', [a.p.x, a.p.y, a.p.z].map(Math.round) + ' → ' + [b.p.x, b.p.y, b.p.z].map(Math.round));
    ok(Math.hypot(b.wx - b.p.x, b.wz - b.p.z) < 3, id + ': مكاني (اللي يوصل للناس) = المقعد');
    await ev(`document.getElementById('fairX').click()`); await wait(600); const c = await info();
    ok(!c.on && c.vis === true && c.mv === 0 && c.wy < 2, id + ': نزلت على الأرض ورجعت الشخصية', JSON.stringify([c.on, c.vis, c.wy]));
  }
  // الجولة تنتهي لوحدها
  await goto(...spots.carousel); await ev(`document.getElementById('fairBtn').click()`); await wait(300); await ev('__fair.endAt=performance.now()+1500'); await wait(2600); const e = await info(); ok(!e.on && e.vis, 'انتهاء الجولة تلقائياً ينزّلني');
  // قائمة الوجهات
  await ev(`document.getElementById('wHome').click()`); await wait(200); ok(await vis('goFair'), 'زر «مدينة الألعاب» بقائمة الوجهات');
  await ev(`document.getElementById('goFair').click()`); await wait(900); ok(await vis('fairBtn'), 'الانتقال لمدينة الألعاب: يظهر زر «اركب» عند العجلة');
  await shot('f_arrive.png');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
