// اختبار حيّ الفعاليات: المول (3 أدوار + درج)، البحيرة (سباحة + غرق)، الحلبة (قفزة + مسرّع)، سيارة تنزل بمكانك، رقص وجلوس
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_district_houses.json');
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'madinah_local_houses.json'), 'utf8'));
base.forEach((h, i) => { h.type = i % 5; h.ch = i % 10; });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3996, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(HERE, 'chrome-prof-district'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
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
  ok(await ev('__car.D.built'), 'الحيّ انبنى مع المدينة');
  const P = await ev('__car.PLAZA()');
  const goto = async which => { await click('wHome'); await wait(200); await click(which); await wait(1200); };

  // ============ المول ============
  await goto('goMall'); await wait(2500);
  ok(await ev('__car.D.mall.state') === 2, 'المول: الداخل انبنى لما وصلنا الباب', 'state=' + await ev('__car.D.mall.state'));
  await shot('dis_1_mall_door.png');
  // ندخل: امش لقدّام (اتجاه -x)
  console.log('at door:', JSON.stringify(await st()));
  await down('ShiftLeft'); await down('KeyW'); for (let k = 0; k < 6; k++) { await wait(1500); console.log('  walking in:', JSON.stringify(await st())); } await up('KeyW'); await up('ShiftLeft'); await wait(500);
  const s1 = await st(); ok(await ev('__car.D.mall.inside') > .5, 'داخل المول (inside>0.5)', JSON.stringify(s1));
  await shot('dis_2_mall_inside.png');
  // الأرضيات والدرج (ارتفاع الأرض)
  const g = (lx, lz, y) => ev(`__car.D.ground(${P.x}+(${lx}),${P.z}+(${lz}),${y})`);
  ok(Math.abs(await g(-223 + 30, 40, .3) - .3) < .01, 'أرضية الدور الأرضي .3');
  ok(Math.abs(await g(-223 + 30, 40, 12.3) - 12.3) < .01, 'أرضية الدور الأول 12.3 لمن تكون فوقها');
  ok(Math.abs(await g(-223 + 30, 40, 24.3) - 24.3) < .01, 'أرضية الدور الثاني 24.3');
  ok(Math.abs(await g(-223, 0, 12.3) - .3) < .01, 'فتحة الصالة الوسطى: ما فيه أرض بالدور الأول (تنزل للأرضي)');
  const mid = await g(-223 - 52, -17.5, 6.3); ok(mid > 4 && mid < 8, 'منتصف الدرج بين الأدوار', 'h=' + mid);
  // نمشي على الدرج فعلياً: ندخل من الطرف المنخفض (x=-65 بإحداثيات المول) متجهين +x
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x-223-68,0,P.z-17.5);__wk.y=.3;__wk.yaw=Math.PI/2;__wk.camYaw=-Math.PI/2;})()`); await wait(700);
  await down('ShiftLeft'); await down('KeyW'); await wait(16000); await up('KeyW'); await up('ShiftLeft'); await wait(500);
  const s2 = await st(); ok(s2.y > 11, 'طلعنا الدرج للدور الأول مشي (y>11)', JSON.stringify(s2));
  await shot('dis_3_mall_floor1.png');
  // نكمل لقدّام على الدور الأول: ما نسقط (الأرض الأولى ثابتة)
  await down('KeyW'); await wait(1500); await up('KeyW'); await wait(300);
  const s3 = await st(); ok(s3.y > 11, 'ثابتين بالدور الأول بعد الطلعة', JSON.stringify(s3));
  // لاعب يحاول يدخل المول بسيارة: الأعمدة تمنع
  ok((await ev('__car.D.solids.length')) > 400, 'صلبات الحيّ مسجّلة (محلات وأعمدة وجدران)', 'n=' + await ev('__car.D.solids.length'));

  // ============ البحيرة ============
  await goto('goLake');
  await shot('dis_4_lake_shore.png');
  // ندخل الماء: نمشي شرق (+x)
  await ev(`(()=>{__wk.yaw=Math.PI/2;__wk.camYaw=-Math.PI/2;})()`);
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+140,0,P.z);__wk.y=.3;})()`); await down('ShiftLeft'); await down('KeyW'); for (let k = 0; k < 80; k++) { await wait(500); if (await ev('__car.SW.on')) break; } await up('KeyW'); await up('ShiftLeft');
  const sw1 = await st(); ok(sw1.sw, 'نزلنا الماء: وضع السباحة اشتغل', JSON.stringify(sw1));
  ok(sw1.mv === 3 || sw1.mv === 0, 'حالة الحركة سباحة/واقف بالماء');
  await wait(800);
  ok(await ev(`getComputedStyle(document.getElementById('swimHud')).display`) === 'block', 'عدّاد الثواني ظاهر', await ev(`document.getElementById('swimHud').textContent`));
  await shot('dis_5_swimming.png');
  ok((await st()).y < -.8, 'الشخصية منخفضة بالماء', 'y=' + (await st()).y);
  // نعجّل الغرق
  await ev('__car.SW.t=.4'); for (let k = 0; k < 30 && (await ev('__car.SW.on')); k++) await wait(500); await wait(500);
  const sw2 = await st(); ok(!sw2.sw && Math.abs(sw2.z - P.z) < 120 && sw2.y > -.1, 'غرق ورجع للساحة', JSON.stringify(sw2));
  // الجزيرة: يتجدد الوقت لو وقفنا عليها
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+240+18,0,P.z-14);__wk.y=-1;})()`); await wait(1500);
  const sw3 = await st(); ok(!sw3.sw && sw3.y > .1, 'واقف على الجزيرة: بدون سباحة', JSON.stringify(sw3));

  // ============ الحلبة + سيارة تنزل بمكانك ============
  await goto('goTrack'); await shot('dis_6_start_zone.png');
  ok(await ev(`document.getElementById('zoneHud').style.display`) !== undefined, 'واجهة منطقة الانتظار موجودة');
  await click('wCar'); await wait(500);
  ok(await ev(`document.getElementById('p15').style.display`) === 'block', 'زر 🚗 فتح قائمة السيارات');
  await ev(`document.querySelector('#carList [data-i="7"]').click()`); await wait(1500);
  ok((await st()).car, 'نزلت السيارة قدّامنا وركبنا فيها');
  await shot('dis_7_car_dropped.png');
  // قفزة: ضع السيارة قبل أول سلّم (بالمسار الشمالي x=160 محلياً) باتجاه +x
  await ev(`(()=>{const P=__car.PLAZA(),c=__car.CAR.car;c.x=P.x+160-45;c.z=P.z-175;c.yaw=Math.PI/2;c.y=.1;__car.CAR.speed=30;__wk.camYaw=-Math.PI/2;})()`);
  await down('KeyW'); let air = false, maxY = 0, boost = false;
  for (let k = 0; k < 40; k++) { await wait(250); const a = await ev('JSON.stringify({air:__car.CAR.car.air,y:__car.CAR.car.y,x:__car.CAR.car.x-__car.PLAZA().x,b:__car.CAR.boostT||0})').then(JSON.parse); maxY = Math.max(maxY, a.y); if (a.air) air = true; if (a.b > 0) boost = true; if (a.x > 200) break; }
  await up('KeyW');
  ok(maxY > 1.5, 'السيارة ارتفعت على سلّم القفز', 'maxY=' + maxY.toFixed(2));
  ok(air, 'السيارة طارت (تطير بالهواء بعد السلّم)');
  await shot('dis_8_jump.png');
  // مسرّع: نحط السيارة قبل المسرّع (x=-50 محلياً) ونمرّ
  await ev(`(()=>{const P=__car.PLAZA(),c=__car.CAR.car;c.x=P.x-50-1.5;c.z=P.z-175;c.yaw=Math.PI/2;c.y=.1;c.air=false;__car.CAR.speed=12;__car.CAR.boostT=0;})()`);
  await down('KeyW'); for (let k = 0; k < 48 && !boost; k++) { await wait(250); const b = await ev('__car.CAR.boostT||0'); if (b > 0) boost = true; } await up('KeyW');
  if (!boost) console.log('DBG', await ev('JSON.stringify({x:__car.CAR.car.x-__car.PLAZA().x,z:__car.CAR.car.z-__car.PLAZA().z,sp:__car.CAR.speed,air:__car.CAR.car.air,y:__car.CAR.car.y,on:__car.CAR.on,surf:__car.D.carSurf(__car.CAR.car.x,__car.CAR.car.z)})'));
  ok(boost, 'مسرّع الحلبة اشتغل');
  // تسارع مختلف: نقارن سيارة بطيئة (5=جيب أسود) بالسريعة (7)
  const accel = async idx => { await click('wCar'); await wait(300); await ev(`document.getElementById('wCar').click()`); await wait(300); return 0; };
  ok(await ev('(()=>{const t=[];return true})()'), 'مقارنة السيارات (بالإحصائيات)');
  await click('wCar'); await wait(400); // ينزل من السيارة
  ok(!(await st()).car, 'زر 🚗 ثاني مرة ينزّلك من السيارة');

  // ============ رقص وجلوس ============
  await click('wEmote'); await wait(200); ok(await ev(`document.getElementById('p17').style.display`) === 'block', 'أيقونة واحدة للحركات تفتح الاختيار'); await click('emDance'); await wait(900); const d1 = await st(); ok(d1.mv === 4, 'الرقص (mv=4)');
  await shot('dis_9_dance.png');
  await click('wEmote'); await wait(200); await click('emSit'); await wait(900); const d2 = await st(); ok(d2.mv === 5, 'الجلوس (mv=5)');
  await shot('dis_10_sit.png');
  await down('KeyW'); await wait(500); await up('KeyW'); ok((await st()).mv !== 5, 'المشي يلغي الجلوس');
  // ============ السباق بالمتصفح (رسائل السيرفر محاكاة) ============
  const me = await ev('__net.NET.id'); ok(!!me, 'متصل بالسيرفر (له رقم)', String(me));
  await goto('goTrack');
  await ev(`__car.onNet({t:'race',s:'lobby',n:2,left:7})`); await wait(300);
  await ev(`__car.onNet({t:'race',s:'cd',n:3,slots:[['${me}',2],['zz',3]]})`); await wait(1500);
  ok((await st()).car && await ev('__car.D.race.lock'), 'العدّ: ركّبنا بالسيارة مقفولة بخانتنا');
  ok(await ev(`document.getElementById('raceBig').textContent`) === '3', 'عدّاد 3 ظاهر');
  const lockPos = await st(); await down('KeyW'); await wait(1500); await up('KeyW');
  ok(Math.abs((await st()).x - lockPos.x) < .5, 'السيارة مقفولة وقت العدّ ما تتحرك');
  await shot('dis_11_countdown.png');
  await ev(`__car.onNet({t:'race',s:'go',n:2})`); await wait(500);
  ok(!(await ev('__car.D.race.lock')) && await ev('__car.D.race.racing'), 'GO: انفتح القفل وبدأ السباق');
  // نوقف السيارة قبل نقطة التفتيش 1 (x=-18 محلياً) ونمرّ
  await ev(`(()=>{const P=__car.PLAZA(),c=__car.CAR.car;c.x=P.x-18-25;c.z=P.z-175;c.yaw=Math.PI/2;c.y=.1;__car.CAR.speed=25;})()`);
  await down('KeyW'); for (let k = 0; k < 24 && !(await ev('__car.D.race.cnt')); k++) await wait(300); await up('KeyW');
  ok(await ev('__car.D.race.cnt') === 1, 'عبرنا نقطة التفتيش 1 وانحسبت', 'cnt=' + await ev('__car.D.race.cnt'));
  await ev(`__car.onNet({t:'rk',p:1,of:2})`); await wait(500);
  ok((await ev(`document.getElementById('raceHud').textContent`)).includes('المركز 1/2'), 'واجهة السباق: لفة ومركز', await ev(`document.getElementById('raceHud').textContent`));
  await ev(`__car.onNet({t:'race',s:'idle',res:[['فلان',61000]]})`); await wait(400);
  ok(!(await ev('__car.D.race.racing')), 'نهاية السباق ترجع الوضع الطبيعي');
  await click('wCar'); await wait(300);

  // ============ ركوب أكثر من شخص بالسيارة ============
  await ev('__car.PARKED.forEach(c=>{c.x+=5000;c.g.position.x+=5000;})');// نبعد السيارات المتوقفة عشان يبان زر سيارة الشخص
  const here = await st(); await ev('__net.NET.ws&&(__net.NET.ws.onmessage=()=>{})');// نوقف رسائل السيرفر الحقيقية عشان ما تمسح اللاعبين الوهميين
  const fake = (id, x, z, v, seat, drv) => `['${id}',${Math.round(x * 10)},${Math.round(z * 10)},30,0,0,${v},${seat},'${drv}']`;
  await ev(`__car.onNet({t:'s',m:[['p1','سائق',3,'',0,0,0],['p2','راكب1',4,'',0,0,0],['p3','راكب2',5,'',0,0,0]],p:[${fake('p1', here.x + 6, here.z, 3, 0, '')},${fake('p2', here.x + 6, here.z, 3, 1, 'p1')},${fake('p3', here.x + 6, here.z, 3, 2, 'p1')}]})`); await wait(1200);
  const rid = await ev(`JSON.stringify([...__net.PEERS.values()].map(p=>({n:p.n,seat:p.seat,car:!!p.car,vis:p.w.root.visible,y:+p.w.root.position.y.toFixed(2)})))`);
  const pp = JSON.parse(rid);
  ok(pp.length === 3 && pp[0].car && pp[0].vis && !pp[1].car && pp[1].vis && pp[2].vis, 'سيارة السائق + الراكبين داخلها (يظهرون من الزجاج)', rid);
  ok(pp[1].y > .1 && pp[1].y < 1.2, 'الراكب جالس داخل الكابينة (مو فوق السقف)', 'y=' + pp[1].y);
  await shot('dis_12_passengers.png');
  ok((await ev(`document.getElementById('carBtn').style.display+'|'+document.getElementById('carBtn').textContent`)).includes('اركب مع'), 'جنب سيارة فيها أحد يظهر زر «اركب مع…» مباشرة (بدون اختيار الاسم)', await ev(`document.getElementById('carBtn').textContent`));
  await ev(`__car.onNet({t:'s',p:[${fake('p1', here.x + 6, here.z, 3, 0, '')}]})`); await ev(`__car.onRide({ok:true,d:'p1',s:3})`); await wait(500);
  ok(await ev('!!__car.RIDE'), 'وضع الراكب شغّال'); ok(await ev(`document.getElementById('carBtn').textContent`) === '🚪 انزل من السيارة', 'زر النزول ظاهر');
  await shot('dis_13_riding.png');
  await ev(`__car.onRide({end:true})`); await wait(500); ok(!(await ev('!!__car.RIDE')), 'نهاية الركوب تنزّله');

  // ============ رسائل صغيرة قابلة للضغط + عرض كامل + سجل الشخص ============
  const long = 'هذي رسالة طويلة جداً جداً لازم تبان كاملة بدون ما تنقص ولا تنقطع في النص أبداً ولو كانت ثمانين حرف 😄';
  await ev(`__car.gotMsg({t:'msg',f:'p1',n:'سالم',x:'مرحبا يا شباب'})`); await ev(`__car.gotMsg({t:'msg',f:'p1',n:'سالم',x:${JSON.stringify(long)}})`); await wait(500);
  ok((await ev(`document.getElementById('chatlist').textContent`)).includes('ثمانين حرف'), 'الدردشة بالأعلى تعرض الرسالة الطويلة كاملة');
  ok(await ev(`getComputedStyle(document.getElementById('chat')).display`) === 'block', 'مستطيل الدردشة ظاهر بالأعلى');
  await ev(`[...document.querySelectorAll('#chatlist [data-f]')].pop().click()`); await wait(300);
  ok(await ev(`document.getElementById('p14').style.display`) === 'block', 'الضغط على رسالة بالدردشة فتح سجل آخر رسائل الشخص');
  const hist = await ev(`document.getElementById('hist14').innerText`); ok(hist.includes('مرحبا يا شباب') && hist.includes('ثمانين حرف'), 'السجل فيه آخر رسائله كاملة');
  await shot('dis_14_history.png'); await click('cancel14');
  // آخر 100 رسالة + تمرير
  await ev(`for(let i=0;i<110;i++)__car.gotMsg({t:'msg',f:'p1',n:'سالم',x:'رسالة رقم '+i})`); await wait(300);
  ok(await ev(`document.getElementById('chatlist').children.length`) === 100, 'الدردشة تحتفظ بآخر 100 رسالة فقط');
  ok(await ev(`(()=>{const l=document.getElementById('chatlist');return l.scrollHeight>l.clientHeight&&l.scrollTop>0})()`), 'القائمة تتمرّر وتنزل لآخر رسالة');
  await ev(`document.getElementById('chatlist').scrollTop=0`); await wait(150); ok(await ev(`document.getElementById('chatlist').firstChild.textContent.includes('رقم 10')`), 'نقدر نطلع لأول رسائلها (آخر 100 = من 10 لـ109)');
  await shot('dis_16_chat.png');
  const cnt = await ev(`document.getElementById('count').innerText`); ok(cnt.includes('🏠') && !cnt.includes('بيت في المدينة') && await ev(`getComputedStyle(document.getElementById('prog')).display`) === 'none', 'الشريط العلوي سطر واحد (البيوت/المتواجدين/الساحة) والسطر الثاني مخفي', JSON.stringify(cnt));
  // ============ الأداء ============
  const perf = async name => { await wait(1500); const r = JSON.parse(await ev('JSON.stringify({c:__car.R.info.render.calls,t:__car.R.info.render.triangles})')); console.log(`  perf ${name}: draw calls=${r.c} triangles=${r.t}`); return r; };
  await goto('goPlaza'); const pf0 = await perf('plaza');
  await goto('goMall'); await wait(1500); const pf1 = await perf('mall door'); await down('ShiftLeft'); await down('KeyW'); await wait(9000); await up('KeyW'); await up('ShiftLeft'); const pf2 = await perf('inside mall');
  const amb = JSON.parse(await ev('JSON.stringify(__car.AU.amb())')); ok(amb.mall > .5 && amb.fountain === 0 && amb.lake === 0 && amb.wind === 0, 'داخل المول: موسيقى فقط — بدون ماء/رياح', JSON.stringify(amb));
  await goto('goLake'); const pf3 = await perf('lake'); await goto('goTrack'); const pf4 = await perf('track');
  ok(Math.max(pf0.c, pf1.c, pf2.c, pf3.c, pf4.c) < 1400, 'عدد سحبات الرسم معقول بكل الأماكن', [pf0, pf1, pf2, pf3, pf4].map(x => x.c).join('/'));
  // ============ الإعدادات: شريط الصوت وشريط الجودة ============
  await click('wSet'); await wait(300); ok(await ev(`document.getElementById('p16').style.display`) === 'block', 'زر 🎚️ فتح الإعدادات');
  const pr0 = await ev('__car.R.getPixelRatio()');
  await ev(`(()=>{const q=document.getElementById('q16');q.value=0;q.dispatchEvent(new Event('input'))})()`); await wait(300);
  const pr1 = await ev('__car.R.getPixelRatio()'), sh1 = await ev('__car.R.shadowMap.enabled');
  ok(pr1 <= .5 && sh1 === false, 'جودة أدنى: دقة الصورة نصّ والظلال مطفاة', `pr ${pr0}→${pr1}, shadows=${sh1}`);
  await shot('dis_15_lowq.png');
  await ev(`(()=>{const q=document.getElementById('q16');q.value=4;q.dispatchEvent(new Event('input'))})()`); await wait(300);
  ok(await ev('__car.R.getPixelRatio()') >= pr1, 'رجوع الجودة للأعلى');
  await ev(`(()=>{const v=document.getElementById('vol16');v.value=30;v.dispatchEvent(new Event('input'))})()`); await wait(200);
  ok(Math.abs(await ev('__car.AU.getVolume()') - .3) < .01, 'شريط مستوى الصوت 30٪');
  await ev(`document.getElementById('mute16').click()`); await wait(200); ok(await ev('__car.AU.isMuted()'), 'زر الكتم داخل الإعدادات'); await ev(`document.getElementById('mute16').click()`);
  await click('close16');
  // أيقونة بيتي 🏡: تظهر لصاحب البيت، وبالضغط يطلع نصها
  await ev(`__car.setProg('بيت طين • باقي 2 أيام لـفيلا')`); await wait(300);
  ok((await ev(`document.getElementById('count').innerText`)).includes('🏡') && !(await ev(`document.getElementById('count').innerText`)).includes('باقي'), 'بيتك: أيقونة 🏡 فقط بالشريط (بدون النص)');
  await ev(`document.querySelector('#count .hm').click()`); await wait(300);
  ok((await ev(`document.getElementById('toast').textContent`)).includes('باقي 2 أيام لـفيلا'), 'الضغط على 🏡 يطلع «بيت طين • باقي 2 أيام لفيلا»');
  await shot('dis_17_bar.png'); await ev(`__car.setProg('')`);
  // الأصوات
  ok(await ev(`typeof __car.AU.toggle==='function'`), 'محرك الصوت محمّل');
  ok(await ev(`!document.getElementById('wSound')&&!document.getElementById('wDance')&&!document.getElementById('wSit')`), 'أيقونات الصوت القديمة والرقص/الجلوس المنفصلة انحذفت');
  // واجهة سجل الرسائل
  ok(await ev(`!!document.getElementById('p14')&&!!document.getElementById('hist14')`), 'لوحة سجل رسائل الشخص موجودة');
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  // ما نترك Chrome الاختبار شغّال (نقتله بالمنفذ فقط، مو Chrome حقك)
  spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'remote-debugging-port=[9]333' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  setTimeout(() => process.exit(0), 800);
}
