// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_jailwall_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3991, URL0 = `http://127.0.0.1:${PORT}/?phys=rapier`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9351', '--user-data-dir=' + path.join(HERE, 'chrome-prof-jailwall'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9351/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  await wait(1500);
  const walk = async (x, z, yaw, ms) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+${x},0,P.z+${z});__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;})()`); await wait(300); await down('KeyW'); await wait(ms); await up('KeyW'); await wait(300); return JSON.parse(await ev('(()=>{const P=__car.PLAZA();return JSON.stringify({x:+(__wk.p.x-P.x).toFixed(2),z:+(__wk.p.z-P.z).toFixed(2)})})()')); };
  // زنزانة 0: x -111.7..-102.7، القضبان عند z=-148، داخل الزنزانة z<-148
  const r1 = await walk(-107, -145, Math.PI, 1500); console.log('cell bars', r1); ok(r1.z > -148.3, 'القضبان توقف الماشي من برّا (z=' + r1.z + ')');
  // الجدار الخارجي الشرقي x=-28 (برّا x>-28): يمشي غرب
  const r2 = await walk(-25, -140, -Math.PI / 2, 1500); console.log('east wall', r2); ok(r2.x > -28.6, 'الجدار الشرقي يوقف (x=' + r2.x + ')');
  // الجدار الخلفي z=-158 من برّا (z<-158) يمشي شمال
  const r3 = await walk(-60, -161, 0, 1500); console.log('back wall', r3); ok(r3.z < -157.4, 'الجدار الخلفي يوقف (z=' + r3.z + ')');
  // الجدار بين الزنزانتين x=-102.7: من زنزانة 1 للزنزانة 0
  const r4 = await walk(-100, -152, -Math.PI / 2, 1500); console.log('cell divider', r4); ok(r4.x > -103.2, 'الجدار بين الزنازين يوقف (x=' + r4.x + ')');
  // قفز فوق القضبان
  await ev("(()=>{const P=__car.PLAZA();__wk.p.set(P.x-107,0,P.z-145);__wk.yaw=Math.PI;__wk.camYaw=0;})()"); await wait(300); await down('KeyW'); for (let k = 0; k < 6; k++) { await down('Space'); await wait(80); await up('Space'); await wait(250); } await up('KeyW'); await wait(300);
  const r5 = JSON.parse(await ev('(()=>{const P=__car.PLAZA();return JSON.stringify({x:+(__wk.p.x-P.x).toFixed(2),z:+(__wk.p.z-P.z).toFixed(2)})})()')); console.log('jump bars', r5); ok(r5.z > -148.3, 'ما يقفز فوق القضبان');
  // بالسيارة بسرعة على الجدار الشرقي والقضبان
  const drive = async (x, z, yaw, ms) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+${x},0,P.z+${z});__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;})()`); await ev("document.querySelectorAll('.panel').forEach(p=>p.style.display='none')"); await wait(200); await ev("(()=>{const c=__car.PARKED[2];__car.CAR.on||null;})()"); await ev("document.getElementById('wCar').click()"); await wait(400); await ev("document.querySelector('#carList [data-go]') && document.querySelector('#carList [data-go]').click()"); await wait(500); await down('KeyW'); await down('ShiftLeft'); await wait(ms); await up('KeyW'); await up('ShiftLeft'); await wait(400); const r = JSON.parse(await ev('(()=>{const P=__car.PLAZA();const c=__car.CAR.car||{x:__wk.p.x,z:__wk.p.z};return JSON.stringify({on:__car.CAR.on,x:+(c.x-P.x).toFixed(2),z:+(c.z-P.z).toFixed(2)})})()')); await ev("__car.CAR.on && document.getElementById('carBtn').click()"); await wait(300); return r; };
  const c1 = await drive(10, -140, -Math.PI / 2, 3500); console.log('car east wall', c1); ok(c1.on && c1.x > -29, 'السيارة ما تخترق جدار المركز الشرقي (x=' + c1.x + ')');
  const c2 = await drive(-107, -125, Math.PI, 3000); console.log('car bars', c2); ok(c2.on && c2.z > -148.5, 'السيارة ما تدخل الزنزانة من القضبان (z=' + c2.z + ')');
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`); console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM'); setTimeout(() => process.exit(0), 800);
}
