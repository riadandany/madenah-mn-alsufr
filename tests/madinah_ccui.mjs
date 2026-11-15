// اختبار واجهة مركز الشكاوي 📨 + تقرير الإحصاءات بلوحة المشرف
// node tests/madinah_ccui.mjs server.js <مجلد_الصور>   (شغّله وحده؛ احذف tests/chrome-prof-ccui قبله)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_ccui_houses.json'), ADMIN = 'admintok-ccui';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'craft.json', 'stats.json']) { try { fs.unlinkSync(path.join(HERE, f)); } catch {} }
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3979, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, THIEF_MIN: '999', ST_MIN_MS: '2000' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
// لاعب ثاني (Node) = الأدمن/شخص قريب
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: 'http://127.0.0.1:' + PORT, 'X-Forwarded-For': '10.9.' + (ipN++) + '.7' } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } else if (len === 127) { len = Number(c.buf.readBigUInt64BE(2)); off = 10; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { try { c.inbox.push(JSON.parse(s)); } catch {} } } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9357', '--user-data-dir=' + path.join(HERE, 'chrome-prof-ccui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra && !c ? '  → ' + extra : '')); };
let AD = null, NB = null, keep = null;
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9357/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx');localStorage.setItem('mnalsifr_jobnote','x');localStorage.setItem('mnalsifr_admin','admintok-ccui')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { if (!OUTDIR) return; const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const waitWalk = async () => { for (let k = 0; k < 40; k++) { if (await ev('__wk.on&&!__wk.intro')) return; await wait(400); } };
  const until = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await wait(250); } return false; };
  await send('Page.navigate', { url: URL0 });
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(1500); await waitWalk();
  const vis = id => ev(`(()=>{const e=document.getElementById('${id}');return !!e&&getComputedStyle(e).display!=='none';})()`);
  const txt = id => ev(`(()=>{const e=document.getElementById('${id}');return e?e.innerText:'';})()`);
  const badge = () => ev(`(()=>{const b=document.querySelector('#count [data-cc]');if(!b)return null;const i=b.querySelector('i');return i?+i.textContent:0;})()`);
  
  // ندخل كمشرف: لوحة المشرف (الرمز محفوظ) ثم نقفلها
  await ev(`(()=>{const c=document.getElementById('count');c.dispatchEvent(new PointerEvent('pointerdown'));return 1;})()`); await wait(1800);
  ok(await until(`/إحصاءات اللعب/.test(document.getElementById('adminMain').innerText)`, 9000), 'لوحة المشرف فيها تقرير الإحصاءات', (await txt('adminMain')).slice(0, 200));
  ok(await ev(`!!document.getElementById('ccOpen')`) && !/📋 البلاغات\n/.test(await txt('adminMain')), 'قائمة البلاغات القديمة صارت زر «مركز الشكاوي»');
  await shot('cc_admin.png');
  await ev("document.getElementById('cancel12').click()");
  ok(await until(`!!document.querySelector('#count [data-cc]')`, 9000), 'بعد دخول المشرف: زر 📨 ظهر فوق');
  // لاعب عنده بيت يكتب ثم ينبلّغ عنه من جهازين
  const X = await client(); X.send({ t: 'hi', d: 'dev5-xxxxxxxx' }); await wait(400); X.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); await wait(300);
  const xid = [...X.inbox].reverse().find(m => m.t === 'me').id; X.send({ t: 'say', k: 2 }); await wait(1300); X.send({ t: 'say', x: 'رسالة الدليل' }); await wait(300);
  const rep = (dev, reason) => fetch(URL0 + 'api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.4.' + (ipN++) + '.1' }, body: JSON.stringify({ device: dev, peer: xid, reason }) });
  await rep('dev7-xxxxxxxx', 0); await rep('dev8-xxxxxxxx', 2);
  ok(await until(`(document.querySelector('#count [data-cc] i')||{}).textContent==='1'`, 7000), 'الرقم 1 على الزر بعد البلاغ', await badge());
  await ev(`document.querySelector('#count [data-cc]').click()`); await wait(900);
  ok(await vis('p42') && /بيت5/.test(await txt('ccBody')) && /🚩 2/.test(await txt('ccBody')), 'المركز يفتح وفيه البطاقة وعدد البلاغات', await txt('ccBody'));
  ok(/كلام سيء/.test(await txt('ccBody')) && /يطلب أرقام/.test(await txt('ccBody')) && /رسالة الدليل/.test(await txt('ccBody')), 'الأسباب والدليل ظاهرين');
  ok(/هلا والله/.test(await txt('ccBody')) && /📍 كان وقت البلاغ/.test(await txt('ccBody')) && /✍️ مكتوبة/.test(await txt('ccBody')) && await ev("document.querySelectorAll('#ccBody .ev-s').length===1&&document.querySelectorAll('#ccBody .ev-w').length===1"), 'الدليل: الجاهزة بنصها + المكتوبة + المكان + شرح العلامات', await txt('ccBody'));
  ok(await ev(`!!document.querySelector('#ccBody [data-cca="ban"][data-m="0"]')&&!!document.querySelector('#ccBody [data-cca="kick"]')&&!!document.querySelector('#ccBody [data-cca="delh"]')`), 'صاحب المدينة عنده: للأبد + طرد + حذف البيت');
  await shot('cc_reports.png');
  ok(!/🏠s*[0-9٠-٩]/.test(await txt('count')), 'عدد البيوت انشال من الشريط فوق', await txt('count'));
  const sureTxt = () => ev("(()=>{const b=document.getElementById('sureBox');return b&&b.style.display==='flex'?b.innerText:'';})()");
  await ev(`document.querySelector('#ccBody [data-cca="ban"][data-m="60"]').click()`); await wait(300);
  ok(/هل أنت متأكد من حظر/.test(await sureTxt()) && /«بيت5»/.test(await sureTxt()) && /ساعة/.test(await sureTxt()), 'الحظر يسأل: هل أنت متأكد من حظر «بيت5» … ساعة؟', await sureTxt());
  await shot('cc_sure.png');
  await ev("document.querySelector('#sureBox [data-sy=\"0\"]').click()"); await wait(700);
  ok(!(await sureTxt()) && /🚩 2/.test(await txt('ccBody')), 'إلغاء = ما صار شي');
  await ev(`document.querySelector('#ccBody [data-cca="delh"]').click()`); await wait(300); ok(/حذف بيت/.test(await sureTxt()) && /«بيت5»/.test(await sureTxt()), 'حذف البيت يسأل بالاسم', await sureTxt()); await ev("document.querySelector('#sureBox [data-sy=\"0\"]').click()"); await wait(300);
  await ev(`document.querySelector('#ccBody [data-cca="ban"][data-m="60"]').click()`); await wait(300); await ev("document.querySelector('#sureBox [data-sy=\"1\"]').click()");
  ok(await until(`/ما فيه بلاغات مفتوحة/.test(document.getElementById('ccBody').innerText)`, 5000), 'بعد الحظر ساعة: البلاغ انقفل');
  ok(await until(`!document.querySelector('#count [data-cc] i')`, 6000), 'الرقم راح من الزر', await badge());
  // التظلّم
  X.send({ t: 'bap' });
  ok(await until(`(document.querySelector('#count [data-cc] i')||{}).textContent==='1'`, 7000), 'التظلّم رجّع الرقم 1');
  ok(await until(`/التظلّمات\\s*1/.test(document.getElementById('ccTabs').innerText)`, 6000), 'تبويب التظلّمات عليه 1 (اللوحة تتحدّث وهي مفتوحة)', await txt('ccTabs'));
  await ev(`document.querySelector('#ccTabs [data-cct="b"]').click()`); await wait(300);
  ok(/بيت5/.test(await txt('ccBody')) && /حظره من الصفر/.test(await txt('ccBody')), 'بطاقة التظلّم فيها الاسم واللي حظره', await txt('ccBody'));
  await shot('cc_appeal.png');
  X.inbox.length = 0; await ev(`document.querySelector('#ccBody [data-cca="unb"]').click()`); await wait(900);
  ok(X.inbox.some(m => m.t === 'bn' && m.on === 0), 'فك الحظر وصل للشخص');
  await ev(`document.querySelector('#ccTabs [data-cct="h"]').click()`); await wait(300);
  ok(/فك الحظر/.test(await txt('ccBody')) && /حظر من الكتابة ساعة/.test(await txt('ccBody')), 'السجل فيه الإجراءين', await txt('ccBody'));
  await shot('cc_hist.png');
  await ev("document.getElementById('cancel42').click()"); ok(!(await vis('p42')), 'إغلاق المركز');
  ok(!errors.length, 'بدون أخطاء بالصفحة', JSON.stringify(errors));
  X.sock.destroy();
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
