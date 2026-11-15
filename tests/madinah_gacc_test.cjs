// اختبار ربط قوقل: بدء الربط، الرجوع، نقل البيت لجهاز جديد، التعارضات، وربط قصر المشتركين بالحساب (قوقل مزيّف محلي)
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_gacc_houses.json'), PORT = 3973, GP = 3974, B = `http://127.0.0.1:${PORT}`;
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'بيتاحمد'), hs('h000000002', 1, 'devC-xxxxxxxx', 'بيتخالد')]));
fs.writeFileSync(path.join(__dirname, 'vip_seed.json'), JSON.stringify([{ name: 'عمر', pin: '1234' }, { name: 'سلمى', pin: 'salma99' }, { name: 'قصر الملك', pin: 'KingPin@2026', adm: true }]));
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const CODES = { cA: { sub: 'sub-aaa', email: 'ahmad@example.com' }, cBad: { sub: 'sub-bad', email: 'x@y.com', aud: 'other' }, cS2: { sub: 'sub-two', email: 'two@example.com' }, cP: { sub: 'sub-pre', email: 'pre@example.com' }, cAdm: { sub: 'sub-adm', email: 'adm@example.com' }, cH: { sub: 'sub-house', email: 'house@example.com' } };
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const f = new URLSearchParams(b), c = CODES[f.get('code')];
    if (!c || f.get('client_secret') !== 'sec') { res.writeHead(400); return res.end('{"error":"bad"}'); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id_token: ['h', b64({ iss: 'https://accounts.google.com', aud: c.aud || 'cid', sub: c.sub, email: c.email, email_verified: true, exp: Math.floor(Date.now() / 1000) + 600 }), 's'].join('.') }));
  });
}).listen(GP);
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', PUBLIC_URL: B, GOOGLE_AUTH_URL: `http://127.0.0.1:${GP}/auth`, GOOGLE_TOKEN_URL: `http://127.0.0.1:${GP}/token` }, stdio: ['ignore', 'pipe', 'inherit'] });
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
const api = (p, o) => new Promise(r => {
  const d = JSON.stringify(o || {}), q = http.request({ host: '127.0.0.1', port: PORT, path: p, method: o ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, rs => {
    let b = ''; rs.on('data', c => b += c); rs.on('end', () => { let j = null; try { j = JSON.parse(b); } catch {} r({ code: rs.statusCode, loc: rs.headers.location, j }); });
  }); q.end(d);
});
const state = async dev => { const r = await api('/api/g/start', { device: dev }); return r.j && r.j.url ? new URL(r.j.url).searchParams : null; };
const cb = async (dev, code) => { const p = await state(dev); const r = await api('/auth/google/callback?code=' + code + '&state=' + (p ? p.get('state') : 'x')); return r.loc; };
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(400); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); return c; };
srv.stdout.once('data', async () => {
  await wait(700);
  let r = await api('/api/g/status', { device: 'devA-xxxxxxxx' }); ok(r.j.on === true && r.j.linked === false, 'الربط مفعّل والحساب غير مربوط');
  const p = await state('devA-xxxxxxxx'); ok(p && p.get('client_id') === 'cid' && p.get('redirect_uri') === B + '/auth/google/callback' && p.get('response_type') === 'code' && /openid/.test(p.get('scope')) && p.get('state').length >= 20, 'رابط البدء: العميل + الرجوع + code + state');
  ok((await api('/api/g/start', { device: 'x' })).code === 400, 'جهاز غير صالح مرفوض');
  ok(await cb('devA-xxxxxxxx', 'cA') === '/?g=linked', 'أول ربط: linked');
  r = await api('/api/g/status', { device: 'devA-xxxxxxxx' }); ok(r.j.linked && r.j.em === 'ah***@example.com' && !JSON.stringify(r.j).includes('ahmad@'), 'الإيميل مخفي جزئياً');
  await wait(500); ok(!fs.readFileSync(path.join(__dirname, 'accounts.json'), 'utf8').includes('ahmad@example.com'), 'الإيميل الكامل ما يتخزّن');
  ok(await cb('devA-xxxxxxxx', 'cA') === '/?g=same', 'نفس الجهاز مرة ثانية: same');
  const pr = await state('devB-xxxxxxxx'); const r1 = await api('/auth/google/callback?code=cA&state=' + pr.get('state')); const r2 = await api('/auth/google/callback?code=cA&state=' + pr.get('state'));
  ok(r1.loc === '/?g=moved' && r2.loc === '/?g=err', 'جهاز جديد: moved، وإعادة استخدام state مرفوضة');
  r = await api('/api/mine', { device: 'devB-xxxxxxxx' }); ok(r.j.house && r.j.house.id === 'h000000001', 'البيت انتقل للجهاز الجديد');
  r = await api('/api/mine', { device: 'devA-xxxxxxxx' }); ok(!r.j.house, 'الجهاز القديم ما عاد عنده البيت');
  ok(await cb('devC-xxxxxxxx', 'cA') === '/?g=conflict', 'جهاز عنده بيت ثاني: conflict');
  ok(await cb('devB-xxxxxxxx', 'cS2') === '/?g=other', 'جهاز مربوط بحساب ثاني: other');
  ok(await cb('devD-xxxxxxxx', 'cBad') === '/?g=err' && await cb('devD-xxxxxxxx', 'nope') === '/?g=err' && (await api('/auth/google/callback?code=cA&state=fake')).loc === '/?g=err', 'جمهور غلط / رمز غلط / state مزوّر: err');
  // قصر المشتركين يرتبط بالحساب والبيت الأساسي ويفتح تلقائياً
  const V = await mk('devB-xxxxxxxx', 'احمد'); let vh = last(V, m => m.t === 'vh'); const omar = vh.l[0].id; ok(vh.lk === 1 && !vh.pass, 'حساب موثّق: قبل الدخول بالرمز ما فيه تصريح');
  clr(V); V.send({ t: 'vp', i: omar, p: '1234' }); await wait(700); const vp = last(V, m => m.t === 'vip'); ok(vp && vp.ok && vp.nog === 0, 'دخول بالرمز: بدون تنبيه «وثّق حسابك»');
  await wait(600); const vj = JSON.parse(fs.readFileSync(path.join(__dirname, 'vip.json'), 'utf8')); ok(vj.houses[0].g === 'sub-aaa' && vj.houses[0].hh === 'h000000001', 'القصر مرتبط بالحساب وبيته الأساسي');
  V.sock.destroy(); ok(await cb('devE-xxxxxxxx', 'cA') === '/?g=moved', 'تبديل جهاز ثاني');
  const E = await mk('devE-xxxxxxxx', 'احمد'); vh = last(E, m => m.t === 'vh'); ok(vh && vh.pass && vh.mine.includes(omar), 'من جهاز جديد: قصره يفتح تلقائياً بدون رمز');
  const Z = await mk('devZ-xxxxxxxx', 'زائر'); clr(Z); Z.send({ t: 'vp', i: omar, p: '1234' }); await wait(700); ok(last(Z, m => m.t === 'vip').nog === 1, 'غير موثّق يدخل بالرمز: ينبَّه يوثّق حسابه');
  // مزامنة المحظورين والنتائج
  r = await api('/api/g/sync', { device: 'devNEW-xxxxxxxx', bl: [], gs: {} }); ok(r.code === 404, 'مزامنة جهاز غير مربوط: مرفوضة');
  r = await api('/api/g/sync', { device: 'devE-xxxxxxxx', mode: 'union', bl: ['aaaaaaaaaa', 'bad', 'bbbbbbbbbb'], gs: { snake: 30, memory: 20, whack: 5, hack: 99, g2048: -1 } });
  ok(r.j && r.j.bl.join() === 'aaaaaaaaaa,bbbbbbbbbb' && r.j.gs.snake === 30 && r.j.gs.memory === 20 && !r.j.gs.hack && !r.j.gs.g2048, 'دمج أول: معرّفات صالحة فقط + نتائج مسموحة فقط');
  r = await api('/api/g/sync', { device: 'devE-xxxxxxxx', mode: 'union', bl: ['cccccccccc'], gs: { snake: 10, memory: 35 } });
  ok(r.j.bl.length === 3 && r.j.gs.snake === 30 && r.j.gs.memory === 20, 'جهاز ثاني: المحظورين تتجمّع، والأفضل يبقى (الذاكرة الأقل)');
  r = await api('/api/g/sync', { device: 'devE-xxxxxxxx', mode: 'adopt', bl: ['dddddddddd'], gs: {} }); ok(r.j.bl.length === 3 && !r.j.bl.includes('dddddddddd'), 'adopt: ياخذ اللي عند الحساب');
  r = await api('/api/g/sync', { device: 'devE-xxxxxxxx', mode: 'set', bl: ['aaaaaaaaaa'], gs: {} }); ok(r.j.bl.join() === 'aaaaaaaaaa', 'set: فك الحظر ينتقل للحساب');
  const acf = JSON.parse(fs.readFileSync(path.join(__dirname, 'accounts.json'), 'utf8')); await wait(500);
  // قصر دخلته بالرمز قبل ما توثّق حسابك: يرتبط أول ما توثّق
  const P = await mk('devP-xxxxxxxx', 'سلمان'); vh = last(P, m => m.t === 'vh'); const salma = vh.l.find(x => x.name === 'سلمى').id;
  clr(P); P.send({ t: 'vp', i: salma, p: 'salma99' }); await wait(700); ok(last(P, m => m.t === 'vip') && last(P, m => m.t === 'vip').nog === 1, 'دخل قصره بالرمز قبل التوثيق');
  P.sock.destroy(); ok(await cb('devP-xxxxxxxx', 'cP') === '/?g=linked', 'ثم وثّق حسابه');
  const P2 = await mk('devP-xxxxxxxx', 'سلمان'); vh = last(P2, m => m.t === 'vh'); ok(vh && vh.pass && vh.mine.includes(salma), 'بعد التوثيق: قصره ينربط ويفتح تلقائياً');
  await wait(600); let vj2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'vip.json'), 'utf8')); ok(vj2.houses.find(x => x.id === salma).g === 'sub-pre', 'القصر مربوط بحسابه');
  // قصر صاحب المدينة يرتبط بحسابه لما يدخل كمشرف
  ok(await cb('devAdm-xxxxxxx', 'cAdm') === '/?g=linked', 'المشرف يوثّق حسابه');
  const AD = await mk('devAdm-xxxxxxx', 'x'); AD.send({ t: 'admin', k: 'admintok-xyz' }); await wait(600); await wait(500);
  vj2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'vip.json'), 'utf8')); ok(vj2.houses.find(x => x.adm).g === 'sub-adm', 'قصر صاحب المدينة ارتبط بحسابه');
  const AD2 = await mk('devAdm2-xxxxxx', 'x'); ok(await cb('devAdm2-xxxxxx', 'cAdm') === '/?g=moved', 'يدخل من جهاز ثاني'); const AD3 = await mk('devAdm2-xxxxxx', 'x'); vh = last(AD3, m => m.t === 'vh'); ok(vh.pass && vh.mine.length >= 1, 'من الجهاز الثاني: قصره يفتح بدون رمز مشرف');
  // البيوت الموثّقة بقوقل: بدون رمز
  await wait(61000);
  r = await api('/api/house', { name: 'بيتبدون', plot: 3, device: 'devN-xxxxxxxxx', ch: 0 }); ok(r.code === 400, 'غير موثّق: بناء بيت بدون رمز مرفوض');
  ok(await cb('devH-xxxxxxxxx', 'cH') === '/?g=linked', 'لاعب جديد وثّق حسابه');
  r = await api('/api/house', { name: 'بيتجديد', plot: 3, device: 'devH-xxxxxxxxx', ch: 0 }); ok(r.code === 200 && r.j.house && r.j.hasPin === true, 'موثّق: يبني بيته بدون رمز');
  if (!r.j.house) console.log('DBG', r.code, JSON.stringify(r.j)); const hid = r.j.house.id; r = await api('/api/mine', { device: 'devH-xxxxxxxxx' }); ok(r.j.house && r.j.house.id === hid && r.j.hasPin, 'بيته يفتح له (بدون رمز) ويرتبط بحسابه');
  r = await api('/api/manage', { id: hid, device: 'devH-xxxxxxxxx', action: 'rename', name: 'بيتمعدل' }); ok(r.code === 200 && r.j.house.name === 'بيتمعدل', 'تعديل الاسم بدون رمز من جهازه');
  r = await api('/api/manage', { id: hid, device: 'devQ-xxxxxxxxx', pin: '1234', action: 'rename', name: 'اختراق' }); ok(r.code === 403, 'جهاز ثاني برمز: مرفوض (الرمز ما عاد يفتح البيت الموثّق)');
  r = await api('/api/claim', { id: hid, device: 'devQ-xxxxxxxxx', pin: '1234' }); ok(r.code === 403 && /قوقل/.test(r.j.error), 'استرجاع البيت الموثّق بالرمز: مرفوض، ويوجّهه لقوقل');
  r = await api('/api/manage', { id: 'h000000001', device: 'devE-xxxxxxxx', action: 'rename', name: 'بيتاحمد2' }); ok(r.code === 200, 'البيت القديم لما وثّق صاحبه صار بدون رمز كذلك');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); fake.close(); process.exit(fail ? 1 : 0);
});
