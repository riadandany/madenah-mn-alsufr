// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_gaccui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3975, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', PUBLIC_URL: URL0.slice(0, -1), GOOGLE_AUTH_URL: 'http://127.0.0.1:3999/auth' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9349', '--user-data-dir=' + path.join(HERE, 'chrome-prof-gaccui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9349/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  const txt = id => ev(`document.getElementById('${id}').innerText`);
  const vis = id => ev(`getComputedStyle(document.getElementById('${id}')).display!=='none'`);
  await wait(12000); ok(await ev("document.getElementById('wSet').classList.contains('warn')"), 'علامة التعجب على زر الإعدادات');
  ok(/غير مربوط/.test(await txt('toast')) && !!(await ev("localStorage.getItem('mnalsifr_gnote')")), 'إشعار يومي بالتوست + تسجيل اليوم', await txt('toast'));
  await shot('g0_badge.png');
  await click('wSet'); await wait(800);
  ok(await vis('g16') && /حسابك غير مربوط/.test(await txt('g16')) && /ربط الحساب بقوقل/.test(await txt('g16')) && await vis('g16b'), 'الإعدادات: قسم توثيق الحساب + زر الربط');
  await shot('g1_settings.png'); await click('close16');
  await ev(`document.getElementById('p10').style.display='block'`); await ev(`document.getElementById('wlG').style.display`);
  await click('wSet'); await click('close16'); await wait(300);
  await ev(`(async()=>{await fetch('/api/g/status',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"device":"x"}'});})()`);
  ok(await ev(`document.getElementById('wlG').style.display`) === '', 'لوحة الترحيب: زر «سجّل بقوقل» ظاهر');
  const order = await ev(`[...document.querySelectorAll('#p10 .stack button')].map(b=>b.id).join(',')`); ok(order.startsWith('wlG,'), 'خيار قوقل أول خيار', order);
  await shot('g2_welcome.png');
  await ev(`document.getElementById('g16b').click()`); await wait(1500);
  const href = await ev('location.href'); ok(/127\.0\.0\.1:3999\/auth\?/.test(href) && /client_id=cid/.test(href) && /state=/.test(href), 'الضغط يحوّلني لصفحة قوقل بالـstate', href.slice(0, 90));
  await send('Page.navigate', { url: URL0 + '?g=moved' }); for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; } await wait(4500);
  ok(/رجع لك بيتك/.test(await txt('toast')) && !/g=/.test(await ev('location.search')), 'الرجوع من قوقل: رسالة + تنظيف الرابط', await txt('toast'));
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
