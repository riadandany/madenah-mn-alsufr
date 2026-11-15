// اختبار مدينة مشتركي تيك توك: بيوت برمز، تصريح الدخول، الطرق على البوابة، منع المتسللين، قصور بدخول وطرق
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_vip_houses.json'), VIPF = path.join(__dirname, 'vip.json'), SEED = path.join(__dirname, 'vip_seed.json');
fs.writeFileSync(DATA, '[]'); for (const f of ['economy.json', 'moderation.json', 'vip.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
fs.writeFileSync(SEED, JSON.stringify([{ name: 'قصر الملك', pin: 'KingPin@2026', adm: true }, { name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }]));
const PORT = 3969, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'inherit'] });
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
const join = async (dev, name, x = 0, z = 0) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(300); c.send({ t: 'p', x, z, y: 0, r: 0, m: 0 }); return c; };
srv.stdout.once('data', async () => {
  await wait(800);
  const seeded = JSON.parse(fs.readFileSync(VIPF, 'utf8')); ok(seeded.houses.length === 3 && seeded.houses.some(h => h.adm && h.lot === 0), 'بيوت VIP أُنشئت من ملف الإعداد (قصر المشرف lot 0 + اثنين)');
  ok(!JSON.stringify(seeded).includes('KingPin') && seeded.houses.every(h => h.ph && h.ps), 'الرموز محفوظة مشفّرة (ما فيه رمز نصي بالملف)');
  ok(fs.readFileSync(SEED, 'utf8') === '[]', 'ملف الإعداد انمسح بعد الاستخدام');
  const V = await join('devV-xxxxxxxx', 'زائر'); let vh = last(V, m => m.t === 'vh');
  ok(vh && vh.l.length === 3 && vh.l.every(x => x.id && x.name && x.lot !== undefined && !x.ph) && !vh.pass && !(vh.mine || []).length, 'الزائر يستلم قائمة البيوت (أسماء فقط) بدون تصريح');
  const omar = vh.l.find(x => x.name === 'عمر').id, salma = vh.l.find(x => x.name === 'سلمى').id, king = vh.l.find(x => x.adm).id;
  // رمز غلط / صح
  clr(V); V.send({ t: 'vp', i: omar, p: 'wrong' }); await wait(500); ok(last(V, m => m.t === 'err' && /غير صحيح/.test(m.m || '')) && !last(V, m => m.t === 'vip'), 'رمز غلط: مرفوض');
  await wait(1600); V.send({ t: 'vp', i: salma, p: '1234' }); await wait(500); ok(last(V, m => m.t === 'err'), 'رمز بيت ثاني: مرفوض (كل بيت له رمزه)');
  await wait(1600); clr(V); V.send({ t: 'vp', i: omar, p: '1234' }); await wait(600);
  const vip1 = last(V, m => m.t === 'vip'); ok(vip1 && vip1.ok && vip1.h === omar, 'رمز صحيح: دخول + بيته «عمر»');
  vh = last(V, m => m.t === 'vh'); ok(vh && vh.pass && vh.mine.includes(omar), 'التصريح والبيت يرجعون بالقائمة');
  // المشرف ما يدخل برمز المشرف بالغلط؟ لا — رمز المشرف يخص قصره
  await wait(1600); clr(V); V.send({ t: 'vp', i: king, p: 'KingPin@2026' }); await wait(500); ok(last(V, m => m.t === 'vip' && m.h === king), 'رمز المشرف الصحيح يفتح قصر المشرف');
  V.send({ t: 'vp', i: omar, p: '1234' }); await wait(300);
  // استرجاع الجلسة بعد إعادة الاتصال
  V.sock.destroy(); await wait(500); const V2 = await join('devV-xxxxxxxx', 'زائر'); await wait(300); vh = last(V2, m => m.t === 'vh'); ok(vh && vh.pass, 'إعادة الاتصال بنفس الجهاز: التصريح يرجع تلقائياً');
  // متسلل بدون تصريح داخل المدينة → يُطرد
  const nb = 48, maxR = 3, pz = (maxR + 5) * 78, z = pz + 330;
  const X = await join('devX-xxxxxxxx', 'متسلل', 0, 0); clr(X); X.send({ t: 'p', x: 0, z, y: 0, r: 0, m: 1 }); await wait(500); ok(last(X, m => m.t === 'vipout'), 'متسلل بدون تصريح داخل المدينة: السيرفر يرجّعه');
  clr(V2); V2.send({ t: 'p', x: 0, z, y: 0, r: 0, m: 1 }); await wait(500); ok(!last(V2, m => m.t === 'vipout'), 'اللي معه تصريح يمشي بالمدينة بدون إزعاج');
  // الطرق على البوابة
  clr(X); await wait(1600); X.send({ t: 'vk' }); await wait(400); ok(last(X, m => m.t === 'err' && /طرقت باب المدينة|ما فيه أحد من أصحاب القصور/.test(m.m || '')), 'الطرق على البوابة: رد واضح (ينتظر أو ما فيه أحد)');
  const A = await join('devA-xxxxxxxx', 'x'); A.send({ t: 'admin', k: ADMIN }); await wait(400); A.send({ t: 'p', x: 0, z, y: 0, r: 0, m: 1 }); vh = last(A, m => m.t === 'vh'); ok(vh && vh.pass && vh.mine.includes(king), 'المشرف: تصريح تلقائي وقصره الكبير');
  await wait(6000); clr(A, X); X.send({ t: 'vk' }); await wait(400); const kn = last(A, m => m.t === 'vkn'); ok(kn && kn.n === 'متسلل', 'المشرف يستلم «فلان يطرق باب المدينة»');
  A.send({ t: 'vka', f: kn.f, ok: false }); await wait(300); ok(last(X, m => m.t === 'vkd'), 'رفض المشرف يوصل للطارق');
  await wait(6000); clr(A, X); X.send({ t: 'vk' }); await wait(300); const kn2 = last(A, m => m.t === 'vkn'); A.send({ t: 'vka', f: kn2.f, ok: true }); await wait(400);
  const g = last(X, m => m.t === 'vip'); ok(g && g.ok && g.guest, 'سماح المشرف: الزائر يدخل كضيف (يشوف المدينة)');
  clr(X); X.send({ t: 'p', x: 0, z, y: 0, r: 0, m: 1 }); await wait(400); ok(!last(X, m => m.t === 'vipout'), 'الضيف ما يُطرد من المدينة');
  // غير المشرف ما يقدر يسمح/يضيف/يحذف
  const Y = await join('devY-xxxxxxxx', 'ثالث'); Y.send({ t: 'va', n: 'مخادع', p: '9999' }); await wait(400); ok(!last(Y, m => m.t === 'vh' && m.l.some(h => h.name === 'مخادع')) && JSON.parse(fs.readFileSync(VIPF, 'utf8')).houses.length === 3, 'غير المشرف ما يقدر يضيف بيت VIP');
  // المشرف يضيف ويحذف
  clr(A); A.send({ t: 'va', n: 'ريان', p: 'ryan2026' }); await wait(1200); vh = last(Y, m => m.t === 'vh' && m.l.some(h => h.name === 'ريان')); ok(!!vh, 'المشرف يضيف بيت VIP وكل اللاعبين يشوفونه بالقائمة');
  const ry = vh.l.find(h => h.name === 'ريان'); ok(ry.lot > 0 && ry.lot <= 12, 'القصر الجديد ياخذ مكان (lot ' + ry.lot + ')');
  A.send({ t: 'vd', i: ry.id }); await wait(500); vh = last(Y, m => m.t === 'vh'); ok(vh && !vh.l.some(h => h.name === 'ريان'), 'المشرف يحذف بيت VIP');
  // دعوة وحدة = أكثر من قصر (نفس الرمز)
  clr(A); A.send({ t: 'va', n: 'عمر٢', p: '1234' }); await wait(1200); const vh2 = last(Y, m => m.t === 'vh' && m.l.some(h => h.name === 'عمر٢'));
  const o2 = vh2 && vh2.l.find(h => h.name === 'عمر٢'), o1 = vh2 && vh2.l.find(h => h.name === 'عمر'); ok(o2 && o1 && o2.inv === o1.inv && o2.id !== o1.id, 'نفس الرمز: القصر الجديد ينضم لنفس الدعوة (inv مشترك)');
  const Q = await join('devQ-xxxxxxxx', 'ضيف الدعوة'); await wait(1700); clr(Q); Q.send({ t: 'vp', i: omar, p: '1234' }); await wait(700);
  const qv = last(Q, m => m.t === 'vip'), qh = last(Q, m => m.t === 'vh'); ok(qv && qv.n === 2 && qh && qh.mine.includes(omar) && qh.mine.includes(o2.id), 'رمز الدعوة يفتح قصرين (n=' + (qv && qv.n) + ')');
  clr(Q); Q.send({ t: 'in', h: o2.id }); await wait(300); ok(last(Q, m => m.t === 'in' && m.h === o2.id), 'يدخل القصر الثاني بنفس الدعوة');
  clr(Q); Q.send({ t: 'out' }); A.send({ t: 'vd', i: o2.id }); await wait(400); Q.sock.destroy();
  // القصور: المالك يدخل، الضيف يطرق، السماح والطرد
  await wait(1700); const O = await join('devO-xxxxxxxx', 'عمر'); O.send({ t: 'vp', i: omar, p: '1234' }); await wait(600);
  clr(O); O.send({ t: 'in', h: omar }); await wait(300); const oin = last(O, m => m.t === 'in'); ok(oin && oin.h === omar && Number.isInteger(oin.s), 'مالك القصر يدخل قصره (مكان الغرفة من السيرفر: ' + (oin && oin.s) + ')');
  await wait(4100); clr(O, X); X.send({ t: 'kn', h: omar }); await wait(300);
  const kk = last(O, m => m.t === 'kn'); ok(!!kk, 'مالك القصر يستلم الطرق (الضيف معه تصريح)');
  if (kk) { O.send({ t: 'ka', f: kk.f, ok: true }); await wait(300); const xin = last(X, m => m.t === 'in'); ok(xin && xin.h === omar && xin.s === oin.s, 'السماح: الضيف يدخل نفس غرفة القصر'); O.send({ t: 'ko', f: kk.f }); await wait(300); ok(last(X, m => m.t === 'out' && m.k === 1), 'المالك يطرد الضيف من قصره'); }
  const Z = await join('devZ-xxxxxxxx', 'بدون تصريح'); await wait(4100); clr(O); Z.send({ t: 'kn', h: omar }); await wait(300); ok(!last(O, m => m.t === 'kn'), 'من ما معه تصريح المدينة ما يقدر يطرق باب قصر');
  Z.send({ t: 'in', h: omar }); await wait(200); ok(!last(Z, m => m.t === 'in'), 'غير المالك ما يدخل قصر غيره');
  // بيت VIP محذوف: المالك يطلع من قصره
  clr(O); A.send({ t: 'vd', i: omar }); await wait(500); ok(last(O, m => m.t === 'out'), 'حذف القصر يطلّع اللي بداخله');
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.kill('SIGTERM'); await wait(600); for (const f of ['economy.json', 'moderation.json', 'vip.json', 'vip_seed.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} } process.exit(fail ? 1 : 0);
});
