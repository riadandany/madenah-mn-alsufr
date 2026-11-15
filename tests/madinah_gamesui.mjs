// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_gamesui_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3998, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(HERE, 'chrome-prof-gamesui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  const goto = async which => { await click('wHome'); await wait(200); await click(which); await wait(1500); };
  await goto('goGames'); await wait(1500); await shot('gm_1_pavilion.png');
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+52,0,P.z-5);__wk.yaw=Math.PI;__wk.camYaw=0;__wk.dist=30;__wk.cur=30;__wk.pitch=.45;})()`); await wait(1500); await shot('gm_0_wide.png'); await ev('__wk.dist=9.5;__wk.pitch=.34');
  ok(await ev('__car.GM.stations.length') === 10, '10 محطات ألعاب');
  const P = await ev('__car.PLAZA()');
  // محطة إكس أو
  const near = async id => { await ev(`(()=>{const P=__car.PLAZA(),s=__car.GM.stations.find(x=>x.id==='${id}');__wk.p.set(P.x+s.x,0,P.z+s.z+4);__wk.y=.3;})()`); await wait(900); };
  await near('snake'); ok(await ev(`getComputedStyle(document.getElementById('gameBtn')).display`) === 'block', 'زر العب يظهر عند الجهاز', await ev(`document.getElementById('gameBtn').textContent`));
  await shot('gm_2_near.png');
  const open = async id => { await near(id); await click('gameBtn'); await wait(500); };
  const body = () => ev(`document.getElementById('gBody').innerText`);
  // الثعبان
  await open('snake'); ok(await ev('window.__gameOpen') === true && await ev(`document.querySelector('#gBody canvas')!==null`), 'الثعبان: فتحت اللعبة بشاشة كاملة');
  const pads = await ev(`JSON.stringify([...document.querySelectorAll('#gBody button')].map(b=>({t:b.textContent,x:Math.round(b.getBoundingClientRect().x),y:Math.round(b.getBoundingClientRect().y)})))`).then(JSON.parse);
  const px = e => pads.find(p => p.t === e);
  ok(px('⬅️').x < px('⬇️').x && px('⬇️').x < px('➡️').x && px('⬆️').y < px('⬇️').y, 'الثعبان: الأسهم بأماكنها الصحيحة (يسار ↓ يمين، فوق)', JSON.stringify(pads));
  await down('ArrowUp'); await up('ArrowUp'); await wait(1500); await shot('gm_3_snake.png');
  const p0 = await st(); await down('KeyW'); await wait(500); await up('KeyW'); ok(Math.abs((await st()).z - p0.z) < .5, 'المفاتيح ما تحرّك الشخصية وقت اللعب');
  await click('gClose'); ok(!(await ev('window.__gameOpen')), 'خروج: يرجع للعبة');
  // الذاكرة (مع محاكاة كاش قديم للصوت: ما لازم يوقف اللعبة)
  await ev('__car.AU.tick=undefined;__car.AU.place=undefined;__car.AU.win=undefined;__car.AU.lose=undefined');
  await open('memory'); ok(await ev(`document.querySelectorAll('#gBody button').length`) >= 16, 'الذاكرة: 16 بطاقة');
  await ev(`document.querySelectorAll('#gBody button')[0].click()`); const shown = await ev(`document.querySelectorAll('#gBody button')[0].textContent`); ok(shown !== '❓', 'الذاكرة: البطاقة تنقلب وتبان', shown); await ev(`document.querySelectorAll('#gBody button')[1].click()`); await wait(300);
  ok(await ev(`document.getElementById('gInfo').textContent`).then(t => t.includes('الحركات: 1')), 'الذاكرة: حركة محسوبة'); await shot('gm_4_memory.png'); await click('gClose');
  // اضرب الخلد
  await open('whack'); await wait(2000); ok((await body()).includes('30') || (await body()).includes('⏱'), 'الخلد: العدّاد شغّال'); await click('gClose');
  // 2048
  await open('g2048');
  const tiles = async () => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#gBody [data-tile]')].map(e=>({r:+e.dataset.r,c:+e.dataset.c,v:+e.textContent})))`));
  const swipe = (x0, y0, x1, y1) => ev(`(()=>{const o=document.getElementById('gameOv');const f=(t,x,y)=>o.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,pointerId:7,bubbles:true}));f('pointerdown',${x0},${y0});f('pointerup',${x1},${y1});})()`);
  const t0 = await tiles(); ok(t0.length === 2, '2048: بطاقتين بالبداية', JSON.stringify(t0));
  await down('ArrowRight'); await up('ArrowRight'); await wait(1300);
  const t1 = await tiles(); ok(t1.some(x => x.c === 3) && t1.length >= 2, '2048: سهم يمين: البطاقات تنزلق لليمين', JSON.stringify(t1));
  await swipe(60, 80, 330, 90); await wait(1300);
  const t2 = await tiles(); ok(t2.filter(x => x.c >= 2).length >= 2, '2048: سحب لليمين (من خارج اللوحة) حركة وحدة لليمين فقط', JSON.stringify(t2));
  await swipe(330, 90, 60, 80); await wait(1300);
  const t3 = await tiles(); ok(t3.filter(x => x.c <= 1).length >= 2, '2048: سحب لليسار: البطاقات تروح يسار', JSON.stringify(t3));
  await swipe(200, 300, 200, 100); await wait(1300);
  const t4 = await tiles(); ok(t4.filter(x => x.r <= 1).length >= 2, '2048: سحب لفوق: البطاقات تروح فوق', JSON.stringify(t4));
  ok(await ev(`document.getElementById('gInfo').textContent`).then(t => t.includes('النقاط')), '2048 شغّالة'); await shot('gm_5_2048.png'); await click('gClose');
  // إكس أو ضد الكمبيوتر
  await open('ttt'); ok((await body()).includes('العب مع لاعب حقيقي') && (await body()).includes('ضد الكمبيوتر'), 'إكس أو: خيار لاعب حقيقي/كمبيوتر');
  await ev(`[...document.querySelectorAll('#gBody button')].find(b=>b.textContent.includes('ضد الكمبيوتر')).click()`); await wait(500);
  ok(await ev(`document.querySelectorAll('#gBody button').length`) >= 9, 'إكس أو: اللوحة 9 خانات');
  await ev(`document.querySelectorAll('#gBody div button')[4].click()`); await wait(1500);
  const marks = await ev(`[...document.querySelectorAll('#gBody div button')].filter(b=>b.textContent==='❌'||b.textContent==='⭕').length`); ok(marks === 2, 'الكمبيوتر رد بحركته', 'marks=' + marks);
  await shot('gm_6_ttt.png'); await click('gClose');
  // أربعة تتصل
  await open('c4'); await ev(`[...document.querySelectorAll('#gBody button')].find(b=>b.textContent.includes('ضد الكمبيوتر')).click()`); await wait(500);
  await ev(`document.querySelectorAll('#gBody div button')[3].click()`); await wait(1500);
  const filled = await ev(`[...document.querySelectorAll('#gBody div button')].filter(b=>b.style.background.includes('rgb(255, 59, 48)')||b.style.background.includes('rgb(255, 211, 77)')).length`); ok(filled === 2, 'أربعة تتصل: قطعتك وقطعة الكمبيوتر', 'filled=' + filled);
  await shot('gm_7_c4.png'); await click('gClose');
  // حجر ورقة مقص
  await open('rps'); await ev(`[...document.querySelectorAll('#gBody button')].find(b=>b.textContent.includes('ضد الكمبيوتر')).click()`); await wait(500);
  for (let k = 0; k < 4; k++) { await ev(`[...document.querySelectorAll('#gBody button')].find(b=>b.textContent==='✊')?.click()`); await wait(1000); if ((await body()).includes('فزت') || (await body()).includes('خسرت')) break; }
  ok((await body()).includes('جولة') || (await body()).includes('مباراة ثانية'), 'حجر ورقة مقص: جولات تمشي'); await shot('gm_8_rps.png'); await click('gClose');
  ok(await ev(`!!document.getElementById('goGames')`), 'وجهة «قسم الألعاب» بقائمة 🏠');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
