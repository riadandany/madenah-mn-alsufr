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
const PORT = 3990, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chromes = [9333, 9334].map(port => spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(HERE, 'chrome-prof-blk-' + port), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' }));
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
  await A.ev(`localStorage.clear();localStorage.setItem('mnalsifr_dev','${OWNER.dev}');localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1')`);
  await B.send('Page.navigate', { url: `http://localhost:${PORT}/vendor/OrbitControls.js` }); await wait(400);
  await B.ev(`localStorage.clear();localStorage.setItem('mnalsifr_name','سالم');localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1')`);
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }); await B.send('Page.navigate', { url: `http://localhost:${PORT}/` });
  console.log('loaded:', await A.loaded(), await B.loaded());
  await wait(5500);
  const seen = T => T.ev('JSON.stringify([...__net.PEERS.values()].map(p=>({n:p.n,h:!!p.h})))');
  console.log('B sees:', await seen(B), '| A sees:', await seen(A));
  const say = async (T, text) => { await T.ev(`document.getElementById('wChat').click()`); await wait(200); await T.ev(`document.getElementById('say7').value=${JSON.stringify(text)};document.getElementById('send7').click()`); await wait(1500); };
  const inbox = T => T.ev(`getComputedStyle(document.getElementById('inbox')).display+' | '+document.getElementById('inbox').innerText.replace(/\\n/g,' ')`);
  // قبل الحظر: رسالة A توصل لـB
  await say(A, 'مرحبا سالم'); console.log('before block, B inbox:', await inbox(B));
  await B.ev(`document.getElementById('inbox').style.display='none'`);
  // B يحظر A من نافذة الرسائل
  await B.ev(`document.getElementById('wPeople').click()`); await wait(200); await B.ev(`document.querySelector('#ppl [data-id]').click()`); await wait(300);
  console.log('B button label before:', await B.ev(`document.getElementById('mute7').textContent`));
  await B.ev(`document.getElementById('mute7').click()`); await wait(800);
  console.log('B toast:', await B.ev(`document.getElementById('toast').textContent`));
  console.log('saved blocked list:', await B.ev(`localStorage.getItem('mnalsifr_blocked')`), '| owner house id:', OWNER.id);
  await B.ev(`(()=>{const p=[...__net.PEERS.values()][0];__wk.camYaw=Math.atan2(__wk.p.x-p.x,__wk.p.z-p.z);__wk.dist=14;__wk.cur=14;__wk.pitch=.2})()`); await wait(1500);
  await B.shot('blk_B_label.png');
  // A يرسل بعد الحظر → ما توصل
  await say(A, 'ليش حظرتني؟'); console.log('after block, B inbox (should be hidden):', await inbox(B));
  console.log('B people list:', (await B.ev(`(()=>{document.getElementById('wPeople').click();return document.getElementById('ppl').innerText})()`)).replace(/\n/g, ' | '));
  await B.ev(`document.getElementById('cancel8').click()`);
  // إعادة تحميل B: الحظر يثبت
  await B.send('Page.navigate', { url: `http://localhost:${PORT}/` }); await B.loaded(); await wait(5500);
  await say(A, 'جرّب مرة ثانية'); console.log('after reload, B inbox (should be hidden):', await inbox(B));
  // فك الحظر
  await B.ev(`document.getElementById('wPeople').click()`); await wait(200); await B.ev(`document.querySelector('#ppl [data-id]').click()`); await wait(300);
  console.log('B button label now:', await B.ev(`document.getElementById('mute7').textContent`));
  await B.ev(`document.getElementById('mute7').click()`); await wait(600);
  console.log('B toast:', await B.ev(`document.getElementById('toast').textContent`), '| saved list:', await B.ev(`localStorage.getItem('mnalsifr_blocked')`));
  await say(A, 'رجعنا أصحاب'); console.log('after unblock, B inbox:', await inbox(B));
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  for (const c of chromes) spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
