// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_vipui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3968, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9345', '--user-data-dir=' + path.join(HERE, 'chrome-prof-vipui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9345/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  const plz = JSON.parse(await ev('JSON.stringify(__car.PLAZA())'));
  const tp = (lx, lz, yaw = 0, cam = 40, pitch = .35, dist = 14) => ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+(${lx}),0,P.z+(${lz}));__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;__wk.dist=${dist};__wk.cur=${dist};__wk.pitch=${pitch};})()`);
  const loc = async () => JSON.parse(await ev(`JSON.stringify((()=>{const P=__car.PLAZA();return {x:+(__wk.p.x-P.x).toFixed(1),z:+(__wk.p.z-P.z).toFixed(1),y:+__wk.y.toFixed(2)}})())`));
  const vst = () => ev('__car.vip().D ? __car.vip().D.state : -1');
  const dbtn = () => ev(`(()=>{const b=document.getElementById('doorBtn');return b.style.display+'|'+b.textContent})()`);
  const key = (c, d) => ev(`window.dispatchEvent(new KeyboardEvent('${d}',{code:'${c}',bubbles:true}))`);
  // 1) الحوش
  await tp(0, 258, 0, 0, .32, 22); await wait(3500);
  for (let k = 0; k < 20 && (await vst()) !== 2; k++) await wait(500);
  ok((await vst()) === 2, 'مدينة التيك توك انبنت لما اقتربت (حالة 2)');
  await wait(3500); await tp(0, 250, 0, 0, .22, 26); await wait(2500); await shot('vip_1_courtyard.png'); await tp(-40, 240, 0.5, 0, .3, 30); await wait(2000); await shot('vip_1b_courtyard_side.png');
  ok((await dbtn()).startsWith('block|🏰 بوابة'), 'زر «بوابة مدينة مشتركي تيك توك» يطلع بالحوش: ' + await dbtn());
  // 2) البوابة مقفولة: نحاول نمشي للداخل
  await tp(0, 292, 0, 0, .3, 12); await wait(800); await key('KeyW', 'keydown'); await wait(5000); await key('KeyW', 'keyup'); await wait(400);
  let l = await loc(); ok(l.z < 300.5, 'البوابة مقفولة: ما أقدر أدخل (z=' + l.z + ')');
  // 3) لوحة البوابة + رمز غلط/صح
  await ev(`document.getElementById('doorBtn').click()`); await wait(700);
  ok((await ev(`document.getElementById('p20').style.display`)) === 'block' && (await ev(`document.getElementById('vip20').innerText`)).includes('عمر'), 'لوحة البوابة تعرض بيوت المشتركين');
  await shot('vip_2_gatepanel.png');
  await ev(`document.querySelector('#vipList [data-vid]').click()`);
  const omarId = await ev(`__car.vip().VIPH.find(x => x.name === 'عمر').id`); await ev(`document.querySelector('#vipList [data-vid="${omarId}"]').click()`); await wait(300);
  await ev(`document.getElementById('vipPin').value='0000'; document.querySelector('[data-a=join]').click()`); await wait(900);
  ok(!(await ev('__car.vip().VIP.pass')), 'رمز غلط: البوابة تبقى مقفولة');
  await wait(1700); await ev(`document.getElementById('vipPin').value='1234'; document.querySelector('[data-a=join]').click()`); await wait(1500);
  ok(await ev('__car.vip().VIP.pass') && (await ev(`__car.vip().VIP.mine.includes('${omarId}')`)), 'رمز صحيح: التصريح + قصر «عمر»');
  await ev(`document.getElementById('cancel20').click()`); await wait(1800);
  ok(await ev('__car.vip().D.open'), 'البوابة انفتحت (الأبواب تلف)'); await tp(0, 280, 0, 0, .35, 20); await wait(2500); await shot('vip_3_gateopen.png');
  // 4) المشي بعد الفتح
  await tp(0, 292, 0, 0, .3, 12); await wait(800); await key('KeyW', 'keydown'); await wait(6000); await key('KeyW', 'keyup'); await wait(400);
  l = await loc(); ok(l.z > 303, 'بعد الفتح: أدخل المدينة (z=' + l.z + ')');
  // 5) لقطات: الشارع الرئيسي والقصور والمسبح
  await tp(0, 330, 0, 0, .28, 24); await wait(2500); await shot('vip_4_avenue.png');
  await tp(0, 470, 0, 0, .3, 40); await wait(2500); await shot('vip_5_roundabout.png');
  await tp(-12, 370, -Math.PI / 2, 0, .3, 40); await wait(2500); await shot('vip_6_left_palaces.png');
  await tp(0, 560, 0, 0, .25, 46); await wait(2500); await shot('vip_7_grand_palace.png');
  await tp(-110, 372, Math.PI / 2, 0, .35, 30); await wait(2500); await shot('vip_8_pool_garden.png');
  // 6) باب قصري
  const door = await ev(`JSON.stringify(__car.vip().D.palaces().find(x => x.id === '${omarId}').door)`); const dd = JSON.parse(door);
  await tp(dd.x, dd.z, Math.PI / 2, 0, .3, 16); await wait(2500);
  ok((await dbtn()).includes('ادخل قصرك'), 'عند باب قصري: زر «ادخل قصرك»: ' + await dbtn()); await shot('vip_9_myPalaceDoor.png');
  await ev(`document.getElementById('doorBtn').click()`); await wait(3500);
  let ins = JSON.parse(await ev('JSON.stringify(__car.inState())')); ok(ins.on && ins.own && ins.hw === 50, 'دخلت قصري (غرفة 100×72)');
  await ev(`(()=>{__wk.camYaw=0;__wk.pitch=.38;__wk.dist=9;__wk.cur=9;})()`); await wait(1500); await shot('vip_10_palace_hall.png');
  // الأدوار والدرج
  const g0 = await ev(`__car.gfTest(0, 10, 0.3)`), g1 = await ev(`__car.gfTest(-10, 30, 12)`), g2 = await ev(`__car.gfTest(-10, 30, 23)`), gs = await ev(`__car.gfTest(-43, 0, 6)`), gv = await ev(`__car.gfTest(0, 0, 12)`);
  ok(Math.abs(g0 - .3) < .01 && Math.abs(g1 - 11.3) < .01 && Math.abs(g2 - 22.3) < .01, 'ثلاثة أدوار: أرضي 0.3 / أول 11.3 / ثاني 22.3 (' + [g0, g1, g2] + ')');
  ok(gs > 3 && gs < 9, 'منتصف الدرج بين الأدوار (' + gs + ')'); ok(Math.abs(gv - .3) < .01, 'فتحة الصالة الكبرى: ما فيه أرضية بالدور الأول (تنزل للأرضي)');
  await ev(`(()=>{const I=__car.inState();__wk.p.set(I.x - 10, 0, I.z + 28);__wk.y = 12;})()`); await wait(2500);
  const yy = (await loc()).y; ok(yy > 10, 'أقدر أوقف على الدور الأول (y=' + yy + ')'); await ev(`(()=>{__wk.camYaw=0;__wk.pitch=.35;__wk.dist=9;__wk.cur=9;})()`); await wait(1200); await shot('vip_11_palace_floor1.png');
  await ev(`(()=>{const I=__car.inState();__wk.p.set(I.x + 30, 0, I.z - 18);__wk.y = 0.3;__wk.camYaw=Math.PI; __wk.pitch=.3;__wk.dist=10;__wk.cur=10;})()`); await wait(2500); await shot('vip_12_palace_pool.png');
  await ev(`document.getElementById('inExit').click()`); await wait(2500);
  ins = JSON.parse(await ev('JSON.stringify(__car.inState())')); l = await loc(); ok(!ins.on && l.z > 300, 'طلعت من القصر لشارع المدينة (z=' + l.z + ')');
  // 7) المشرف: إدارة القصور + طرق البوابة
  await ev(`localStorage.setItem('mnalsifr_admin','admintok-xyz'); window.confirm=()=>true;`);
  await send('Page.navigate', { url: URL0 + '?admin' }); for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(3000); await ev(`window.confirm=()=>true; ['p12'].forEach(i=>document.getElementById(i).style.display='none')`);
  await ev(`__car.openVip()`); await wait(900);
  await ev(`document.getElementById('vipN').value='عمر٢'; document.getElementById('vipP').value='1234'; document.querySelector('[data-a=add]').click()`); await wait(1800);
  ok((await ev(`document.getElementById('vip20').innerText`)).includes('دعوة مشتركة'), 'نفس الرمز لقصر ثاني: الواجهة تعرضهم «دعوة مشتركة»');
  { const id2 = await ev(`__car.vip().VIPH.find(x => x.name === 'عمر٢').id`); await ev(`document.querySelector('[data-del="${id2}"]').click()`); await wait(1200); }
  const vtxt = await ev(`document.getElementById('vip20').innerText`); ok(vtxt.includes('إدارة قصور المشتركين') && vtxt.includes('قصر الملك'), 'المشرف يشوف قسم «إدارة قصور المشتركين» وقائمة القصور');
  await ev(`document.getElementById('vipN').value='ريان'; document.getElementById('vipP').value='ryan2026'; document.querySelector('[data-a=add]').click()`); await wait(1800);
  ok(await ev(`__car.vip().VIPH.some(x => x.name === 'ريان')`), 'المشرف أضاف قصر «ريان» من الواجهة (يظهر بالقائمة)');
  const ryId = await ev(`__car.vip().VIPH.find(x => x.name === 'ريان').id`); await ev(`document.querySelector('[data-del="${ryId}"]').click()`); await wait(1500);
  ok(!(await ev(`__car.vip().VIPH.some(x => x.name === 'ريان')`)), 'المشرف حذف القصر من الواجهة');
  await ev(`document.getElementById('cancel20').click()`);
  await ev(`__car.onNet({t:'vkn',f:'zz9',n:'ضيف تيك توك'})`); await wait(400);
  ok((await ev(`document.getElementById('knockBox').style.display`)) === 'block' && (await ev(`document.getElementById('knockT').innerText`)).includes('مدينة المشتركين'), 'المشرف يستلم «فلان يطرق باب مدينة المشتركين» مع اسمح/ارفض');
  await ev(`document.getElementById('knockNo').click()`); await wait(300);
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
