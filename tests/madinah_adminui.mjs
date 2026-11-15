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
const PORT = 3988, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintoken1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chromes = [9333, 9334].map(port => spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(HERE, 'chrome-prof-adm-' + port), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' }));
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
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }); await B.send('Page.navigate', { url: `http://localhost:${PORT}/` });
  console.log('loaded:', await A.loaded(), await B.loaded()); await wait(5500);
  const say = async (T, text) => { await T.ev(`document.getElementById('wChat').click()`); await wait(200); await T.ev(`document.getElementById('say7').value=${JSON.stringify(text)};document.getElementById('send7').click()`); await wait(1500); };
  const toastOf = T => T.ev(`document.getElementById('toast').textContent`);
  await say(B, 'مرحبا يا احمد كيف حالك');
  // ===== التبليغ من A =====
  await A.ev(`document.getElementById('wPeople').click()`); await wait(200); await A.ev(`document.querySelector('#ppl [data-id]').click()`); await wait(300);
  console.log('report button visible:', await A.ev(`getComputedStyle(document.getElementById('rep7')).display`));
  await A.ev(`document.getElementById('rep7').click()`); await wait(300);
  console.log('reasons panel:', await A.ev(`document.getElementById('p13').style.display`), '|', await A.ev(`document.getElementById('p13t').textContent`), '| reasons:', await A.ev(`document.querySelectorAll('#reasons button').length`));
  await A.shot('adm_1_report.png');
  await A.ev(`document.querySelector('#reasons [data-r="2"]').click()`); await wait(1200);
  console.log('after report toast:', await toastOf(A), '| B now blocked at A:', await A.ev(`(()=>{document.getElementById('wPeople').click();const t=document.getElementById('ppl').innerText;document.getElementById('cancel8').click();return t.replace(/\n/g,' ')})()`));
  // ===== دخول المشرف (ضغط مطوّل على العدّاد) =====
  await A.ev(`document.getElementById('count').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`); await wait(1900);
  console.log('admin panel opened by long press:', await A.ev(`document.getElementById('p12').style.display`), '| login visible:', await A.ev(`document.getElementById('adminLogin').style.display`));
  await A.ev(`document.getElementById('adminTok').value='wrong-code';document.getElementById('adminGo').click()`); await wait(1200);
  console.log('wrong code msg:', await A.ev(`document.getElementById('msg12').textContent`), '| still login:', await A.ev(`document.getElementById('adminLogin').style.display`));
  await A.ev(`document.getElementById('adminTok').value='admintoken1';document.getElementById('adminGo').click()`); await wait(1500);
  console.log('main visible:', await A.ev(`document.getElementById('adminMain').style.display`));
  const txt = await A.ev(`document.getElementById('adminMain').innerText`); console.log('admin shows B + evidence:', /سالم/.test(txt), /مرحبا يا احمد/.test(txt), /يطلب أرقام/.test(txt));
  await A.shot('adm_2_panel.png');
  // منع B
  await A.ev(`document.querySelector('#adminMain [data-a="ban"]').click()`); await wait(1200);
  console.log('after ban, panel marks banned:', /ممنوع/.test(await A.ev(`document.getElementById('adminMain').innerText`)));
  await say(B, 'هل أقدر أكتب'); console.log('B toast when banned:', await toastOf(B));
  await A.ev(`document.querySelector('#adminMain [data-a="unban"]').click()`); await wait(1200);
  await say(B, 'رجعت أكتب'); console.log('B toast after unban:', await toastOf(B));
  // طرد + تجاهل
  await A.ev(`document.querySelector('#adminMain [data-a="dismiss"]').click()`); await wait(1200);
  console.log('after dismiss reports:', /ما فيه بلاغات جديدة/.test(await A.ev(`document.getElementById('adminMain').innerText`)));
  // خروج ثم ?admin
  await A.ev(`document.getElementById('adminOut').click()`); await wait(300); console.log('logged out → login shown:', await A.ev(`document.getElementById('adminLogin').style.display`));
  await A.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?admin` }); await A.loaded(); await wait(2500);
  console.log('?admin opens panel:', await A.ev(`document.getElementById('p12').style.display`), '| welcome hidden:', await A.ev(`document.getElementById('p10').style.display`));
} finally {
  console.log('errors:', errors.length ? errors : 'none');
  for (const c of chromes) spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
