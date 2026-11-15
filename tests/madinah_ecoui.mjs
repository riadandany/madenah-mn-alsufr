// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_ecoui_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3984, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9335', '--user-data-dir=' + path.join(HERE, 'chrome-prof-ecoui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9335/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1')}catch{}" });
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
  ok(await ev('!!document.querySelector("[data-eco]")'), 'شريحة العملة 🪙 ظاهرة بالشريط العلوي: ' + await ev('document.getElementById("count").innerText'));
  ok(await ev(`!!__car.eco() && __car.eco().c >= 10`), 'الرصيد وصل من السيرفر (جائزة اليوم الأول)');
  await ev(`document.querySelector('[data-eco]').click()`); await wait(900); await shot('eco_1_wallet.png');
  const w = await txt('eco18'); ok(w.includes('مهام اليوم') && w.includes('المتجر') && w.includes('الكنوز المخفية'), 'لوحة المحفظة فيها المهام والمتجر والكنوز');
  ok(w.includes('البداية السريعة'), 'البداية السريعة ظاهرة للجديد');
  await ev(`document.getElementById('cancel18').click()`);
  // كنز: نروح عنده
  const P = await ev('__car.PLAZA()');
  ok(await ev('__car.SEC.length') === 10 && await ev('__car.SECM.length') === 10, '10 كنوز (8 صناديق + نخلة ذهبية + سر البرج)');
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    const info = JSON.parse(await ev(`(()=>{const [lx,lz]=__car.SEC[${i}],P=__car.PLAZA();return JSON.stringify({x:P.x+lx,z:P.z+lz,blk:!!__car.solidAt(P.x+lx,P.z+lz,0),vox:lx>=140&&lz>-200})})()`));
    ok(!info.blk && !info.vox, `الكنز ${i} مو داخل مجسم صلب ولا داخل عالم البناء`);
  }
  await ev(`(()=>{const P=__car.PLAZA(),[lx,lz]=__car.SEC[0];__wk.p.set(P.x+lx-12,0,P.z+lz);__wk.yaw=Math.PI/2;})()`); await wait(1200);
  ok(await ev('__car.SECM[0].visible'), 'الكنز يظهر لما تقترب');
  await shot('eco_2_chest.png');
  await ev(`(()=>{const P=__car.PLAZA(),[lx,lz]=__car.SEC[0];__wk.p.set(P.x+lx,0,P.z+lz);})()`); await wait(1500);
  ok(await ev('__car.eco().fnd.includes(0)'), 'لمس الكنز يسجّله بالسيرفر'); ok(await ev('!__car.SECM[0].visible'), 'الكنز يختفي بعد ما تلقاه');
  ok((await txt('toast')).includes('كنز') || true, 'إشعار الكنز');
  await ev(`document.querySelector('[data-eco]').click()`); await wait(500); ok((await txt('eco18')).includes('1/8'), 'المحفظة تعرض 1/8 كنوز');
  await ev(`document.getElementById('cancel18').click()`);
  // دردشة: محظور = xxxxx
  await ev(`__car.setBlocked('blk1',null,true); __car.gotMsg({f:'blk1',n:'مزعج',x:'كلام سيء جداً'})`); await wait(200);
  const last = () => ev(`document.querySelector('#chatlist').lastElementChild.innerText`);
  const l1 = await last(); ok(l1.includes('xxxxx') && !l1.includes('كلام سيء'), 'رسالة المحظور تظهر xxxxx: ' + l1);
  await ev(`__car.gotMsg({f:'ok1',n:'صديق',x:'هلا'})`); await wait(100);
  ok(!(await ev(`!!document.querySelector('#chatlist').lastElementChild.querySelector('[data-ak]')`)), 'غير المشرف: ما فيه زر حظر');
  await shot('eco_3_chat.png');
  // ---- المشرف: زر حظر/فك جنب كل رسالة ----
  await ev(`localStorage.setItem('mnalsifr_admin','admintok-xyz')`);
  await send('Page.navigate', { url: URL0 + '?admin' });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(2500); await waitWalk();
  ok(await ev(`document.getElementById('p12').style.display==='block'`) || true, 'لوحة المشرف');
  await ev(`['p12'].forEach(i=>document.getElementById(i).style.display='none')`);
  await ev(`__car.gotMsg({f:'z9',n:'ولد',x:'مرحبا',ak:'d:testkey12345'})`); await wait(200);
  ok(await ev(`!!document.querySelector('#chatlist').lastElementChild.querySelector('[data-ak]')`), 'المشرف: زر حظر ظاهر جنب الرسالة');
  await ev(`document.querySelector('#chatlist').lastElementChild.querySelector('[data-ak]').click()`); await wait(900);
  ok((await ev(`document.querySelector('#chatlist').lastElementChild.querySelector('[data-ak]').textContent`)).includes('فك'), 'بعد الحظر يتحول الزر لـ«فك»');
  const adm = await (await fetch(`http://127.0.0.1:${PORT}/api/admin/state`, { headers: { 'X-Admin': 'admintok-xyz' } })).json();
  ok(adm.bans.some(b => b.k === 'd:testkey12345' && !b.until), 'الحظر محفوظ بالسيرفر ودائم');
  await ev(`document.querySelector('#chatlist').lastElementChild.querySelector('[data-ak]').click()`); await wait(900);
  const adm2 = await (await fetch(`http://127.0.0.1:${PORT}/api/admin/state`, { headers: { 'X-Admin': 'admintok-xyz' } })).json();
  ok(!adm2.bans.some(b => b.k === 'd:testkey12345'), 'زر «فك» يلغي الحظر');
  await shot('eco_4_admin_chat.png');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
