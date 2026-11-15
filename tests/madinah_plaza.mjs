// اختبار الساحة والسيارات: تمشّى → الساحة، اركب سيارة، سوق ولف، انزل، زر 🏠 يسأل الساحة/البيت
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_plaza_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3993, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(HERE, 'chrome-prof-plaza'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
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
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const down = code => send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code }), up = code => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code });
  const pos = () => ev('JSON.stringify({x:+__wk.p.x.toFixed(1),z:+__wk.p.z.toFixed(1),y:+__wk.y.toFixed(2),car:__car.CAR.on,sp:+__car.CAR.speed.toFixed(1),yaw:+__wk.yaw.toFixed(2)})');
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(1500);
  console.log('title gone:', await ev(`!document.querySelector('.tag')`), '| count:', await ev(`document.getElementById('count').textContent`));
  await wait(3500); console.log('auto plaza on open:', await pos(), '| on:', await ev('__wk.on'), '| build btn:', await ev("getComputedStyle(document.getElementById('wBuild')).display")); await shot('plz_0_overview.png');
  await ev(`document.getElementById('walk').click()`); await wait(4500);
  console.log('plaza:', JSON.stringify(await ev('__car.PLAZA()')), '| player:', await pos());
  await shot('plz_1_arrive.png');
  await down('KeyW'); await wait(2500); await up('KeyW');
  console.log('walked toward fountain:', await pos());
  await shot('plz_2_fountain.png');
  // جنب السيارة الأولى
  await ev(`(()=>{const c=__car.PARKED[0];__wk.p.set(c.x+3.2,0,c.z);__wk.camYaw=-Math.PI/2;})()`); await wait(800);
  console.log('car button:', await ev(`getComputedStyle(document.getElementById('carBtn')).display+' | '+document.getElementById('carBtn').textContent`));
  await shot('plz_3_nearcar.png');
  await ev(`document.getElementById('carBtn').click()`); await wait(1500);
  console.log('in car:', await pos(), '| btn:', await ev(`document.getElementById('carBtn').textContent`));
  const c0 = await pos();
  await down('KeyW'); await wait(2500); console.log('driving:', await pos()); await down('KeyD'); await wait(1500); await up('KeyD'); await up('KeyW'); await wait(300);
  const c1 = await pos(); console.log('after drive+turn:', c1);
  await shot('plz_4_drive.png');
  // يصدم بالنافورة؟ نوجهه لها وندعس
  await ev(`(()=>{const c=__car.CAR.car,P=__car.PLAZA();c.x=P.x;c.z=P.z-30;c.yaw=0;})()`); await down('KeyW'); await wait(3000); await up('KeyW'); await wait(200);
  const c2 = await pos(); console.log('drove into fountain (should stop before ~z', (await ev('__car.PLAZA().z')) - 11, '):', c2);
  await shot('plz_5_fountain_crash.png');
  await ev(`document.getElementById('carBtn').click()`); await wait(800);
  console.log('left car:', await pos(), '| walker visible:', await ev('__wk.walker.root.visible'));
  await ev(`document.getElementById('wHome').click()`); await wait(400);
  console.log('p9 shown:', await ev(`document.getElementById('p9').style.display`), '| home btn:', await ev(`document.getElementById('goHome').textContent+' disabled='+document.getElementById('goHome').disabled`));
  await shot('plz_6_choose.png');
  await ev(`document.getElementById('goPlaza').click()`); await wait(800); console.log('back to plaza:', await pos());
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
