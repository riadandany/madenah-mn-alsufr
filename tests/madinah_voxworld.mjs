// اختبار قسم الألعاب بالساحة: اللوحة والمحطات وزر العب والألعاب الفردية والثنائية ضد الكمبيوتر
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_voxworld_houses.json');
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3983, URL0 = `http://127.0.0.1:${PORT}/`;
fs.writeFileSync(path.join(HERE, 'vip_seed.json'), JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz', PROT_R: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9357', '--user-data-dir=' + path.join(HERE, 'chrome-prof-voxworld'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9357/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__PROT_R=0;try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx')}catch{}" });
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
  const vis = id => ev(`getComputedStyle(document.getElementById('${id}')).display!=='none'`);
  const vst = async () => JSON.parse(await ev(`JSON.stringify(__vox.state())`));
  const until = async (f, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await f()) return true; } catch {} await wait(500); } return false; };
  const goto = async (lx, lz, yaw = 1.57) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+(${lx}),0,P.z+(${lz}));__wk.y=0.3;__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;})()`); await wait(1200); };
  ok(await ev(`(()=>{const P=__car.PLAZA();return __car.D.lakeInfo(P.x+240,P.z)===null;})()`), 'البحيرة انشالت');
  ok(await ev('typeof __vox==="object"&&__vox.fp===false'), 'عالم البناء جاهز (برّا الحدّ: شخص ثالث)');
  // الحدّ من جهة المدينة
  await goto(128, 0); await shot('w0_gate.png'); ok(!(await vst()).fp && await ev('__wk.walker.root.visible'), 'عند البوابة (قبل الحدّ): كاميرا المدينة العادية');
  // ندخل العالم بالمشي شرقاً: نحرّك اللاعب لـ+ 150
  await ev(`(()=>{const P=__car.PLAZA();__wk.camYaw=Math.PI/2*-1;__wk.yaw=1.57;})()`);
  await goto(146, 0, -1.57); await ev(`__wk.camYaw=-1.57`);   // نطل لجهة الشرق
  ok(await until(async () => { await goto(150, 0, -1.57); return (await vst()).fp; }, 80000), 'عبرت الحدّ شرقاً: الكاميرا تحوّلت لشخص أول تلقائياً');
  let s = await vst(); ok(s.meshes > 5 && s.chunks > 10, 'قطع العالم تتولّد وتنرسم', `${s.chunks} قطعة / ${s.meshes} شبكة`);
  ok(await ev('document.body.classList.contains("vox")') && await vis('mcUI') && !(await ev('__wk.walker.root.visible')), 'واجهة عالم البناء ظهرت والشخصية مخفية (شخص أول)');
  ok(await ev(`document.querySelectorAll('#mcStat span').length`) >= 10 && await ev(`document.querySelectorAll('#mcHot .mcs').length`) === 9, 'القلوب (بدون جوع) وشريط الأدوات');
  ok(!/🍞/.test(await ev(`document.getElementById('mcStat').innerText`)), 'ما فيه جوع');
  await ev(`document.getElementById('mcHelpOk').click()`); ok(await until(async () => (await vst()).P.onGround, 20000), 'اللاعب يوقف على أرض العالم'); await wait(800); await ev('__wk.camYaw=-1.5708;__wk.pitch=0.7'); await wait(1500); await shot('w1b_east.png'); await ev('__wk.camYaw=1.5708'); await wait(500); await shot('w1_fp.png');
  // تكسير باليد
  await ev(`__wk.pitch=1.25`); await wait(800); const tg = (await vst()).target; ok(!!tg, 'المؤشر يلقط مكعب', JSON.stringify(tg));
  await ev(`__vox.debug.set('mining',true)`); await wait(350); const crk = await ev('__vox.debug.crack()'); await wait(2400); await ev(`__vox.debug.set('mining',false)`); ok(crk, 'شقوق الحفر تظهر على المكعب أثناء الضغط المتواصل'); await wait(2500); s = await vst(); const tot = s.inv.reduce((a, b) => a + (b ? b.n : 0), 0); ok(tot >= 1, 'كسّرت مكعب باليد وجمعته', JSON.stringify(s.inv.filter(Boolean)));
  // وضع
  await ev(`__vox.debug.give(7,10)`); const hs = (await vst()).inv.findIndex(x => x && x.id === 7); await ev(`__vox.debug.set('hot',${hs})`); await wait(600); const before = (await vst()).inv[hs].n; await ev(`__vox.debug.use()`); await wait(500); const after = (await vst()).inv[hs]; ok(!after || after.n < before, 'وضعت مكعب (نقص من الشنطة)', before + ' → ' + (after ? after.n : 0));
  // تصنيع
  await ev(`__vox.debug.give(5,3)`); ok(await ev(`__vox.debug.craftIdx(0)`), 'تصنيع: خشب ← ألواح'); await ev(`document.getElementById('mcInvB').click()`); await wait(400); ok(await vis('mcPanel'), 'الشنطة تفتح'); await ev(`document.querySelector('#mcPanel [data-x]').click()`);
  // أغراض ساقطة: القريب ينشفط، والبعيد يبقى على الأرض لين تقرّب
  await ev('__vox.debug.dropOff(2,3,9,0)'); await wait(2500); ok(await ev('__vox.debug.drops()') >= 1, 'غرض بعيد (9م) يبقى على الأرض ما ينشفط'); const cnt2 = async () => (await vst()).inv.reduce((a, x) => a + (x && x.id === 2 ? x.n : 0), 0); const dirt0 = await cnt2();
  await ev('__vox.debug.setP(__vox.state().P.x + 8, __vox.state().P.z)'); await wait(3500); const dirt1 = await cnt2(); ok(dirt1 >= dirt0 + 3 && await ev('__vox.debug.drops()') === 0, 'لما تقرّب منه ينشفط لك ويدخل الشنطة', dirt0 + ' → ' + dirt1);
  await ev('__vox.debug.dropAt(7,2)'); await wait(2200); ok(await ev('__vox.debug.drops()') === 0, 'غرض قريب ينشفط لك تقريباً فوراً');
  // زراعة: معزقة + بذور + نمو
  await ev('__vox.debug.give(135,1);__vox.debug.give(109,3)'); const hi = (await vst()).inv.findIndex(x => x && x.id === 135), si = (await vst()).inv.findIndex(x => x && x.id === 109); await ev('__wk.pitch=1.25'); await wait(600);
  await ev("__vox.debug.set('hot'," + hi + ")"); await wait(400); await ev('__vox.debug.use()'); await wait(500); ok(((await vst()).target || [])[3] === 32, 'المعزقة تحوّل التراب لأرض زراعة');
  await ev("__vox.debug.set('hot'," + si + ")"); await wait(400); await ev('__vox.debug.use()'); await wait(600); ok(await ev('__vox.debug.crops()') >= 1, 'زرعت بذور: تسجّلت كمحصول');
  for (let k = 0; k < 7; k++) await ev('__vox.debug.growNow()'); await wait(800); ok(await ev('[...__vox.debug.W.chunks.values()].some(c => c.b.includes(40))'), 'المحصول يكبر لين مرحلة النضج (قمح ناضج)');
  // تعديل من لاعب ثاني (وصل من السيرفر): المكعب ينحذف عندي فعلاً ويتحدّث الرسم
  const rb = ((await vst()).target || [0, 30, 0]); const rx = rb[0] + 2, rz = rb[2] + 2, ry = await ev('__vox.debug.W.surface(' + rx + ',' + rz + ')'); const rbefore = await ev('__vox.debug.W.get(' + rx + ',' + ry + ',' + rz + ')'); await ev('__vox.debug.remote(' + rx + ',' + ry + ',' + rz + ',0)'); await wait(900); ok(rbefore !== 0 && await ev('__vox.debug.W.get(' + rx + ',' + ry + ',' + rz + ')') === 0, 'لاعب ثاني حذف مكعب: ينحذف عندي كذلك (مشترك)', 'كان ' + rbefore);
  await ev('__vox.debug.remote(' + rx + ',' + ry + ',' + rz + ',7)'); await wait(600); ok(await ev('__vox.debug.W.get(' + rx + ',' + ry + ',' + rz + ')') === 7, 'ولاعب ثاني بنى مكعب: يظهر عندي');
  // حفظ الأماكن: حفظ + علامة + رجوع
  await ev("document.getElementById('mcPlB').click()"); await wait(400); ok(await vis('mcPanel') && /احفظ مكاني/.test(await ev("document.getElementById('mcPanel').innerText")), 'لوحة الأماكن تفتح');
  await ev("document.querySelector('#mcPanel [data-plnew=\"1\"]').click()"); await wait(500); ok(await ev('__vox.debug.places().length') === 1, 'حفظت مكاني باسم «المنجم»'); const pl0 = JSON.parse(await ev('JSON.stringify(__vox.debug.places()[0])'));
  await wait(800); ok(await ev('__vox.debug.markerCount()') >= 1, 'علامة (عمود ضوء + اسم) ظهرت بمكان الحفظ'); ok(/المنجم/.test(await ev("document.getElementById('mcPanel').innerText")) && /رافقني/.test(await ev("document.getElementById('mcPanel').innerText")), 'القائمة فيها المكان وزر «رافقني»');
  await ev("document.querySelector('#mcPanel [data-x]').click()"); await ev('__vox.debug.setP(__vox.state().P.x + 40, __vox.state().P.z + 10)'); await wait(1500);
  await ev("document.getElementById('mcPlB').click()"); await wait(300); await ev("document.querySelector('#mcPanel [data-plgo]').click()"); await wait(2500); const pa = (await vst()).P; ok(Math.hypot(pa.x - (pl0.x + .5), pa.z - (pl0.z + .5)) < 3, 'اذهب: رجعت لمكاني المحفوظ', JSON.stringify([pa.x, pa.z]) + ' vs ' + pl0.x + ',' + pl0.z);
  ok(await ev("localStorage.getItem('mnalsifr_mc_craft')").then(s => JSON.parse(s).pl.length === 4), 'الأماكن تنحفظ بذاكرة المتصفح');
  await ev("document.getElementById('mcPlB').click()"); await wait(300); await ev("document.querySelector('#mcPanel [data-plwith]').click()"); await wait(600); ok(await vis('p21') && /المنجم/.test(await ev("document.getElementById('cqDest').innerText")), '«رافقني»: يفتح اختيار الأشخاص بالمكان المحفوظ كوجهة'); await ev("document.getElementById('cancel21').click()");
  // نظر عمودي لتحت: نكسّر البلوكة اللي تحت قدمك وننزل (مثل عالم البناء)
  await ev('__wk.pitch=1.25'); await wait(700); const pb = (await vst()).P.y, tdn = (await vst()).target; ok(tdn && tdn[1] === Math.floor(pb) - 1 && Math.floor(tdn[0]) === Math.floor((await vst()).P.x), 'ينظر عمودياً لتحت: المؤشر على البلوكة اللي تحت قدمك', JSON.stringify(tdn) + ' y=' + pb.toFixed(2));
  await ev("__vox.debug.set('mining',true)"); await wait(2500); await ev("__vox.debug.set('mining',false)"); await wait(1500); ok((await vst()).P.y < pb - .5, 'كسّرت اللي تحتك ونزلت للحفرة', pb.toFixed(2) + ' → ' + (await vst()).P.y.toFixed(2));
  // يدك بالشخص الأول + حفر بالضغط المتواصل على الشاشة (لمس)
  const hd = JSON.parse(await ev('JSON.stringify(__vox.debug.hand())')); ok(hd.vis === true, 'يدك ظاهرة بمنظور الشخص الأول'); await ev('__vox.debug.give(7,5)'); const wi = (await vst()).inv.findIndex(x => x && x.id === 7); await ev("__vox.debug.set('hot'," + wi + ")"); await ev('__vox.debug.give(7,1)'); await wait(500); ok(JSON.parse(await ev('JSON.stringify(__vox.debug.hand())')).held === 7, 'اليد تحمل المكعب المختار');
  await ev('__wk.pitch=1.25'); await wait(600); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 430 }] }); await wait(700); ok(await ev('__vox.debug.mining()'), 'ضغط مستمر بالإصبع على الشاشة يبدأ الحفر'); const cr2 = await ev('__vox.debug.crack()'); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400); ok(cr2 && !(await ev('__vox.debug.mining()')), 'الشقوق تظهر، ورفع الإصبع يوقف الحفر'); await shot('w1d_hand.png');
  // نهار فقط + منطقة محمية + اليد ما تعلق
  await ev('window.__PROT_R=30');
  ok(await ev('__vox.debug.prot(5,5)&&__vox.debug.prot(30,500)&&__vox.debug.prot(300,-175)&&__vox.debug.prot(90,190)&&!__vox.debug.prot(31,0)&&!__vox.debug.prot(300,-160)'), 'المنطقة المحمية: أول ٣٠ مكعب من حدود العالم (غرب/شمال/جنب مدينة المشتركين)');
  await ev('__vox.debug.setP(10.5, 10.5)'); await wait(600); await ev("__wk.pitch=1.25"); await wait(500); const pb4 = await ev('__vox.state().target?JSON.stringify(__vox.state().target):null');
  await ev("__vox.debug.set('mining',true)"); await wait(1800); await ev("__vox.debug.set('mining',false)"); ok(!(await ev('__vox.debug.crack()')), 'داخل المنطقة المحمية: ما تظهر شقوق حفر');
  await ev('window.__PROT_R=0'); await wait(200);
  const dayLit = await ev('document.getElementById("mcInfo")?1:0'); ok(dayLit === 1, 'واجهة اللعبة شغالة بدون وضع ليلي');
  // ركض بسحب العلامة لآخرها
  const vs0 = await vst(); ok(await ev('(__vox.move(0.016,0,1,true), __vox.debug.sprint())'), 'سحب علامة المشي لآخرها: ركض (أسرع)'); ok(!(await ev('(__vox.move(0.016,0,0.3,false), __vox.debug.sprint())')), 'سحب خفيف: مشي عادي');
  // الموت: أول مرة يرجع لبداية العالم، الثانية لبوابة عالم البناء بالمدينة، والأغراض باقية
  const invN = async () => (await vst()).inv.reduce((s, x) => s + (x ? x.n : 0), 0); const n0 = await invN();
  await ev('__vox.debug.die()'); await wait(2500); let sd = await vst(); ok(sd.fp && Math.abs(sd.P.x - 4.5) < 2 && Math.abs(sd.P.z - .5) < 2, 'أول موتة: رجعت لبداية عالم البناء', JSON.stringify([sd.P.x, sd.P.z])); ok(await invN() === n0, 'أغراضك ما ضاعت (أول موتة)');
  await ev('__vox.debug.die()'); await wait(1500); ok(await until(async () => !(await vst()).fp, 15000), 'ثاني موتة: انتقلت لبوابة عالم البناء بالمدينة'); ok(await invN() === n0, 'أغراضك ما ضاعت (ثاني موتة)');
  // المرافقة من داخل عالم البناء لمكان برّاه (الساحة)
  await goto(150, 0, -1.57); await ev('__wk.camYaw=-1.57'); ok(await until(async () => { await goto(150, 0, -1.57); return (await vst()).fp; }, 60000), 'رجعت داخل عالم البناء');
  await ev("__car.onNet({t:'cg',d:'plaza',me:0,n:'صاحبي'})"); await wait(1500); const pz = JSON.parse(await ev('JSON.stringify({x:__wk.p.x,z:__wk.p.z,P:__car.PLAZA()})')); ok(!(await vst()).fp && pz.x < pz.P.x + 140 && Math.hypot(pz.x - pz.P.x, pz.z - pz.P.z) < 160, 'مرافقة وأنت داخل عالم البناء لمكان برّاه (الساحة): تنتقل فعلاً', JSON.stringify([pz.x, pz.z]));
  await goto(150, 0, -1.57); await ev('__wk.camYaw=-1.57'); await until(async () => { await goto(150, 0, -1.57); return (await vst()).fp; }, 60000); await until(async () => (await vst()).P.onGround, 20000); await wait(500);
  // مشعل: تصنيع ووضع وإضاءة
  await ev('__vox.debug.give(101,1);__vox.debug.give(100,1)'); ok(await ev('__vox.debug.craftOut(27)'), 'تصنيع مشاعل: فحم + عصا ← 4 مشاعل'); const ti = (await vst()).inv.findIndex(x => x && x.id === 27); ok(ti >= 0 && (await vst()).inv[ti].n === 4, 'المشاعل بالشنطة');
  await ev("__vox.debug.set('hot'," + ti + ")"); await ev('__wk.pitch=1.2'); await wait(700); await ev('__vox.debug.use()'); await wait(500); ok(await ev('__vox.debug.W.lights.size') >= 1, 'وضعت مشعل: يتسجّل كمصدر إضاءة');
  const dv = await ev('__vox.debug.day()'); ok(dv >= .1 && dv <= 1, 'نظام النهار والليل يشتغل (سطوع ' + (+dv).toFixed(2) + ')'); await shot('w1c_torch.png');
  // ضرر وشفاء
  await ev(`__vox.debug.damage(6,'x')`); await wait(300); ok((await vst()).hp === 14, 'الضرر ينقص القلوب (14 من 20)');
  await shot('w2_hud.png');
  // نرجع للمدينة
  await ev('__vox.debug.setP(0.2, 0)'); ok(await until(async () => !(await vst()).fp, 20000), 'رجعت للمدينة: الكاميرا العادية ترجع'); await wait(500); ok(!(await ev('__vox.debug.hand().vis')), 'اليد/المكعب المحمول يختفي بعد الرجوع للمدينة (ما يعلق)'); ok(await ev('__wk.walker.root.visible') && !(await ev('document.body.classList.contains("vox")')), 'الشخصية ظهرت والواجهة العادية رجعت');
  await goto(128, 0); await ev(`__wk.camYaw=-1.57+Math.PI`); await wait(800); await shot('w3_gate.png');
} finally {
  console.log(`
${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
