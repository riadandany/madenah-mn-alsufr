// اختبار اللعب المباشر: نافذتين (صاحب بيت على 127.0.0.1 + زائر «سالم» على localhost) يشوفون بعض ويتراسلون
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_mp_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
// صاحب البيت قريب من البرج حتى يشوف الزائر من أول
const OWNER = base.filter(h => h.plot < 8).find(h => h.type !== 2) || base[0];
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3996;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chromes = [9333, 9334].map(port => spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(HERE, 'chrome-prof-' + port), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' }));
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
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push(label + ' LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const key = async (code, ms) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code }); await wait(ms); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code }); };
  const loaded = async () => { for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) return true; } return false; };
  return { send, ev, shot, key, loaded, ws };
}
try {
  const A = await tab('A', 9333), B = await tab('B', 9334);
  // A: صاحب بيت (127.0.0.1)
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/vendor/OrbitControls.js` }); await wait(400);
  await A.ev(`localStorage.clear();localStorage.setItem('mnalsifr_dev','${OWNER.dev}')`);
  // B: زائر اسمه سالم (localhost = تخزين مختلف)
  await B.send('Page.navigate', { url: `http://localhost:${PORT}/vendor/OrbitControls.js` }); await wait(400);
  await B.ev(`localStorage.clear();localStorage.setItem('mnalsifr_name','سالم')`);
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }); await B.send('Page.navigate', { url: `http://localhost:${PORT}/` });
  console.log('loaded A/B:', await A.loaded(), await B.loaded(), '| owner house:', OWNER.name, 'plot', OWNER.plot);
  await wait(4000);
  await B.ev(`document.getElementById('walk').click()`); await wait(4500);
  console.log('A me:', await A.ev('JSON.stringify({id:__net.NET.id,n:__net.NET.name,on:__net.NET.on})'), '| B me:', await B.ev('JSON.stringify({id:__net.NET.id,n:__net.NET.name,on:__net.NET.on})'));
  const seen = async (T) => T.ev('JSON.stringify([...__net.PEERS.values()].map(p=>({n:p.n,c:p.c,h:!!p.h,x:+p.x.toFixed(1),z:+p.z.toFixed(1)})))');
  console.log('A sees:', await seen(A)); console.log('B sees:', await seen(B));
  console.log('count A:', await A.ev(`document.getElementById('count').textContent`));
  // B يمشي → A يشوفه يتحرك
  const before = await seen(A); await B.key('KeyW', 2000); await wait(600); console.log('A sees B moved:', before, '→', await seen(A));
  // A يرسل «من وين أنت؟» لـ B عن طريق قائمة 👥
  await A.ev(`document.getElementById('wPeople').click()`); await wait(300);
  console.log('A people list:', await A.ev(`document.getElementById('ppl').innerText`));
  await A.ev(`document.querySelector('#ppl [data-id]').click()`); await wait(300);
  await A.shot('mp_A_talk.png');
  await A.ev(`document.querySelector('#says [data-k="4"]').click()`); await wait(1200);
  console.log('B inbox:', await B.ev(`getComputedStyle(document.getElementById('inbox')).display+' | '+document.getElementById('inbox').innerText`));
  await B.shot('mp_B_got.png');
  await wait(1300); await A.ev(`document.getElementById('wChat').click()`); await wait(300); await A.ev(`document.getElementById('say7').value='هلا والله كيف الحال؟ تعالوا عند البرج نلعب'; document.getElementById('send7').click()`); await wait(1500);
  console.log('A typed toast:', await A.ev(`document.getElementById('toast').textContent`), '| B inbox typed:', await B.ev(`document.getElementById('inbox').innerText`));
  await B.shot('mp_B_typed.png');
  await wait(1300); await A.ev(`document.getElementById('wChat').click()`); await wait(300); await A.ev(`document.getElementById('say7').value='ضيفني سناب abc'; document.getElementById('send7').click()`); await wait(1200);
  console.log('A blocked toast:', await A.ev(`document.getElementById('toast').textContent`), '| panel still open:', await A.ev(`document.getElementById('p7').style.display`)); await A.ev(`document.getElementById('cancel7').click()`); await wait(1300);
  // B يرد «أنا من …» → السعودية
  await B.ev(`document.querySelector('#inbox button').click()`); await wait(300);
  await B.ev(`document.querySelector('#says [data-k="6"]').click()`); await wait(300);
  await B.shot('mp_B_countries.png');
  await B.ev(`window.__sent=[];const _s=WebSocket.prototype.send;WebSocket.prototype.send=function(d){if(d.includes('say'))window.__sent.push(d);return _s.call(this,d)}`); await B.ev(`document.querySelector('#countries [data-a="0"]').click()`); await wait(300); console.log('B toast:', await B.ev(`document.getElementById('toast').textContent+' op='+document.getElementById('toast').style.opacity`), 'B sent:', await B.ev('JSON.stringify(window.__sent)'), 'B TALK peers:', await B.ev('JSON.stringify([...__net.PEERS.keys()])')); await wait(900);
  console.log('A inbox:', await A.ev(`document.getElementById('inbox').innerText`));
  await A.shot('mp_A_got.png');
  // سرعة: رسالتين ورا بعض
  await B.ev(`document.querySelector('#inbox')?.style.setProperty('display','none')`);
  // كتم: A يكتم B، وB يرسل مرحبا → ما توصل
  await A.ev(`(()=>{const id=[...__net.PEERS.keys()][0];openTalk;})()`).catch(() => {});
  await A.ev(`document.getElementById('wPeople').click()`); await wait(200); await A.ev(`document.querySelector('#ppl [data-id]').click()`); await wait(200);
  await A.ev(`document.getElementById('mute7').click()`); await wait(1500);
  await A.ev(`document.getElementById('inbox').style.display='none'`);
  await B.ev(`document.getElementById('wPeople').click()`); await wait(200); await B.ev(`document.querySelector('#ppl [data-id]').click()`); await wait(200);
  await B.ev(`document.querySelector('#says [data-k="0"]').click()`); await wait(1200);
  console.log('A inbox after mute (should be hidden):', await A.ev(`getComputedStyle(document.getElementById('inbox')).display`));
  // B يقفل الصفحة → يختفي عند A
  await B.send('Page.navigate', { url: 'about:blank' }); await wait(2500);
  console.log('A sees after B left:', await seen(A));
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  for (const c of chromes) spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
