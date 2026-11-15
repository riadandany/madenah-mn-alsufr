// اختبار إشعارات الجوال من البداية للنهاية: كروم يشترك فعلاً بخادم إشعارات قوقل (FCM)، والسيرفر يرسل عبره، والمتصفح يفك ويعرض
// node tests/madinah_pushui.mjs server.js   (يحتاج إنترنت؛ شغّله وحده)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [SERVER] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_jobsui_houses.json'), ADMIN = 'admintok-pushui', PORT = 3969, URL0 = `http://127.0.0.1:${PORT}/`;
for (const f of ['economy.json', 'jobs.json', 'push.json']) { try { fs.unlinkSync(path.join(HERE, f)); } catch {} }
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, PUSH_LOG: '1' }, stdio: ['ignore', 'pipe', 'inherit'] }); srv.stdout.on('data', d => process.stdout.write('[srv] ' + d));
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9359', '--user-data-dir=' + path.join(HERE, 'chrome-prof-push'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra && !c ? '  → ' + extra : '')); };
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: 'http://127.0.0.1:' + PORT, 'X-Forwarded-For': '10.8.1.7' } });
    q.on('upgrade', (r, sock) => { const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } else if (len === 127) { len = Number(c.buf.readBigUInt64BE(2)); off = 10; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { try { c.inbox.push(JSON.parse(s)); } catch {} } } });
      sock.on('error', () => {}); res(c); });
    q.end();
  });
}
try {
  let tgt; for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9359/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result || d.error); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Browser.grantPermissions', { origin: URL0.slice(0, -1), permissions: ['notifications'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx');localStorage.setItem('mnalsifr_jobnote','x')}catch{}" });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  await send('Page.navigate', { url: URL0 }); for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; } await wait(1500);
  ok(await ev("!!document.getElementById('push16')"), 'زر الإشعارات بالإعدادات موجود');
  ok(/فعّل/.test(await ev("document.getElementById('push16').textContent")), 'الزر يقول «فعّل» قبل التفعيل');
  await ev("document.getElementById('push16').click()");
  let sub = null; for (let k = 0; k < 40 && !sub; k++) { await wait(500); sub = await ev("navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>s&&s.endpoint)"); }
  ok(sub && /^https:\/\//.test(sub), 'كروم اشترك بخادم الإشعارات', String(sub));
  ok(await (async () => { for (let k = 0; k < 20; k++) { if (/شغّالة/.test(await ev("document.getElementById('push16').textContent"))) return true; await wait(300); } return false; })(), 'الزر صار «الإشعارات شغّالة» (السيرفر أكّد الاشتراك)');
  // صاحب المدينة (نفس الجهاز) يرسل «إشعار تجربة» → يمر عبر FCM → عامل الخدمة يستلمه ويفكه
  const AD = await client(); AD.send({ t: 'hi', d: 'devOWN-xxxxxxxx' }); await wait(400); AD.send({ t: 'admin', k: ADMIN }); await wait(400); AD.send({ t: 'pt' });
  let got = null; for (let k = 0; k < 40 && !got; k++) { await wait(500); got = await ev('window.__lastPush||null'); }
  ok(got && /تجربة/.test(got.b), 'الإشعار وصل عبر قوقل والمتصفح فك تشفيره (التشفير والتوقيع مقبولين)', JSON.stringify(got));
  // الإلغاء
  await ev("document.getElementById('push16').click()"); await wait(1500);
  ok(!(await ev("navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>!!s)")) && /فعّل/.test(await ev("document.getElementById('push16').textContent")), 'قفل الإشعارات يلغي الاشتراك');
  AD.sock.destroy();
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`); console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM'); setTimeout(() => process.exit(0), 800);
}
