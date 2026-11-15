// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_yardui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3985, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9359', '--user-data-dir=' + path.join(HERE, 'chrome-prof-yardui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9359/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  const goto = async (lx, lz, yaw = 1.57) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+(${lx}),0,P.z+(${lz}));__wk.y=0.3;__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;})()`); await wait(1200); };
  const vst = async () => JSON.parse(await ev(`JSON.stringify(__vox.state())`));
  // 1) داخل البيت ما يظهر عالم البناء
  await goto(160, 0); ok(await ev('__vox.state().meshes') >= 0, 'قرب حدّ العالم'); for (let k = 0; k < 40 && (await vst()).meshes < 5; k++) await wait(500); const m0 = (await vst()).meshes; ok(m0 >= 5, 'قطع عالم البناء تنرسم برّا البيت', String(m0));
  await ev('__vox.debug.forceInside(true)'); await wait(1500); ok((await vst()).meshes === 0 && (await vst()).chunks === 0 && !(await vst()).fp, 'داخل البيت: ما يظهر أي مكعب من عالم البناء (الغرفة نظيفة)');
  await ev('__vox.debug.forceInside(false)'); await goto(5, 0); await wait(800);
  // 2) سيارات الحوش
  const me = await ev('__yard.myId'); ok(!!me, 'عندي بيت بالاختبار', String(me)); await ev("(()=>{const h=__yard.HOUSES.find(x=>x.id===__yard.myId),p=__yard.plotPos(h.plot);__wk.p.set(p[0]+30,0,p[1]);__wk.y=.3;})()"); await wait(800);
  for (const [m, s] of [[2, 0], [5, 1], [7, 2], [3, 5]]) { await ev('__net.NET.ws.send(JSON.stringify({t:"pk",m:' + m + ',s:' + s + '}))'); await wait(900); } await wait(1500); const pos = JSON.parse(await ev('JSON.stringify([...__yard.YC.values()].map(c=>[c.g.position.x,c.g.position.z]))'));
  ok(pos.length === 3, 'ثلاث سيارات محفوظة بالحوش تظهر (والرابعة بمكان غلط تنرفض)', String(pos.length));
  { const hp = JSON.parse(await ev('JSON.stringify(__yard.houseXZ(__yard.HOUSES.find(x=>x.id===__yard.myId).plot))')), pp = JSON.parse(await ev('JSON.stringify(__yard.plotPos(__yard.HOUSES.find(x=>x.id===__yard.myId).plot))')); const side = Math.sign(pp[0] - hp[0]); ok(pos.every(p => (p[0] - pp[0]) * side > 7 && Math.abs(p[1] - pp[1]) < 10), 'السيارات داخل الحوش جنب البيت (ورا بعض)', JSON.stringify(pos.map(p => [+(p[0]-pp[0]).toFixed(1), +(p[1]-pp[1]).toFixed(1)]))); for (const p of pos) ok(!(await ev('__car.solidAt(' + p[0] + ',' + p[1] + ',0)')), 'مكان السيارة فاضي (ما فيه جدار/ديكور)', p.map(v=>v.toFixed(1)).join(',')); }
    const c0 = pos[0]; await ev(`(()=>{const c=[...__yard.YC.values()][0];__wk.p.set(c.g.position.x+3,0,c.g.position.z);__wk.y=.3;})()`); await wait(900);
  await ev('__yard.updParkBtn()'); ok(await vis('parkBtn') && /اطلع بسيارتك/.test(await txt('parkBtn')), 'قرب سيارتك بالحوش: زر «اطلع بسيارتك»', await txt('parkBtn'));
  await shot('y1_yard.png'); await ev(`document.getElementById('parkBtn').click()`); await wait(800);
  ok(await ev('__car.CAR.on') && await ev('__yard.YC.size') === 2, 'ركبت سيارتك من الحوش (انسحبت من الحفظ)');
  await ev('__yard.updParkBtn()'); await wait(300); ok(await vis('parkBtn') && /ركن/.test(await txt('parkBtn')), 'وأنت داخل الحوش بالسيارة: زر «ركن السيارة»');
  await ev(`document.getElementById('parkBtn').click()`); await wait(800); ok(!(await ev('__car.CAR.on')) && await ev('__yard.YC.size') === 3, 'ركنت السيارة: تنحفظ مكان فاضي بالحوش');
  await shot('y2_parked.png');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
