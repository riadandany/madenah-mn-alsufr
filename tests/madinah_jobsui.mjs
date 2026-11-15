// اختبار واجهة الوظائف بالمتصفح: أيقونة 💼 واللوحة، المباني صلبة، السجن داخل الزنزانة، الإصابة والمستشفى، الحرامي، أزرار بطاقة الشخص
// node tests/madinah_jobsui.mjs server.js <مجلد_الصور>   (شغّله وحده؛ احذف tests/chrome-prof-jobs قبله)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [SERVER, OUTDIR] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'madinah_jobsui_houses.json'), ADMIN = 'admintok-jobsui';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'craft.json']) { try { fs.unlinkSync(path.join(HERE, f)); } catch {} }
const base = []; for (let p = 0; p < 120; p++) base.push({ id: 'h' + String(p).padStart(9, '0'), plot: p, type: p % 5, name: p === 20 ? 'بيت المالك' : 'بيت' + p, t: 1, dev: p === 20 ? 'devOWN-xxxxxxxx' : 'dev' + p + '-xxxxxxxx', ip: 'ip' + p, days: 3, last: '2000-01-01', lk: [], ch: p % 10, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(base));
const PORT = 3977, URL0 = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, JAIL_MS: '60000', THIEF_MIN: '999' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
// لاعب ثاني (Node) = الأدمن/شخص قريب
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: 'http://127.0.0.1:' + PORT, 'X-Forwarded-For': '10.9.' + (ipN++) + '.7' } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } else if (len === 127) { len = Number(c.buf.readBigUInt64BE(2)); off = 10; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { try { c.inbox.push(JSON.parse(s)); } catch {} } } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9355', '--user-data-dir=' + path.join(HERE, 'chrome-prof-jobs'), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=420,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra && !c ? '  → ' + extra : '')); };
let AD = null, NB = null, keep = null;
try {
  let tgt;
  for (let k = 0; k < 40 && !tgt; k++) { await wait(300); try { tgt = (await (await fetch('http://127.0.0.1:9355/json')).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map(a => a.value || a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' @ ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('mnalsifr_welcomed','1');localStorage.setItem('mnalsifr_nobuild','1');localStorage.setItem('mnalsifr_dev','devOWN-xxxxxxxx');localStorage.setItem('mnalsifr_jobnote','x')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async name => { if (!OUTDIR) return; const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64')); };
  const waitWalk = async () => { for (let k = 0; k < 40; k++) { if (await ev('__wk.on&&!__wk.intro')) return; await wait(400); } };
  const until = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await wait(250); } return false; };
  await send('Page.navigate', { url: URL0 });
  for (let k = 0; k < 60; k++) { await wait(500); if (await ev('!!window.__ok')) break; }
  await wait(1500); await waitWalk();
  const vis = id => ev(`(()=>{const e=document.getElementById('${id}');return !!e&&getComputedStyle(e).display!=='none';})()`);
  const txt = id => ev(`(()=>{const e=document.getElementById('${id}');return e?e.innerText:'';})()`);
  const loc = () => ev(`(()=>{const P=__car.PLAZA();return [+(__wk.p.x-P.x).toFixed(1),+(__wk.p.z-P.z).toFixed(1)];})()`);
  const goto = async (lx, lz) => { await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x+(${lx}),0,P.z+(${lz}));__wk.y=0.3;})()`); await wait(900); };
  const myId = await ev('__net.NET.id');
  ok(await ev('typeof __jobs==="object"&&!!__jobs.info'), 'ملف الوظائف تحمّل ووصل ملخص الوظائف من السيرفر');
  ok(await ev(`!!document.querySelector('#count [data-jobs]')`) && /14/.test(await ev(`document.querySelector('#count [data-jobs]').innerText`)), 'أيقونة 💼 فوق عليها عدد الوظائف المتاحة (14)', await ev(`(document.querySelector('#count [data-jobs]')||{}).innerText`));
  await ev(`document.querySelector('#count [data-jobs]').click()`); await wait(500);
  ok(await vis('p40') && (await txt('jBody')).includes('شرطي') && (await txt('jBody')).includes('طبيب') && (await txt('jBody')).includes('موظف المول'), 'لوحة الوظائف تفتح وفيها الثلاث وظائف');
  ok(await ev(`document.querySelectorAll('#jBody [data-ja]').length===3`), 'أزرار «قدّم» ظاهرة (عندي بيت ومستوى كافي)');
  await shot('j_panel.png');
  await ev(`document.querySelector('#jBody [data-ja="police"]').click()`); await wait(900);
  ok(await ev(`__jobs.info.app==='police'`) && /قيد المراجعة/.test(await txt('jBody')), 'قدّمت على شرطي وصار «طلبك قيد المراجعة»');
  // الأدمن (لاعب ثاني) يقبل
  AD = await client(); AD.send({ t: 'hi', d: 'devAdmin-jobsui', n: 'x' }); await wait(400); AD.send({ t: 'admin', k: ADMIN }); await wait(400);
  AD.send({ t: 'jm' }); await wait(500); const jm = [...AD.inbox].reverse().find(m => m.t === 'jm'); AD.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); await wait(300);
  AD.send({ t: 'jd', k: jm.apps[0][0], ok: true }); keep = setInterval(() => { AD.send({ t: 'jb' }); if (NB) NB.send({ t: 'jb' }); }, 4000);
  ok(await until(`!!__jobs.my&&__jobs.my.j==='police'`), 'الأدمن قبلني → صرت شرطي');
  ok(await until(`__wk.walker.key&&__wk.walker.key.startsWith('16:')`), 'شخصيتي لبست زي الشرطة', await ev('__wk.walker.key'));
  await ev(`document.getElementById('cancel40').click()`); await wait(300);
  // المباني صلبة (ما يمشي منها اللاعب)
  const sol = (lx, lz) => ev(`(()=>{const P=__car.PLAZA();return __car.solidAt(P.x+(${lx}),P.z+(${lz}),0.3);})()`);
  await goto(-70, -130); await wait(1500);
  ok(await sol(-70, -158) && await sol(-112, -137) && await sol(-100, -148), 'مركز الشرطة: الجدار الخلفي والجانبي وقضبان الزنزانة صلبة');
  ok(!(await sol(-70, -116)) && !(await sol(-70, -130)), 'باب المركز واللوبي مفتوحين للمشي');
  await shot('j_police.png');
  await goto(39, -130); await wait(1500);
  ok(await sol(18, -137) && await sol(60, -137) && await sol(22.5, -154) && !(await sol(39, -116)), 'المستشفى: الجدران والأسرّة صلبة والباب مفتوح');
  await shot('j_hospital.png');
  // لاعب قريب → أزرار الشرطة ببطاقته
  NB = await client(); NB.send({ t: 'hi', d: 'dev7-xxxxxxxx', n: 'x' }); await wait(400);
  const myAbs = JSON.parse(await ev('JSON.stringify([__wk.p.x,__wk.p.z])')); NB.send({ t: 'p', x: myAbs[0] + 3, z: myAbs[1], y: .3, r: 0, m: 0 }); const nbId = [...NB.inbox].reverse().find(m => m.t === 'me').id;
  ok(await until(`__net.PEERS.has('${nbId}')`), 'اللاعب الثاني ظاهر جنبي');
  await ev(`__jobs.card('${nbId}')`); await wait(200); const c7 = await txt('job7');
  ok(/اسجنه/.test(c7), 'بطاقة الشخص فيها زر «🚔 اسجنه» للشرطي', c7);
  await ev(`document.querySelector('#job7 [data-jc="jj"]').click()`); await wait(200);
  ok(/اختر سبب السجن/.test(await txt('job7')) && await ev(`document.querySelectorAll('#job7 [data-jj]').length===6`), 'السجن يطلب سبب من 6 أسباب جاهزة');
  NB.inbox.length = 0; await ev(`document.querySelector('#job7 [data-jj="1"]').click()`); await wait(300);
  ok(/هل أنت متأكد من سجن/.test(await ev("document.getElementById('sureBox').innerText")), 'السجن يسأل تأكيد بالاسم', await ev("document.getElementById('sureBox').innerText"));
  await ev("document.querySelector('#sureBox [data-sy=\"1\"]').click()"); await wait(900);
  ok(!!NB.inbox.find(m => m.t === 'jl' && m.on === 1), 'سجنت اللاعب الثاني فعلاً (السيرفر أرسل له السجن)');
  await wait(1200); ok(await ev(`(()=>{const m=__net.PEERS.get('${nbId}');return !!m&&(m.f&4)>0;})()`), 'شكله صار «🔒 مسجون» عند الناس');
  // أنا أنسجن (الأدمن)
  AD.send({ t: 'jj', f: myId, r: 0 }); ok(await until('__jobs.jailed()'), 'الأدمن سجنني');
  await wait(1200); let L = await loc(); ok(L[1] < -148 && L[1] > -158 && L[0] < -57 && L[0] > -112, 'انتقلت داخل زنزانة', JSON.stringify(L));
  ok(await vis('jobHud') && /مسجون/.test(await txt('jobHud')) && /اعتراض/.test(await txt('jobHud')) && /كفالة/.test(await txt('jobHud')), 'شريط السجن: الوقت + اعتراض + كفالة');
  await shot('j_jail.png');
  await ev(`(()=>{const P=__car.PLAZA();__wk.p.set(P.x,0,P.z);})()`); await wait(1200); L = await loc(); ok(L[1] < -148 && L[1] > -158, 'لو حاول يطلع (حتى بانتقال) يرجع للزنزانة', JSON.stringify(L));
  await ev(`__car.CAR&&0`); const before = await loc(); await ev(`document.getElementById('wHome').click()`); await wait(200); await ev(`document.getElementById('goPlaza')&&document.getElementById('goPlaza').click()`); await wait(900); L = await loc(); ok(L[1] < -148, '«🏠 الساحة» ما تطلّعه من السجن');
  await ev(`__jobs.noCar()`); ok(await ev('__jobs.noCar()') === true, 'المسجون ما يقدر يسوق');
  AD.send({ t: 'jr', f: myId }); ok(await until('!__jobs.jailed()'), 'الأدمن أطلقني');
  await wait(900); L = await loc(); ok(L[1] > -116 && Math.abs(L[0] + 70) < 6, 'طلعت قدّام باب مركز الشرطة', JSON.stringify(L));
  // الإصابة + المستشفى
  await ev('__jobs.hurt(0)'); ok(await until('__jobs.inj()'), 'انصبت 🤕');
  ok(await ev('__jobs.spd()') === .6 && await ev('__jobs.noCar()') === true && /مصاب/.test(await txt('jobHud')), 'المصاب: أبطأ، ما يسوق، وشريط الإصابة ظاهر');
  await ev(`document.querySelector('#jobHud [data-hh]').click()`); await wait(800); L = await loc(); ok(L[0] > 19 && L[0] < 59 && L[1] < -148, '«خذني للمستشفى» ينقلني عند الأسرّة', JSON.stringify(L));
  ok(await until('!__jobs.inj()', 30000), 'وقفت عند السرير 20 ثانية → تعالجت');
  // الحرامي
  AD.send({ t: 'thn' }); ok(await until('!!__jobs.th'), 'بدأت فعالية الحرامي ووصلتني');
  ok(/حرامي هارب/.test(await txt('jobHud')), 'شريط «🚨 حرامي هارب» مع المسافة');
  await ev(`window.__chase=setInterval(()=>{const th=__jobs.th;if(!th)return;const P=__car.PLAZA();const d=th.o+th.sp*((Date.now()+__fair.off)-th.t0)/1000;const T=[[0,-40],[4,-78],[3,-104],[-10,-124],[-12,-140],[6,-147],[12,-128],[9,-104],[15,-78],[28,-29],[39,-9],[40,10],[31,26],[15,37],[0,41],[-15,37],[-28,28],[-38,12],[-40,-8],[-31,-26],[-16,-37]];let L=0;for(let i=0;i<T.length;i++){const a=T[i],b=T[(i+1)%T.length];L+=Math.hypot(b[0]-a[0],b[1]-a[1]);}let r=((d%L)+L)%L;for(let i=0;i<T.length;i++){const a=T[i],b=T[(i+1)%T.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(r<=l){const u=r/l;__wk.p.set(P.x+a[0]+(b[0]-a[0])*u,0,P.z+a[1]+(b[1]-a[1])*u);break;}r-=l;}},60)`);
  await wait(1500); await shot('j_thief.png');
  ok(await until('!__jobs.th', 12000), 'قرّبت من الحرامي ومسكته');
  await ev('clearInterval(window.__chase)');
  // مسار الحرامي ما يمر داخل مجسمات (نفحص كل 3م)
  const bad = await ev(`(()=>{const P=__car.PLAZA(),T=[[0,-40],[4,-78],[3,-104],[-10,-124],[-12,-140],[6,-147],[12,-128],[9,-104],[15,-78],[28,-29],[39,-9],[40,10],[31,26],[15,37],[0,41],[-15,37],[-28,28],[-38,12],[-40,-8],[-31,-26],[-16,-37]],out=[];for(let i=0;i<T.length;i++){const a=T[i],b=T[(i+1)%T.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let s=0;s<l;s+=3){const x=a[0]+(b[0]-a[0])*s/l,z=a[1]+(b[1]-a[1])*s/l;if(__car.solidAt(P.x+x,P.z+z,.3))out.push([+x.toFixed(0),+z.toFixed(0)]);}}return JSON.stringify(out);})()`);
  ok(bad === '[]', 'مسار الحرامي ما يمر من داخل أي مجسم', bad);
  // لافتات القوانين داخل المباني
  const look = async (lx, lz, yaw, name) => { await goto(lx, lz); await ev(`__wk.yaw=${yaw};__wk.camYaw=${yaw}+Math.PI;__wk.pitch=.12;__wk.dist=5;__wk.cur=5;`); await wait(2200); await shot(name); };
  await look(-104.5, -130, -Math.PI / 2, 'j_rules_police.png'); await look(52.5, -134, Math.PI / 2, 'j_rules_hospital.png'); await look(-140, -19, Math.PI / 2, 'j_rules_mall.png');
  await ev('__wk.dist=8;__wk.pitch=.35;'); ok(/فصل فوري/.test(await ev("(()=>{__jobs.open('jobs');return document.getElementById('jBody').innerText;})()")), 'لوحة الوظائف فيها الممنوعات والعقوبة'); await ev("document.getElementById('cancel40').click()");
  // لقطة من فوق للمباني
  await goto(-20, -95); await ev('__wk.camYaw=0;__wk.pitch=.75;__wk.dist=95;__wk.cur=95;'); await wait(2500); await shot('j_aerial.png'); await ev('__wk.dist=8;__wk.pitch=.35;');
  // الاستقالة
  await ev(`__jobs.open('my')`); await wait(400); ok(/استقيل/.test(await txt('jBody')), 'تبويب وظيفتي فيه الامتيازات وزر الاستقالة');
  await ev(`document.querySelector('#jBody [data-jres]').click()`); await wait(300); await ev("document.querySelector('#sureBox [data-sy=\"1\"]').click()"); ok(await until('!__jobs.my'), 'استقلت → رجعت شخص عادي');
  ok(await until(`__wk.walker.key&&!__wk.walker.key.startsWith('16:')`), 'الزي انشال عن شخصيتي');
  // ---- 🛒 بيع موظف المول ----
  AD.send({ t: 'jr', f: nbId }); await wait(400); AD.send({ t: 'jh', f: nbId, j: 'mall' }); await wait(800);
  await goto(-198, 0); const mAbs = JSON.parse(await ev('JSON.stringify([__wk.p.x,__wk.p.z])')); NB.send({ t: 'p', x: mAbs[0] - 2, z: mAbs[1], y: .3, r: 0, m: 0 }); await wait(1200);
  NB.inbox.length = 0; NB.send({ t: 'jo', f: myId, i: 't:1' });
  ok(await until(`getComputedStyle(document.getElementById('joBox')).display!=='none'`), 'وصلني عرض موظف المول (نافذة الشراء)', JSON.stringify(NB.inbox.filter(m => m.t === 'err' || m.t === 'jx')));
  ok(/خصم 10%/.test(await txt('joBox')) && /45/.test(await txt('joBox')), 'العرض فيه السعر بعد الخصم', await txt('joBox'));
  await shot('j_offer.png');
  await ev(`document.querySelector('#joBox [data-jy="1"]').click()`);
  ok(await until(`document.getElementById('joBox').style.display==='none'`), 'ضغطت «اشترِ» وانقفلت النافذة');
  ok(await (async () => { for (let k = 0; k < 24; k++) { if (NB.inbox.find(m => m.t === 'eco' && m.ev && /بعت/.test(m.ev))) return true; await wait(250); } return false; })(), 'البيعة تمت والموظف أخذ عمولته', JSON.stringify(NB.inbox.filter(m => m.t === 'eco' || m.t === 'jx').map(m => m.ev || m.m)));
  // أنا الموظف: زر «اعرض عليه غرض» وقائمة السوق
  AD.send({ t: 'jf', f: nbId }); await wait(300); AD.send({ t: 'jh', f: myId, j: 'mall' }); ok(await until(`!!__jobs.my&&__jobs.my.j==='mall'`), 'صرت موظف المول');
  await ev(`__jobs.card('${nbId}')`); await wait(200); ok(/اعرض عليه غرض/.test(await txt('job7')) && /هدية/.test(await txt('job7')), 'بطاقة الزائر فيها «🛒 اعرض عليه غرض» و«🎁 هدية»', await txt('job7'));
  await ev(`document.querySelector('#job7 [data-jc="jsell"]').click()`); ok(await until(`document.querySelectorAll('#p41 [data-si]').length>3`), 'قائمة أغراض السوق تفتح بأسعار الخصم');
  await shot('j_sell.png');
  NB.inbox.length = 0; await ev(`document.querySelector('#p41 [data-si="h:5"]').click()`); await wait(900);
  ok(!!NB.inbox.find(m => m.t === 'jof' && m.i === 'h:5' && m.p === 108), 'العرض وصل للزائر (108 بدل 120)', JSON.stringify(NB.inbox.map(m => m.t)) + ' toast=' + await txt('toast') + ' loc=' + JSON.stringify(await loc()));
  // ---- 👔 المدير العام ----
  AD.send({ t: 'jf', f: myId }); await until('!__jobs.my'); await wait(400); AD.send({ t: 'jh', f: myId, j: 'gm' });
  ok(await until(`!!__jobs.my&&__jobs.my.j==='gm'`), 'الأدمن عيّنني المدير العام');
  ok(await until(`__wk.walker.key&&__wk.walker.key.startsWith('28:')`), 'لبست البدلة الرسمية', await ev('__wk.walker.key'));
  await ev("['p40','p41','p7'].forEach(x=>{const e=document.getElementById(x);if(e)e.style.display='none';})");
  await goto(0, -60); await ev('__wk.yaw=0;__wk.camYaw=0;__wk.pitch=.15;__wk.dist=3.2;__wk.cur=3.2;'); await wait(2000); await shot('j_gm.png'); await ev('__wk.dist=8;__wk.pitch=.35;');
  const nbAbs = JSON.parse(await ev('JSON.stringify([__wk.p.x,__wk.p.z])')); NB.send({ t: 'p', x: nbAbs[0] + 3, z: nbAbs[1], y: .3, r: 0, m: 0 }); await wait(1200);
  await ev(`__jobs.card('${nbId}')`); await wait(200); const g7 = await txt('job7');
  ok(/اسجنه/.test(g7) && /وظّفه/.test(g7) && /عيّنه مشرف/.test(g7), 'المدير العام: أزرار السجن والتوظيف وتعيين المشرف ببطاقة الشخص', g7);
  await ev(`__jobs.open('mg')`); ok(await until(`/الطلبات/.test(document.getElementById('jBody').innerText)&&/سجل السجن/.test(document.getElementById('jBody').innerText)`), 'المدير العام عنده تبويب الإدارة (الطلبات + سجل السجن)');
  await ev("document.getElementById('cancel40').click()");
} finally {
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  console.log('errors:', errors.length ? errors : 'none');
  clearInterval(keep); try { AD && AD.sock.destroy(); NB && NB.sock.destroy(); } catch {}
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); srv.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}
