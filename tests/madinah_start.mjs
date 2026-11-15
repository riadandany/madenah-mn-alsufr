// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_start_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3987, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9362', '--user-data-dir=' + path.join(HERE, 'chrome-prof-start'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9362/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const vis = id => ev(`(()=>{const e=document.getElementById('${id}');return !!e&&getComputedStyle(e).display!=='none';})()`);
  const load = async () => { for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; } await wait(2500); };
  await send('Page.navigate', { url: URL0 }); await load();
  ok(await vis('p1'), 'زائر جديد بدون بيت: لوحة «ابنِ بيتك» تطلع على طول');
  ok(await vis('have1'), 'فيها زر «عندي بيت من قبل»');
  ok(!(await vis('instBar')), 'شريط التثبيت ما يغطي اللوحة وهي مفتوحة'); await shot('s1_build.png');
  await ev("document.getElementById('cancel1').click()"); for (let k = 0; k < 20 && !(await ev('__wk.on')); k++) await wait(400);
  ok(await ev('__wk.on'), 'إلغاء ← ينزل بالساحة يتمشى'); await wait(1500);
  { // ضغطة على البيت نفسه تفتح بطاقته (لايك) تحت الدردشة
    await ev(`(()=>{const p=__yard.houseXZ(20),f=__car.faceOf(20);__wk.p.set(p[0],0,p[1]+f*26);__wk.y=.3;__wk.yaw=f>0?Math.PI:0;__wk.camYaw=f>0?0:Math.PI;__wk.pitch=.3;})()`); await wait(2500);
    await ev("(()=>{const l=document.getElementById('chatlist');for(let i=0;i<4;i++){const d=document.createElement('div');d.textContent='رسالة تجربة '+i;l.appendChild(d);}document.getElementById('chat').style.display='block';document.body.classList.add('hasChat');})()"); await wait(300);
    const hid = await ev('__pickHouse(210,330)'); ok(!!hid, 'الشعاع يلقط البيت من نص الشاشة', String(hid)+' top='+await ev("(()=>{const e=document.elementFromPoint(210,330);return e.tagName+'#'+e.id+'.'+e.className})()"));
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: 210, y: 330, button: 'left', clickCount: 1, pointerType: 'mouse' }); await wait(900);
    ok(await vis('card') && /لايك|❤️/.test(await ev("document.getElementById('cActs').innerText+document.getElementById('cInfo').innerText")), 'ضغطت على البيت: طلعت بطاقته مع اللايك', await ev("document.getElementById('cName').innerText"));
    const r = JSON.parse(await ev("JSON.stringify({c:document.getElementById('card').getBoundingClientRect().top,h:(()=>{const e=document.getElementById('chat');return e&&getComputedStyle(e).display!=='none'?e.getBoundingClientRect().bottom:0})()})"));
    ok(r.c >= r.h, 'البطاقة تحت الدردشة (ما تتلخبط معها)', JSON.stringify(r)); await shot('s3_card.png'); await ev("document.getElementById('cX').click()");
  }

  ok(await vis('instBar'), 'شريط «حط اللعبة بشاشة جوالك» يطلع من البداية'); await shot('s2_inst.png');
  await ev("document.getElementById('instX').click()"); await wait(1500); ok(!(await vis('instBar')), '✕ يخفيه');
  await send('Page.reload'); await load(); ok(await vis('p1'), 'بعد التحديث: لوحة البناء ترجع');
  await ev("document.getElementById('have1').click()"); await wait(800); ok(await vis('p11') && !(await vis('p1')), '«عندي بيت» يفتح البحث عن البيت');
  await ev("document.getElementById('cancel11').click()"); await wait(1500); ok(await vis('instBar'), 'الشريط يرجع كل مرة يدخل (لين ما يثبّت)');
  await ev("localStorage.setItem('mnalsifr_inst2',JSON.stringify({done:1}))"); await send('Page.reload'); await load(); await ev("document.getElementById('cancel1').click()"); await wait(2500); ok(!(await vis('instBar')), 'بعد التثبيت ما يطلع');
} finally { console.log(`\n${pass} PASS / ${fail} FAIL`); console.log('errors:', errors.length ? errors.join('\n') : 'none'); try { chrome.kill(); } catch {} srv.kill(); process.exit(0); }
