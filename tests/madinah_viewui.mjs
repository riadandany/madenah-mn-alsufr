// اختبار المنظر: الكاميرا (بعد/نظر لقدّام/النخل يحجب → تقرب)، الأزرار العائمة (☰ المزيد، تختفي بعالم البناء)، التوست والنصائح، أيقونات الأدوات والمجسّم باليد
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_viewui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3993, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz', PROT_R: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9363', '--user-data-dir=' + path.join(HERE, 'chrome-prof-viewui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9363/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__PROT_R=0;try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx');localStorage.setItem('mnalsifr_inst2',JSON.stringify({done:1}))}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { if (!OUTDIR) return; const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const waitWalk = async () => { for (let k = 0; k < 40; k++) { if (await ev('__wk.on&&!__wk.intro')) return; await wait(400); } };
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(1500); await waitWalk();
  const vis = id => ev(`(()=>{const e=document.getElementById('${id}');return !!e&&getComputedStyle(e).display!=='none';})()`);
  const vst = async () => JSON.parse(await ev(`JSON.stringify(__vox.state())`));
  const until = async (f, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await f()) return true; } catch {} await wait(500); } return false; };
  const goto = async (lx, lz, yaw) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+(${lx}),0,P.z+(${lz}));__wk.y=0.3;__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;__wk.lastDrag=performance.now()/1000+99;})()`); await wait(1800); };
  // الأزرار
  const shown = await ev(`[...document.querySelectorAll('#whud button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.id).join(',')`);
  ok(shown === 'wHome,wCar,wChat,wMore', 'الأزرار الظاهرة 4 بس: 🏠 🚗 💬 ☰', shown);
  await ev("document.getElementById('wMore').click()"); await wait(300);
  const more = await ev(`[...document.querySelectorAll('#whud .w2')].filter(b=>getComputedStyle(b).display!=='none').length`); ok(more === 5, '☰ يفتح الخمسة الباقية', more);
  await ev("document.getElementById('wSet').click()"); await wait(400); ok(await vis('p16') && !(await ev("document.body.classList.contains('whMore')")), 'الضغط على ⚙️ يفتح الإعدادات ويقفل القائمة');
  await ev("document.getElementById('close16').click()");
  ok(await ev(`(()=>{const b=document.querySelector('#whud button').getBoundingClientRect();return b.width<=44.5})()`), 'الأزرار أصغر (44)');
  // التوست
  ok(await ev(`parseFloat(getComputedStyle(document.getElementById('toast')).fontSize)<=13.6`), 'التوست خطه أصغر');
  // الكاميرا: البعد الافتراضي + النظر لقدّام
  ok(await ev('__wk.dist') === 12.5, 'بعد الكاميرا 12.5 بالجوال', await ev('__wk.dist'));
  await goto(0, -60, 0); const cam1 = JSON.parse(await ev(`JSON.stringify({cur:__wk.cur,ly:__wk.look.z-__wk.p.z})`));
  ok(cam1.cur > 12 && cam1.ly > 3, 'بمكان فاضي: الكاميرا على بعدها وتطالع قدّام الشخصية', JSON.stringify(cam1));
  // نخلة بين الكاميرا والشخصية: نخلة الساحة عند (0,-27) — الشخصية عند z=-22 تطالع شمال (yaw=0 → الكاميرا ورا عند z أقل)
  await goto(0, -22, 0); const cur2 = await ev('__wk.cur');
  ok(cur2 < 7, 'جذع نخلة ورا الشخصية: الكاميرا تقرّب قدّامه بدل ما يغطي الشاشة', cur2);
  await shot('v_palm.png');
  // عالم البناء: الأزرار تختفي + الأدوات
  await goto(146, 0, -1.57); await ev(`__wk.camYaw=-1.57`);
  ok(await until(async () => { await goto(150, 0, -1.57); return (await vst()).fp; }, 80000), 'دخلت عالم البناء');
  try { await ev(`document.getElementById('mcHelpOk').click()`); } catch {}
  const mcShown = await ev(`[...document.querySelectorAll('#whud button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.id).join(',')`);
  ok(mcShown === 'wHome,wChat,wMore', 'بعالم البناء: 🚗 مخفي (يبقى 🏠 💬 ☰)', mcShown);
  ok(!(await vis('pushAsk')), 'نافذة الإشعارات ما تطلع بعالم البناء');
  for (const id of [125, 144]) await ev(`__vox.debug.give(${id},1)`);
  const inv = (await vst()).inv, ai = inv.findIndex(x => x && x.id === 125), si = inv.findIndex(x => x && x.id === 144);
  const icon = await ev(`(()=>{const e=[...document.querySelectorAll('#mcHot .mcs')].find(x=>/فأس/.test(x.title||''));if(!e)return 'no-slot';const st=e.getAttribute('style')||'';const i=st.indexOf('data:');if(i<0)return 'no-url';const u=st.slice(i).split(')')[0].replace(/["']/g,'');return new Promise(r=>{const im=new Image();im.onload=()=>r(im.width);im.onerror=()=>r('err');im.src=u;});})()`);
  ok(icon === 48, 'أيقونة الفأس بكسلات 16×16 مكبّرة ×3 (48)', icon);
  await ev(`document.querySelectorAll('#mcHot .mcs')[${si}].click()`); await wait(1200);
  const hd = JSON.parse(await ev('JSON.stringify(__vox.debug.hand())'));
  ok(hd.vis === true, 'اليد ظاهرة', JSON.stringify(hd));
  const held = await ev(`(()=>{let n=0,v=0;__vox.debug.handObj&&0;return 1})()`);
  await shot('v_sword.png');
  ok(!errors.length, 'بدون أخطاء بالصفحة', JSON.stringify(errors));
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
