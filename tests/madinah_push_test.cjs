// اختبار إشعارات الجوال (Web Push): اشتراك، تشفير RFC 8291 + توقيع VAPID، إعلان، قبول وظيفة، تذكير يومي، حذف الاشتراك الميت
// node tests/madinah_push_test.cjs server.js   (خادم إشعارات وهمي محلي يفك التشفير مثل الجوال)
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_push_houses.json'), PORT = 3971, PPORT = 3970, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-push';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'push.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name, days) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'احمد', 3), hs('h000000002', 1, 'devB-xxxxxxxx', 'بدر', 3), hs('h000000003', 2, 'devC-xxxxxxxx', 'سالم', 1), hs('h000000004', 3, 'devD-xxxxxxxx', 'داود', 3)]));
// اقتصاد جاهز: داود دخل أمس (سلسلة يومين) وما دخل اليوم → التذكير اليومي لازم يوصله
const devHash = d => crypto.createHash('sha256').update('dev:' + d).digest('hex').slice(0, 12);
const gd = off => new Date(Date.now() + 3 * 3600e3 + off).toISOString().slice(0, 10);
fs.writeFileSync(path.join(__dirname, 'economy.json'), JSON.stringify({ [devHash('devD-xxxxxxxx')]: { c: 50, s: 2, ld: gd(-86400e3), d: '', tk: [], bx: 0, tut: [1, 0, 0, 0], fnd: [], o: [], bd: -1, wk: { w: 0, xo: 0, rc: 0 }, cap: {}, n: 'داود', zt: 0, lv: 2 } }));
// خادم الإشعارات الوهمي
const got = []; let status = 201;
const ps = http.createServer((q, r) => { const ch = []; q.on('data', d => ch.push(d)); q.on('end', () => { got.push({ url: q.url, h: q.headers, body: Buffer.concat(ch) }); r.writeHead(status); r.end(); }); }).listen(PPORT, '127.0.0.1');
let srv = null;
const start = env => { srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, PUSH_TEST_HOST: '127.0.0.1:' + PPORT, PUSH_NOQUIET: '1', ...env }, stdio: ['ignore', 'pipe', 'inherit'] }); return new Promise(r => srv.stdout.once('data', r)); };
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.7.' + (ipN++) + '.7' } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { try { c.inbox.push(JSON.parse(s)); } catch {} } } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined && !c ? '  → ' + x : '')); };
const last = (c, f) => [...c.inbox].reverse().find(f);
const mk = async dev => { const c = await client(); c.send({ t: 'hi', d: dev }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
// «جوال» وهمي: مفاتيح ECDH + auth، ويفك الإشعار مثل المتصفح
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
function phone(id) { const e = crypto.createECDH('prime256v1'); e.generateKeys(); const auth = crypto.randomBytes(16); return { e, auth, sub: { e: `http://127.0.0.1:${PPORT}/push/${id}`, p: e.getPublicKey().toString('base64url'), a: auth.toString('base64url') } }; }
function decrypt(ph, body) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen), ua = ph.e.getPublicKey();
  const ikm = hmac(hmac(ph.auth, ph.e.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub, Buffer.from([1])])), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16), nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  if (pt[pt.length - 1] !== 2) throw new Error('padding'); return JSON.parse(pt.subarray(0, pt.length - 1).toString('utf8'));
}
const dec = (ph, g) => { try { return decrypt(ph, g.body); } catch (e) { return null; } };
function jwtOk(h, aud) {   // يتحقق من توقيع VAPID بالمفتاح العام اللي بالترويسة
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.authorization || ''); if (!m) return false; const [hd, pl, sg] = m[1].split('.'), k = Buffer.from(m[2], 'base64url');
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: k.subarray(1, 33).toString('base64url'), y: k.subarray(33).toString('base64url') }, format: 'jwk' });
  const okSig = crypto.verify('sha256', Buffer.from(hd + '.' + pl), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sg, 'base64url')); const c = JSON.parse(Buffer.from(pl, 'base64url'));
  return okSig && c.aud === aud && c.exp > Date.now() / 1000 && /^https?:\/\//.test(c.sub);
}
const pushFor = id => got.filter(g => g.url === '/push/' + id);
(async () => {
  await start({}); await wait(500);
  const AD = await mk('devAdm-xxxxxxx'); AD.send({ t: 'admin', k: ADMIN }); await wait(400);
  const A = await mk('devA-xxxxxxxx'), Bc = await mk('devB-xxxxxxxx'), Dd = await mk('devD-xxxxxxxx');
  const pk = last(A, m => m.t === 'pkey'); ok(pk && Buffer.from(pk.k, 'base64url').length === 65 && pk.has === 0, 'الجهاز ياخذ المفتاح العام للإشعارات (ومو مشترك)');
  const phA = phone('A'), phB = phone('B'), phAD = phone('AD'), phD = phone('D');
  A.inbox.length = 0; A.send({ t: 'ps', ...phA.sub }); await wait(300); ok(last(A, m => m.t === 'pkey' && m.has === 1), 'اشتراك أحمد انحفظ');
  Bc.send({ t: 'ps', ...phB.sub }); AD.send({ t: 'ps', ...phAD.sub }); await wait(300);
  const C = await mk('devC-xxxxxxxx'); C.inbox.length = 0; C.send({ t: 'ps', e: 'https://evil.example.com/x', p: phA.sub.p, a: phA.sub.a }); await wait(300); ok(!last(C, m => m.t === 'pkey' && m.has === 1), 'عنوان إشعار من موقع غريب مرفوض (حماية)');
  // تجربة الأدمن
  AD.send({ t: 'pt' }); await wait(700); const t1 = pushFor('AD')[0];
  ok(t1 && t1.h['content-encoding'] === 'aes128gcm' && +t1.h.ttl > 0, 'إشعار التجربة وصل بالترويسات الصحيحة');
  ok(t1 && jwtOk(t1.h, `http://127.0.0.1:${PPORT}`), 'توقيع VAPID صحيح');
  const d1 = t1 && dec(phAD, t1); ok(d1 && /تجربة/.test(d1.b) && d1.t === 'مدينة من الصفر', 'الجوال يفك التشفير ويقرأ الإشعار', JSON.stringify(d1));
  // إعلان + إشعار: يوصل للي مو داخل اللعبة بس
  Bc.sock.destroy(); await wait(400); got.length = 0; AD.inbox.length = 0;
  AD.send({ t: 'ab', x: 'فعالية الليلة 9 بالساحة', p: true }); await wait(900);
  const db = pushFor('B')[0] && dec(phB, pushFor('B')[0]); ok(db && /فعالية الليلة/.test(db.b), 'إعلان صاحب المدينة وصل كإشعار للي طالع من اللعبة', JSON.stringify(db));
  ok(pushFor('A').length === 0, 'اللي داخل اللعبة ما يوصله إشعار (يشوف الشريط)');
  ok(last(AD, m => m.t === 'jx' && /إشعار لـ 1 جوال/.test(m.m)), 'الأدمن يعرف كم جوال وصله', JSON.stringify(last(AD, m => m.t === 'jx')));
  await wait(3100); AD.inbox.length = 0; AD.send({ t: 'ab', x: 'ثاني', p: true }); await wait(500); ok(last(AD, m => m.t === 'jx' && /مرة كل 10 دقايق/.test(m.m)), 'إشعار الإعلانات مرة كل 10 دقايق بس');
  // قبول وظيفة وهو طالع
  A.send({ t: 'ja', j: 'mall' }); await wait(400); A.sock.destroy(); await wait(400); got.length = 0;
  AD.send({ t: 'jm' }); await wait(300); const jm = last(AD, m => m.t === 'jm'); AD.send({ t: 'jd', k: jm.apps[0][0], ok: true }); await wait(900);
  const da = pushFor('A')[0] && dec(phA, pushFor('A')[0]); ok(da && /انقبلت/.test(da.b), 'قبول الوظيفة يوصله إشعار وهو طالع', JSON.stringify(da));
  // داود يشترك ويطلع، ثم نعيد تشغيل السيرفر بساعة تذكير = 0 → يوصله تذكير «كمّل سلسلتك»
  Dd.send({ t: 'ps', ...phD.sub }); await wait(300); Dd.sock.destroy(); await wait(3600);   // الحفظ مؤجّل 3ث (وويندوز يقفل السيرفر بدون حفظ أخير)
  const P0 = JSON.parse(fs.readFileSync(path.join(__dirname, 'push.json'), 'utf8')); ok(P0.vapid && P0.vapid.d && Object.keys(P0.subs).length === 4, 'الاشتراكات والمفاتيح محفوظة بملف البيانات', Object.keys(P0.subs || {}).length);
  // داود دخل اليوم الحين (ecoHi حدّث ld) — نرجّع ld لأمس بالملف قبل التشغيل الثاني
  srv.kill('SIGTERM'); await wait(900); { const E = JSON.parse(fs.readFileSync(path.join(__dirname, 'economy.json'), 'utf8')); const e = E[devHash('devD-xxxxxxxx')]; e.ld = gd(-86400e3); e.s = 2; fs.writeFileSync(path.join(__dirname, 'economy.json'), JSON.stringify(E)); }
  got.length = 0; await start({ PUSH_DAILY_H: '0', PUSH_TICK_MS: '300' }); await wait(1500);
  const dd = pushFor('D')[0] && dec(phD, pushFor('D')[0]); ok(dd && /يتطور إلى فيلا/.test(dd.b), 'التذكير اليومي لداود (طالع): «ادخل اليوم وبيتك يتطور إلى فيلا» (يومه الرابع)', JSON.stringify(dd));
  ok(pushFor('A').length === 0 && pushFor('AD').length === 0, 'التذكير اليومي ما يوصل للي دخل اليوم');
  // اشتراك ميت (410) ينحذف
  status = 410; const AD2 = await mk('devAdm-xxxxxxx'); AD2.send({ t: 'admin', k: ADMIN }); await wait(400); AD2.send({ t: 'pt' }); await wait(800);
  await wait(3500); const P1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'push.json'), 'utf8')); ok(!P1.subs[devHash('devAdm-xxxxxxx')], 'خادم الإشعارات قال «الاشتراك انتهى» (410) → انحذف');
  status = 201; const A2 = await mk('devA-xxxxxxxx'); A2.inbox.length = 0; A2.send({ t: 'px' }); await wait(300); ok(last(A2, m => m.t === 'pkey' && m.has === 0), 'إلغاء الإشعارات يحذف الاشتراك');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); ps.close(); process.exit(fail ? 1 : 0);
})();
