// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_enterui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3979, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9339', '--user-data-dir=' + path.join(HERE, 'chrome-prof-enterui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9339/json')).json()).find(t => t.type === 'page'); } catch {} }
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
const txt = id => ev(`document.getElementById('${id}').innerText`);
  const instate = async () => JSON.parse(await ev('JSON.stringify(__car.inState())'));
  const dbtn = () => ev(`(()=>{const b=document.getElementById('doorBtn');return b.style.display+'|'+b.textContent})()`);
  // نروح قدّام بيتي
  await ev(`(()=>{const [x,z]=__car.plotPos(20),f=__car.faceOf(20);__wk.p.set(x,0,z+f*15);__wk.yaw=f>0?Math.PI:0;__wk.camYaw=f>0?0:Math.PI;})()`);
  await wait(3500);
  ok((await dbtn()).startsWith('block|') && (await dbtn()).includes('ادخل بيتك'), 'زر «ادخل بيتك» يطلع قدّام البيت: ' + await dbtn());
  await shot('in_0_outside.png');
  await ev(`document.getElementById('doorBtn').click()`); await wait(2500);
  let s0 = await instate(); ok(s0.on && s0.own, 'دخلت البيت (مالك)');
  ok((await ev(`document.getElementById('inBox').style.display`)) === 'flex', 'أزرار الداخل (اطلع/نام/اللي داخل) تظهر');
  ok((await dbtn()).startsWith('none'), 'زر الباب يختفي بالداخل');
  await shot('in_1_room.png');
  // حدود الغرفة
  await ev(`__wk.p.x=${0}+__car.inState().x+200;__wk.p.z=__car.inState().z+200;`); await wait(1500);
  const wp = JSON.parse(await ev('JSON.stringify({x:__wk.p.x,z:__wk.p.z})')); ok(Math.abs(wp.x - s0.x) <= s0.hw && Math.abs(wp.z - s0.z) <= s0.hd, 'الجدران تمنع الخروج عن الغرفة (' + Math.round(wp.x - s0.x) + ',' + Math.round(wp.z - s0.z) + ')');
  // نوم
  await ev(`__wk.p.set(__car.inState().bed.x+1.5,0,__car.inState().bed.z+2)`); await wait(800);
  await ev(`document.getElementById('inSleep').click()`); await wait(1500);
  ok((await instate()).emote === 6, 'النوم: الوضعية 6'); await shot('in_2_sleep.png');
  await ev(`document.getElementById('inSleep').click()`); await wait(600); ok((await instate()).emote === 0, 'زر قم يصحّيه');
  // طرق افتراضي من الشبكة
  await ev(`__car.onNet({t:'kn',f:'zz9',n:'ضيف'})`); await wait(400);
  ok((await ev(`document.getElementById('knockBox').style.display`)) === 'block' && (await txt('knockT')).includes('ضيف'), 'نافذة الطرق تظهر لصاحب البيت');
  await shot('in_3_knock.png');
  await ev(`document.getElementById('knockNo').click()`); await wait(300); ok((await ev(`document.getElementById('knockBox').style.display`)) === 'none', 'الرفض يقفل النافذة');
  await ev(`__car.onNet({t:'hv',l:[['zz9','ضيف']]})`); await ev(`document.getElementById('p19').style.display='block'`); ok((await txt('inList')).includes('ضيف'), 'قائمة اللي داخل مع زر طرد');
  await ev(`document.getElementById('p19').style.display='none'`);
  // خروج
  await ev(`document.getElementById('inExit').click()`); await wait(3500);
  const s1 = await instate(); ok(!s1.on, 'طلعت من البيت');
  const pos = JSON.parse(await ev('JSON.stringify({x:__wk.p.x,z:__wk.p.z,ch:window.__chunks()})')); const [px, pz] = JSON.parse(await ev('JSON.stringify(__car.plotPos(20))'));
  ok(Math.hypot(pos.x - px, pos.z - pz) < 20 && pos.ch.act > 0, 'رجعت قدّام البيت والمدينة تحمّلت: ' + JSON.stringify(pos.ch));
  await shot('in_4_back.png');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
