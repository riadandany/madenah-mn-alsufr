// اختبار الحظر: A صاحب بيت، B زائر. B يحظر A → رسايل A ما توصل، «محظور» يطلع، يثبت بعد إعادة التحميل، وفك الحظر يرجّعها
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_block_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
const OWNER = base.find(h => h.type === 1);
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3987, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintoken1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chromes = [9333, 9334].map(port => spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(HERE, 'chrome-prof-own-' + port), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' }));
const wait = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
async function tab(label, port) {
  let t;
  for (let k = 0; k < 40 && !t; k++) { await wait(300); try { t = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(x => x.type === 'page'); } catch {} }
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(label + ' EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(label + ' ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errors.push(label + ' LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const loaded = async () => { for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) return true; } return false; };
  return { send, ev, shot, loaded };
}
try {
  const A = await tab('A', 9333), B = await tab('B', 9334);
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/vendor/OrbitControls.js` }); await wait(400);
  await A.ev(`localStorage.clear();sessionStorage.clear();localStorage.setItem('mnalsifr_name','احمد');localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1')`);
  await B.send('Page.navigate', { url: `http://localhost:${PORT}/vendor/OrbitControls.js` }); await wait(400);
  await B.ev(`localStorage.clear();localStorage.setItem('mnalsifr_name','سالم');localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1')`);
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?admin` }); await B.send('Page.navigate', { url: `http://localhost:${PORT}/` });
  console.log('loaded:', await A.loaded(), await B.loaded()); await wait(5000);
  await A.ev(`document.getElementById('adminTok').value='admintoken1';document.getElementById('adminGo').click()`); await wait(2500);
  await A.ev(`document.getElementById('cancel12').click()`); await wait(500);
  console.log('A walker key (char:hat:back):', await A.ev('__wk.walker.key'), '| toast:', await A.ev(`document.getElementById('toast').textContent`));
  await wait(3000);
  console.log('B sees A as:', await B.ev(`JSON.stringify([...__net.PEERS.values()].map(p=>({n:p.n,c:p.c,hat:p.hat,back:p.back,tag:p.tag})))`));
  console.log('B people list:', (await B.ev(`(()=>{document.getElementById('wPeople').click();const t=document.getElementById('ppl').innerText;document.getElementById('cancel8').click();return t})()`)).split(String.fromCharCode(10)).join(' | '));
  // B يوقف قدّام A ويطالعه
  await A.ev(`(()=>{__wk.p.set(0,0,262);__wk.yaw=0;__wk.camYaw=Math.PI;__wk.dist=9;__wk.cur=9;__wk.pitch=.25})()`); await wait(900);
  await B.ev(`(()=>{__wk.p.set(0,0,268);__wk.yaw=Math.PI;__wk.camYaw=0;__wk.dist=7;__wk.cur=7;__wk.pitch=.12})()`); await wait(2500);
  await B.shot('own_B_sees_owner.png'); await A.shot('own_A_self_back.png');
  await A.ev(`__wk.camYaw=0;__wk.dist=7;__wk.cur=7;__wk.pitch=.12`); await wait(1800); await A.shot('own_A_self_front.png');
  // خروج المشرف: يرجع شخصية عادية
  await A.ev(`document.getElementById('count').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`); await wait(1900);
  await A.ev(`document.getElementById('adminOut').click()`); await wait(300); await A.ev(`document.getElementById('cancel12').click()`); await wait(3500);
  console.log('after admin logout A key:', await A.ev('__wk.walker.key'), '| B sees:', await B.ev(`JSON.stringify([...__net.PEERS.values()].map(p=>p.n))`));
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  for (const c of chromes) spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
