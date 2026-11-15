// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_fit_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3983, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9350', '--user-data-dir=' + path.join(HERE, 'chrome-prof-fit'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=360,640', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9350/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: +(process.env.H||640), deviceScaleFactor: 1, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
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
  await wait(1500);
  const ids = await ev("JSON.stringify([...document.querySelectorAll('.panel')].map(p=>p.id))"); 
  let bad = [], LONG = '';
  for (const id of JSON.parse(ids)) {
    await ev("document.querySelectorAll('.panel').forEach(p=>p.style.display='none')");
    await ev("document.getElementById('" + id + "').style.display='block'; window.__fitPanels()");
    await wait(450);
    const r = JSON.parse(await ev("(()=>{const e=document.getElementById('" + id + "');const r=e.getBoundingClientRect();return JSON.stringify({t:Math.round(r.top),b:Math.round(r.bottom),h:innerHeight,z:e._z||1,sc:e.scrollHeight>e.clientHeight+4&&![...e.querySelectorAll('.moreHint')].some(b=>b.style.display!=='none')})})()"));
    const okk = r.t >= 0 && r.b <= r.h + 1;
    if (!okk || r.sc) bad.push(id + JSON.stringify(r));
    if (id === 'p1') await shot('fit_p1.png'); if (id === process.env.DBG) { console.log('DBG', await ev("(()=>{const e=document.getElementById('" + id + "');return JSON.stringify({sh:e.scrollHeight,ch:e.clientHeight,st:e.scrollTop,mh:e.style.maxHeight,hints:[...e.querySelectorAll('.moreHint')].map(b=>b.parentElement.id+'/'+b.parentElement.className+':'+b.style.display),inner:[...e.querySelectorAll('.says,.lb,[style*=overflow]')].map(x=>x.className+'|'+x.id+'|'+x.scrollHeight+'/'+x.clientHeight+'|'+getComputedStyle(x).overflowY+'|'+getComputedStyle(x).maxHeight)})})()")); await shot('fit_dbg.png'); } if (!LONG && await ev("(()=>{const b=document.querySelector('#" + id + " .moreHint');return !!b&&b.style.display!=='none'})()")) LONG = id;
  }
  await ev("document.querySelectorAll('.panel').forEach(p=>p.style.display='none')"); await ev("document.getElementById('wBuild').style.display='';document.getElementById('wBuild').click()"); await wait(1500);
  const r1 = JSON.parse(await ev("(()=>{const e=document.getElementById('p1');const r=e.getBoundingClientRect();return JSON.stringify({d:e.style.display,t:Math.round(r.top),b:Math.round(r.bottom),h:innerHeight,z:e._z})})()")); console.log('p1 real', r1); await shot('fit_p1_real.png');
  ok(r1.d === 'block' && r1.t >= 0 && r1.b <= r1.h + 1, 'لوحة ابنِ بيتك (من الزر الحقيقي) كاملة');
  console.log('long panel', LONG); if (LONG) { await ev("document.querySelectorAll('.panel').forEach(p=>p.style.display='none')"); await ev("document.getElementById('" + LONG + "').style.display='block'; window.__fitPanels()"); await wait(500); await shot('fit_long.png'); const st0 = await ev("document.getElementById('" + LONG + "').scrollTop"); await ev("document.querySelector('#" + LONG + " .moreHint').click()"); await wait(900); const st1 = await ev("document.getElementById('" + LONG + "').scrollTop"); await wait(800); const st2 = await ev("document.getElementById('" + LONG + "').scrollTop"); console.log('scroll', st0, st1, st2); ok(st1 > st0 && st2 >= st1 - 2, 'زر المزيد يمرّر والتمرير ما يرجع لفوق'); await shot('fit_long2.png'); }
  console.log('bad:', bad);
  ok(bad.length === 0, 'كل اللوحات (' + JSON.parse(ids).length + ') تنعرض كاملة داخل شاشة 360×640');
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`); console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM'); setTimeout(() => process.exit(0), 800);
}
