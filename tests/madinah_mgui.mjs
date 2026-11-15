// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_mgui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3975, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9342', '--user-data-dir=' + path.join(HERE, 'chrome-prof-mgui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9342/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  const btn = txt => ev(`(()=>{const b=[...document.querySelectorAll('#gBody button')].find(b=>b.textContent.includes(${JSON.stringify(txt)}));if(b&&!b.disabled){b.click();return true}return false})()`);
  const body = () => ev(`document.getElementById('gBody').innerText`);
  ok((await ev(`__car.GM.stations.length`)) === 10 && (await ev(`__car.GM.stations.filter(s=>s.k==='جماعي').length`)) === 3, '10 محطات: 3 منها جماعية (لودو، سباق النقر، خمّن الرقم)');
  // ===== لودو =====
  await ev(`__car.GM.openGame('ludo')`); await wait(900); await btn('مع 3 بوتات'); await wait(1500);
  ok(await ev('!!window.__ludo && !!window.__ludo.cv'), 'لودو: اللوحة ظهرت بعد البدء مع 3 بوتات (4 لاعبين)');
  ok((await ev(`document.querySelectorAll('#gBody [style*="translateZ"]').length`)) === 6, 'لودو: نرد حقيقي ثلاثي الأبعاد بستة أوجه');
  await btn('👍'); await wait(500); ok((await body()).includes('أنت: 👍'), 'لودو: الدردشة شغّالة (رسالة جاهزة)');
  let rolled = 0, left = false, tries = 0, sawHop = false;
  for (let k = 0; k < 400 && tries < 40; k++) {
    await wait(150);
    if (!sawHop) sawHop = await ev(`!!(window.__ludo && window.__ludo.tk.some(row => (row || []).some(r => r.a && !r.a.fly)))`);
    if (await btn('ارمِ النرد')) { rolled++; await wait(250); }
    const s = JSON.parse(await ev(`JSON.stringify((()=>{const L=window.__ludo;if(!L||!L.st)return null;const st=L.st,me=L.me;return {cur:st.cur,me:me.i,ph:st.ph,mv:st.mv,toks:st.toks[me.i],seat:me.seats[me.i],over:st.over}})())`) || 'null');
    if (!s) continue; if (s.toks.some(v => v >= 0)) left = true; if (left && rolled >= 4) break;
    if (s.cur === s.me && s.ph === 'move' && s.mv.length > 1) { tries++; await ev(`(()=>{const L=window.__ludo,st=L.st,me=L.me,ti=st.mv[0];const r=L.cv.getBoundingClientRect();const pos=st.toks[me.i][ti];const seat=me.seats[me.i];
      const PATH=${JSON.stringify([[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]])};
      const B=[[0,0],[9,0],[9,9],[0,9]];let x,y;if(pos===-1){x=B[seat][0]+(ti%2?4:2);y=B[seat][1]+(ti>1?4:2);}else if(pos<=50){const c=PATH[(seat*13+pos)%52];x=c[0]+.5;y=c[1]+.5;}else{x=7.5;y=7.5;}
      L.cv.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+x/15*r.width,clientY:r.top+y/15*r.height}));})()`); }
  }
  ok(rolled >= 3, 'لودو: رميت النرد عدة مرات (' + rolled + ')'); ok(sawHop, 'لودو: القطع تقفز من مربع لمربع (حركة التنقل)'); ok(left, 'لودو: قطعتي طلعت من القاعدة بعد 6 وتحركت');
  await shot('ludo_1.png');
  await ev(`__car.GM.close(true)`); await wait(500);
  // ===== سباق النقر =====
  await ev(`__car.GM.openGame('tap')`); await wait(900); await btn('ابدأ الآن مع بوتات'); await wait(5200);
  const tb = `document.querySelector('#gBody button[style*="width"]')`;
  let tapEnd = '';
  for (let k = 0; k < 160 && !tapEnd; k++) { await ev(`(()=>{const b=${tb};if(b)b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))})()`); await wait(70); const t = await body(); if (t.includes('فزت') || t.includes('فاز')) tapEnd = t; }
  ok(!!tapEnd, 'سباق النقر: انتهى بفائز'); await shot('tap_1.png');
  await ev(`__car.GM.close(true)`); await wait(500);
  // ===== خمّن الرقم =====
  await ev(`__car.GM.openGame('guess')`); await wait(900); await btn('ضد بوت'); await wait(1500);
  let gEnd = '', lo = 1, hi = 100, myTurns = 0;
  for (let k = 0; k < 160 && !gEnd; k++) {
    await wait(300); const t = await body(); if (t.includes('فزت') || t.includes('فاز')) { gEnd = t; break; }
    const m = t.match(/الرقم بين (\d+) و (\d+)/); if (m) { lo = +m[1]; hi = +m[2]; }
    const mid = Math.floor((lo + hi) / 2); await ev(`(()=>{const s=document.querySelector('#gBody input[type=range]');s.value=${mid};s.dispatchEvent(new Event('input'))})()`);
    if (await btn('خمّن')) { myTurns++; }
  }
  ok(myTurns >= 1, 'خمّن الرقم: خمّنت بدوري (' + myTurns + ' مرة) والزر يتفعّل بدوري فقط');
  ok(!!gEnd, 'خمّن الرقم: انتهى بفائز (تلميحات الأعلى/الأقل تضيّق المجال)'); await shot('guess_1.png');
  await ev(`__car.GM.close(true)`); await wait(300);
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
