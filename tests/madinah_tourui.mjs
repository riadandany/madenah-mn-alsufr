// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_tourui_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3972, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9347', '--user-data-dir=' + path.join(HERE, 'chrome-prof-tourui'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9347/json')).json()).find(t => t.type === 'page'); } catch {} }
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
  // الشريط العلوي: أيقونات بدون كلمات + إطار عملات + مستوى
  await ev(`__car.onNet({t:'eco',s:{c:120,s:3,lv:7,tk:[],bx:0,tut:[0,0,0,0],fnd:[],o:[],bd:-1,xo:0,rc:0,bc:60,lg:0}})`); await wait(300);
  const bar = await txt('count'), barH = await ev(`document.getElementById('count').innerHTML`);
  ok(!/بيت في المدينة|متواجد|بالساحة/.test(bar), 'الشريط العلوي بدون كلمات', bar.replace(/\n/g, ' | '));
  ok(/class="box"[^>]*>🪙 ١٢٠|class="box"[^>]*>🪙 120/.test(barH), 'العملات داخل إطار');
  ok(/class="lv"[^>]*>⭐<b>[٧7]<\/b>/.test(barH), 'المستوى بإطار ورقمه ٧');
  ok(/🏠 \S+/.test(bar), 'عدد البيوت بأيقونة فقط');
  ok((await txt('wSet')).trim() === '⚙️', 'زر الإعدادات أيقونة ترس ⚙️');
  await shot('01_topbar.png');
  // لوحة الإعدادات
  await click('wSet'); await wait(300); ok(await vis('p16') && /الإعدادات/.test(await txt('p16')), 'الإعدادات تفتح'); await click('close16');
  // طلب مرافقة من قائمة الوجهات
  await click('wHome'); await wait(200); ok(await vis('goCq'), 'زر «اطلب مرافقة» بقائمة الوجهات'); await click('goCq'); await wait(300);
  ok(await vis('p21') && /الساحة/.test(await txt('cqDest')) && /المول/.test(await txt('cqDest')), 'لوحة المرافقة: الوجهات');
  ok(/ما فيه أحد قريب/.test(await txt('cqPpl')), 'بدون ناس قريبين: رسالة واضحة');
  await ev(`(()=>{const m=__car.PEERS;m.set('p1',{id:'p1',n:'سالم',x:__wk.p.x+5,z:__wk.p.z,h:'',tag:0,v:-1});m.set('p2',{id:'p2',n:'بدر',x:__wk.p.x+30,z:__wk.p.z,h:'',tag:0,v:-1});m.set('p3',{id:'p3',n:'ناصر',x:__wk.p.x+2,z:__wk.p.z,h:'',tag:0,v:-1});})()`);
  await click('cancel21'); await click('wHome'); await click('goCq'); await wait(300);
  const order = await ev(`[...document.querySelectorAll('#cqPpl [data-id]')].map(d=>d.dataset.id).join(',')`);
  ok(order === 'p3,p1,p2', 'الأشخاص مرتبين الأقرب أول', order);
  await ev(`document.querySelector('#cqPpl [data-id="p3"]').click()`); await ev(`document.querySelector('#cqPpl [data-id="p2"]').click()`);
  ok((await ev(`document.querySelectorAll('#cqPpl .sel').length`)) === 2, 'أقدر أختار أكثر من شخص');
  await ev(`document.querySelector('#cqDest [data-d="mall"]').click()`); ok(await ev(`document.querySelector('#cqDest .sel').dataset.d`) === 'mall', 'اختيار الوجهة');
  await shot('02_cq.png'); await click('cancel21');
  // لوحة الشخص: «اطلب مرافقة» ثم الرسائل السريعة أول شي، والكتابة تحتها
  await click('wPeople'); await wait(300); await ev("document.querySelector('#ppl [data-id=p1]').click()"); await wait(400);
  const pos = JSON.parse(await ev("JSON.stringify(['cq7','says'].map(i=>document.getElementById(i).getBoundingClientRect().top))"));
  ok(await vis('p7') && await vis('cq7') && pos[0] < pos[1], 'لوحة الشخص: المرافقة ثم الرسائل السريعة', pos.map(Math.round).join(' < '));
  const nb = await ev("document.querySelectorAll('#says button').length"), ng = await ev("document.querySelectorAll('#says .gh').length"); ok(nb === 80 && ng === 7, 'الرسائل الجاهزة: 80 رسالة بـ7 أقسام', nb + ' / ' + ng);
  ok(!(await vis('typedRow')) && !(await vis('tp7')), 'الكتابة الحرة مخفية لغير المصرّح لهم، وزر المشرف مخفي');
  await ev("__car.onNet({t:'ct',on:true})"); ok(await vis('typedRow'), 'لو انفتحت له الكتابة: يظهر مربع الكتابة'); await ev("__car.onNet({t:'ct',on:false})"); ok(!(await vis('typedRow')), 'وتختفي لو انقفلت');
  await shot('02b_person.png'); await ev("document.getElementById('cq7').click()"); await wait(300); ok(await vis('p21'), 'زر المرافقة بلوحة الشخص يفتح اختيار الوجهة'); await click('cancel21');
  // طلب مرافقة من بطاقة الشخص (الضغط عليه)
  await ev(`(()=>{document.getElementById('cancel21').click();})()`);
  // استلام طلب
  await ev(`__car.onNet({t:'cqi',f:'p1',n:'سالم',d:'lake'})`); await wait(300);
  ok(await vis('cqBox') && /سالم/.test(await txt('cqT')) && /البحيرة/.test(await txt('cqT')), 'وصلني طلب مرافقة: يظهر باسمه والمكان', await txt('cqT'));
  await shot('03_cqbox.png');
  // الانتقال عند الموافقة (رسالة cg من السيرفر)
  const before = await ev(`JSON.stringify([__wk.p.x,__wk.p.z])`);
  await ev(`__car.onNet({t:'cg',d:'mall',n:'سالم',me:0})`); await wait(300);
  const after = await ev(`JSON.stringify([__wk.p.x,__wk.p.z])`);
  ok(before !== after, 'الموافقة تنقلني للمكان', before + ' → ' + after);
  await click('cqNo'); await wait(200); ok(!(await vis('cqBox')), 'الاعتذار يخفي الطلب');
  // مدينة المشتركين: زيارة مجانية ثم رسالة المشتركين
  await ev(`document.getElementById('p20').style.display='block'`); await ev(`__car.onNet({t:'vh',l:[],mine:[],pass:false,tour:0})`); await wait(200);
  ok(/ادخل زيارة مجانية/.test(await txt('vip20')) && !/اطرق/.test(await txt('vip20')), 'البوابة: زيارة مجانية بدون طرق');
  await ev(`__car.onNet({t:'vh',l:[],mine:[],pass:false,tour:2})`); await wait(200);
  ok(/القصور خاصة بمشتركي تيك توك/.test(await txt('vip20')) && !/ادخل زيارة مجانية/.test(await txt('vip20')), 'بعد الزيارة: «القصور خاصة بمشتركي تيك توك»');
  ok(await ev("!!document.querySelector('#vip20 [data-a=sub]')"), 'زر «اشترك بالتيك توك» ظاهر مع الرسالة');
  await ev("window.__opened=null;window.open=(u)=>{window.__opened=u;}"); await ev("document.querySelector('#vip20 [data-a=sub]').click()");
  ok((await ev('window.__opened'))==='https://vt.tiktok.com/ZS9fxFMp4FGDK-EGcSl/', 'الضغط يفتح رابط الاشتراك بالتيك توك');
  await shot('04_vipgate.png');
  // نقر شبحي بعد لمسة سريعة على شخص: ما يضغط زر من اللوحة
  await ev("document.getElementById('p16').style.display='none'"); await ev('window.__tapguard()'); await ev("document.getElementById('wSet').click()"); await wait(100);
  ok(!(await vis('p16')), 'نقر شبحي خلال 0.65ث من لمسة الشخص: يُتجاهل');
  await wait(800); await ev("document.getElementById('wSet').click()"); await wait(200); ok(await vis('p16'), 'بعدها النقر الطبيعي يشتغل'); await click('close16');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
