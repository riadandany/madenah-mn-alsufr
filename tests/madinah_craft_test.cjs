// اختبار عالم البناء المشترك بالسيرفر: تعديلات تنوزّع وتنحفظ، صناديق وأفران مشتركة، قتال، وحفظ الأرقام
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_craft_houses.json'), PORT = 3982, B = `http://127.0.0.1:${PORT}`;
fs.writeFileSync(DATA, '[]'); for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'craft.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
function client(ip) {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': ip || '10.0.0.' + Math.floor(Math.random() * 250) } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 3, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; c.name = name; return c; };
srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devCw-aaaaaaaa', 'احمد'), Bq = await mk('devCw-bbbbbbbb', 'بدر'), C = await mk('devCw-cccccccc', 'خارج');
  for (const c of [A, Bq]) { c.send({ t: 'vz', on: 1 }); c.send({ t: 'vf', on: 1 }); c.send({ t: 'vy', x: 100.5, y: 40, z: 100.5 }); } await wait(300);
  // 0) المنطقة المحمية: ٣٠ مكعب حول مدخل العالم ما فيها حفر ولا بناء
  A.send({ t: 'vy', x: 10.5, y: 40, z: 10.5 }); await wait(150); clr(A, Bq); A.send({ t: 'cwb', x: 12, y: 40, z: 10, id: 7 }); await wait(300);
  ok(!last(Bq, m => m.t === 'cwb' && m.x === 12 && m.id === 7) && last(A, m => m.t === 'cwx'), 'المنطقة المحمية (أول ٣٠ مكعب): البناء ممنوع (تبقى أرض خضراء فاضية)');
  await wait(100); clr(A, Bq); A.send({ t: 'cwb', x: 12, y: 40, z: 10, id: 0 }); await wait(300); ok(!last(Bq, m => m.t === 'cwb' && m.x === 12 && m.id === 0), 'المنطقة المحمية: الحفر ممنوع');
  await wait(100); clr(A, Bq); A.send({ t: 'cwb', x: 11, y: 39, z: 10, id: 0 }); await wait(300); ok(!last(Bq, m => m.t === 'cwb') && last(A, m => m.t === 'cwx'), 'المنطقة المحمية: كسر الأرض الطبيعية مرفوض');
  A.send({ t: 'vy', x: 30.5, y: 40, z: 5.5 }); await wait(150); clr(A, Bq); A.send({ t: 'cwb', x: 30, y: 40, z: 5, id: 0 }); await wait(300); ok(!last(Bq, m => m.t === 'cwb'), 'حدّ المنطقة (٣٠ من الغرب): الحفر مرفوض');
  A.send({ t: 'vy', x: 31.5, y: 40, z: 5.5 }); await wait(150); clr(A, Bq); A.send({ t: 'cwb', x: 31, y: 40, z: 5, id: 0 }); await wait(300); ok(last(Bq, m => m.t === 'cwb' && m.x === 31), 'بعد المنطقة (٣١): الحفر مسموح');
  for (const c of [A, Bq]) c.send({ t: 'vy', x: 100.5, y: 40, z: 100.5 }); await wait(200);
  // توافق مع الصفحات القديمة: موقع العالم بالاسم القديم vp يشتغل (وما يروح لفحص الرمز)
  clr(A); A.send({ t: 'vp', x: 300.5, y: 40, z: 300.5 }); await wait(150); ok(!last(A, m => m.t === 'err'), 'صفحة قديمة ترسل الموقع بـvp: ما تطلع رسالة «شوي شوي» ولا «اختر بيتك»');
  clr(A, Bq); A.send({ t: 'cwb', x: 301, y: 40, z: 300, id: 7 }); await wait(300); ok(last(Bq, m => m.t === 'cwb' && m.x === 301), 'صفحة قديمة: التعديل يوصل بعد ما أرسلت موقعها بـvp'); A.send({ t: 'vy', x: 100.5, y: 40, z: 100.5 }); await wait(150);
  // 1) تعديل يوصل للكل ويتحفظ
  clr(A, Bq, C); A.send({ t: 'cwb', x: 100, y: 40, z: 100, id: 7 }); await wait(300);
  ok(last(Bq, m => m.t === 'cwb' && m.x === 100 && m.y === 40 && m.z === 100 && m.id === 7 && m.f === A.id) && last(A, m => m.t === 'cwb' && m.id === 7), 'التعديل يوصل لكل اللاعبين بالعالم (والطالب)');
  ok(!last(C, m => m.t === 'cwb'), 'اللي برّا عالم البناء ما يوصله');
  clr(Bq); Bq.send({ t: 'cwq', ks: ['6,6', '9,9'] }); await wait(300); const ce = last(Bq, m => m.t === 'cwe');
  ok(ce && JSON.stringify(ce.e['6,6']) === JSON.stringify([10308, 7]) && !ce.e['9,9'] && ce.ks.length === 2, 'طلب القطع: يرجّع التعديلات كأرقام بس', JSON.stringify(ce && ce.e));
  clr(C); C.send({ t: 'cwq', ks: ['6,6'] }); C.send({ t: 'cwb', x: 100, y: 41, z: 100, id: 3 }); await wait(300); ok(!last(C, m => m.t === 'cwe') && !last(A, m => m.t === 'cwb' && m.y === 41), 'اللي برّا العالم ما يقدر يقرأ ولا يعدّل');
  // 2) حماية: بعيد / رقم غلط
  await wait(60); clr(Bq); A.send({ t: 'cwb', x: 140, y: 40, z: 100, id: 3 }); await wait(100); A.send({ t: 'cwb', x: 101, y: 40, z: 100, id: 16 }); await wait(100); A.send({ t: 'cwb', x: 101, y: 40, z: 100, id: 99 }); await wait(100); A.send({ t: 'cwb', x: 101, y: 70, z: 100, id: 3 }); await wait(200);
  ok(!last(Bq, m => m.t === 'cwb'), 'تعديل بعيد عنك أو مكعب غلط (صخر الأساس/غير موجود/ارتفاع خارج) مرفوض');
  await wait(80); clr(Bq); A.send({ t: 'cwb', x: 100, y: 41, z: 100, id: 27 }); await wait(250); ok(last(Bq, m => m.t === 'cwb' && m.id === 27), 'المشعل (27) يتوزّع كتعديل'); await wait(80); clr(Bq); A.send({ t: 'cwb', x: 100, y: 42, z: 100, id: 30 }); await wait(250); ok(last(Bq, m => m.t === 'cwb' && m.id === 30), 'الحمم (من الدلو) تتوزّع كتعديل'); await wait(80); clr(Bq); A.send({ t: 'cwb', x: 100, y: 43, z: 100, id: 42 }); await wait(250); ok(!last(Bq, m => m.t === 'cwb'), 'رقم مكعب غير موجود (42) مرفوض');
  // 3) صندوق مشترك
  await wait(100); A.send({ t: 'cwb', x: 101, y: 40, z: 100, id: 26 }); await wait(250); clr(A, Bq);
  A.send({ t: 'ctop', k: '101,40,100', b: 26 }); await wait(250); let st = last(A, m => m.t === 'cts');
  ok(st && st.d && st.d.t === 'C' && st.d.s.length === 27, 'فتح الصندوق: 27 خانة');
  A.send({ t: 'ctput', r: 's0', it: { id: 7, n: 5, d: 0 } }); await wait(250); st = last(A, m => m.t === 'cts'); ok(st && st.d.s[0] && st.d.s[0].id === 7 && st.d.s[0].n === 5, 'وضع غرض بالصندوق');
  await wait(100); A.send({ t: 'ctput', r: 's1', it: { id: 999, n: 5, d: 0 } }); await wait(150); st = last(A, m => m.t === 'cts'); ok(st.d.s[1] === null, 'غرض غير موجود مرفوض');
  Bq.send({ t: 'ctop', k: '101,40,100', b: 26 }); await wait(250); const sb = last(Bq, m => m.t === 'cts'); ok(sb && sb.d.s[0] && sb.d.s[0].n === 5, 'لاعب ثاني يفتح نفس الصندوق ويشوف الغرض (مشترك)');
  clr(A); await wait(100); Bq.send({ t: 'ctake', r: 's0' }); await wait(250); ok(last(Bq, m => m.t === 'ctg' && m.it && m.it.n === 5) && last(A, m => m.t === 'cts' && m.d.s[0] === null), 'بدر ياخذ الغرض، وأحمد يشوف الصندوق فضي');
  await wait(100); A.send({ t: 'ctake', r: 's0' }); await wait(250); ok(last(A, m => m.t === 'ctg' && m.it === null), 'ما يتكرر الغرض (أخذه بدر): نسخة وحدة بس');
  // 4) فرن: وقود/خام وقواعد
  await wait(100); A.send({ t: 'cwb', x: 102, y: 40, z: 100, id: 25 }); await wait(250); clr(A); A.send({ t: 'ctop', k: '102,40,100', b: 25 }); await wait(250);
  A.send({ t: 'ctput', r: 'o', it: { id: 7, n: 1, d: 0 } }); await wait(250); ok(last(A, m => m.t === 'ctn' && m.it.id === 7), 'خانة الناتج ما يُوضع فيها (يرجع الغرض)');
  await wait(100); A.send({ t: 'ctput', r: 'in', it: { id: 7, n: 1, d: 0 } }); await wait(250); ok(last(A, m => m.t === 'ctn'), 'خشب ما ينصهر (مرفوض بخانة الصهر)');
  await wait(100); A.send({ t: 'ctput', r: 'in', it: { id: 10, n: 2, d: 0 } }); await wait(250); A.send({ t: 'ctput', r: 'fu', it: { id: 101, n: 1, d: 0 } }); await wait(250);
  st = last(A, m => m.t === 'cts'); ok(st && st.d.i && st.d.i.id === 10 && st.d.fu && st.d.fu.id === 101, 'خام حديد + فحم بالفرن');
  await wait(12000); st = last(A, m => m.t === 'cts'); ok(st && st.d.o && st.d.o.id === 103 && st.d.o.n >= 1, 'الفرن يصهر لحاله بالسيرفر (سبيكة حديد بعد 10 ثواني)', JSON.stringify(st && st.d.o));
  // 5) كسر الصندوق: الأغراض ترجع لمن كسره
  clr(A, Bq); A.send({ t: 'ctop', k: '101,40,100', b: 26 }); await wait(250); A.send({ t: 'ctput', r: 's3', it: { id: 8, n: 7, d: 0 } }); await wait(250); Bq.send({ t: 'ctop', k: '101,40,100', b: 26 }); await wait(250); clr(A, Bq);
  A.send({ t: 'cwb', x: 101, y: 40, z: 100, id: 0 }); await wait(300); const dd = last(A, m => m.t === 'ctd'); ok(dd && dd.items.some(i => i.id === 8 && i.n === 7), 'كسر الصندوق: الأغراض ترجع لمن كسره'); ok(last(Bq, m => m.t === 'cts' && m.d === null), 'ومن كان فاتحه ينسكر عنده');
  // 6) قتال
  await wait(100); clr(A, Bq); A.send({ t: 'hit', to: Bq.id, d: 7 }); await wait(250); const hu = last(Bq, m => m.t === 'hurt'); ok(hu && hu.d === 7 && hu.f === A.id && hu.n === 'احمد' && typeof hu.kx === 'number', 'الضربة توصل الضحية بالضرر واسم الضارب'); ok(last(A, m => m.t === 'hfx' && m.to === Bq.id && m.f === A.id) && last(Bq, m => m.t === 'hfx'), 'تأثير الضرب يوصل الضارب والمضروب (والكل بالعالم) عشان يتوهّج المضروب');
  clr(Bq); A.send({ t: 'hit', to: Bq.id, d: 7 }); await wait(100); ok(!last(Bq, m => m.t === 'hurt'), 'ضربتين خلال أقل من نص ثانية: الثانية تُتجاهل');
  await wait(450); A.send({ t: 'hit', to: C.id, d: 5 }); await wait(250); ok(!last(C, m => m.t === 'hurt'), 'ما تضرب لاعب برّا عالم البناء (المدينة آمنة)');
  Bq.send({ t: 'p', x: 300, z: 300, y: 3, r: 0, m: 0 }); await wait(250); clr(Bq); A.send({ t: 'hit', to: Bq.id, d: 5 }); await wait(250); ok(!last(Bq, m => m.t === 'hurt'), 'ضربة من بعيد مرفوضة');
  Bq.send({ t: 'p', x: 0, z: 0, y: 3, r: 0, m: 0 }); await wait(200); clr(A, Bq); Bq.send({ t: 'died', by: A.id }); await wait(250); ok(last(A, m => m.t === 'kill' && m.k === 'احمد' && m.v === 'بدر'), 'إعلان القتل يوصل لكل اللاعبين بالعالم');
  // 6ب) مرافقة لمكان محفوظ بعالم البناء
  await wait(3200); clr(A, Bq); A.send({ t: 'cq', d: 'wp', w: [1, 100, 40, 100], to: [Bq.id] }); await wait(300); const wq = last(Bq, m => m.t === 'cqi' && m.d === 'wp'); ok(wq && JSON.stringify(wq.w) === JSON.stringify([1, 100, 40, 100]) && wq.n === 'احمد', 'طلب مرافقة لمكان محفوظ: يوصل مع إحداثيات المكان');
  clr(A, Bq); Bq.send({ t: 'cr', f: A.id, ok: true }); await wait(300); const g1 = last(Bq, m => m.t === 'cg'), g2 = last(A, m => m.t === 'cg'); ok(g1 && g1.d === 'wp' && JSON.stringify(g1.w) === JSON.stringify([1, 100, 40, 100]) && g2 && g2.me === 1 && JSON.stringify(g2.w) === JSON.stringify([1, 100, 40, 100]), 'الموافقة: الاثنين ينتقلون لنفس المكان (الإحداثيات توصل للاثنين)');
  await wait(3200); clr(Bq); A.send({ t: 'cq', d: 'wp', w: [99, 100, 40, 100], to: [Bq.id] }); await wait(300); ok(!last(Bq, m => m.t === 'cqi'), 'اسم مكان غير موجود مرفوض'); await wait(3200); A.send({ t: 'cq', d: 'wp', w: [1, 100, 99, 100], to: [Bq.id] }); await wait(300); ok(!last(Bq, m => m.t === 'cqi'), 'ارتفاع خارج العالم مرفوض'); await wait(3200); A.send({ t: 'cq', d: 'wp', to: [Bq.id] }); await wait(300); ok(!last(Bq, m => m.t === 'cqi'), 'مرافقة لمكان بدون إحداثيات مرفوضة');
  // 7) الأرقام: شنطة 4-خانات
  await wait(4200); A.send({ t: 'mc', w: 'craft', x: 100, y: 40, z: 100, pl: [1, 10, 40, 10, 99, 1, 1, 1, 2, 5, 70, 5], inv: [0, 100, 5, 0, 3, 120, 1, 10, 4, 9999, 3, 0, 40, 100, 5, 0] }); await wait(300); clr(A); A.send({ t: 'mcl', w: 'craft' }); await wait(300);
  const ms = last(A, m => m.t === 'mcs'); ok(ms && JSON.stringify(ms.pl) === JSON.stringify([1, 10, 40, 10]), 'الأماكن المحفوظة تنحفظ كأرقام (اسم غلط وارتفاع خارج العالم يُشطبون)', JSON.stringify(ms && ms.pl)); ok(ms && JSON.stringify(ms.inv) === JSON.stringify([0, 100, 5, 0, 3, 120, 1, 10]), 'شنطتك تنحفظ كأرقام (غرض غير معروف وخانة خارج 36 تنمسح)', JSON.stringify(ms && ms.inv));
  // 8) حفظ بالملف
  await wait(5500); const cf = JSON.parse(fs.readFileSync(path.join(__dirname, 'craft.json'), 'utf8')); ok(cf.ed['6,6'] && cf.ed['6,6'].includes(10308) && JSON.stringify(cf).length < 4000, 'العالم ينحفظ بملف أرقام صغير', String(JSON.stringify(cf).length) + ' حرف');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
