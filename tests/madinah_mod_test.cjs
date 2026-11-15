// اختبار الإشراف: بلاغ + دليل الرسائل + دخول المشرف + منع كتابة + طرد + حذف بيت + حماية التخمين
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_mod_houses.json');
fs.writeFileSync(DATA, JSON.stringify([...[{id:'hz0000001',plot:21,type:1,name:'سالم',t:1,dev:'devB-xxxxxxxx',ip:'z',days:2,last:'2000-01-01',lk:[],ch:2,st:[0,0,0,0,0]}],{ id: 'house00001', plot: 3, type: 1, name: 'مزيّن', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 2, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
try { fs.unlinkSync(path.join(__dirname, 'moderation.json')); } catch {}
const PORT = 3989, ADMIN = 'admintok-xyz';
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'inherit'] });
const B = `http://127.0.0.1:${PORT}`;
const req = (m, u, body, headers = {}, ip = '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.1') => fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...headers }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ s: r.status, d: await r.json().catch(() => ({})) }));
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.0.' + (1 + Math.floor(Math.random() * 200)) } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0), closed: false };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); if (op === 8) c.closed = true; } });
      sock.on('close', () => c.closed = true); sock.on('error', () => {});
      res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const AH = { 'X-Admin': ADMIN };
srv.stdout.once('data', async () => {
  const A = await client(), Bc = await client();
  A.send({ t: 'hi', d: 'devA-xxxxxxxx', n: 'احمد' }); Bc.send({ t: 'hi', d: 'devB-xxxxxxxx', n: 'سالم' });
  await wait(300);
  const bid = Bc.inbox.find(m => m.t === 'me').id;
  A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); Bc.send({ t: 'p', x: 5, z: 0, y: 0, r: 0, m: 0 });
  setInterval(() => { A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); Bc.send({ t: 'p', x: 5, z: 0, y: 0, r: 0, m: 0 }); }, 3000).unref();
  await wait(300);
  // B يكتب رسالتين (دليل)
  Bc.send({ t: 'say', x: 'كلام عادي أول' }); await wait(1300); Bc.send({ t: 'say', x: 'رسالة ثانية' }); await wait(500);

  // ===== بلاغ =====
  let x = await req('POST', '/api/report', { device: 'devA-xxxxxxxx', peer: bid, reason: 2 }); ok(x.s === 200 && x.d.ok && !x.d.dup, 'report accepted');
  x = await req('POST', '/api/report', { device: 'devA-xxxxxxxx', peer: bid, reason: 2 }); ok(x.s === 200 && x.d.dup, 'duplicate report same day ignored');
  x = await req('POST', '/api/report', { device: 'devB-xxxxxxxx', peer: bid, reason: 0 }); ok(x.s === 400, 'cannot report yourself');
  x = await req('POST', '/api/report', { device: 'devA-xxxxxxxx', peer: bid, reason: 9 }); ok(x.s === 400, 'bad reason refused');
  x = await req('POST', '/api/report', { device: 'devA-xxxxxxxx', peer: 'zzzz', reason: 1 }); ok(x.s === 404, 'unknown player → 404');
  x = await req('POST', '/api/report', { device: 'short', peer: bid, reason: 1 }); ok(x.s === 400, 'bad device refused');
  x = await req('POST', '/api/report', { device: 'devA-xxxxxxxx', house: 'house00001', reason: 3 }); ok(x.s === 200, 'report a house owner by house id');

  // ===== دخول المشرف =====
  x = await req('GET', '/api/admin/state', null, {}, '10.9.9.9'); ok(x.s === 403, 'admin without token → 403');
  x = await req('GET', '/api/admin/state', null, { 'X-Admin': 'wrong' }, '10.9.9.9'); ok(x.s === 403, 'admin wrong token → 403');
  x = await req('GET', '/api/admin/state', null, AH); ok(x.s === 200 && Array.isArray(x.d.reports), 'admin right token → state');
  const st = x.d, rb = st.reports.find(r => r.name === 'سالم'), rh = st.reports.find(r => r.home === 'house00001');
  ok(rb && rb.count === 1 && rb.reasons[2] === 1 && rb.k==='hz0000001', 'report group for B (house key)');
  ok(rb && rb.log.length === 2 && rb.log[0].x === 'كلام عادي أول', 'evidence: last typed messages saved server-side');
  ok(rh && rh.reasons[3] === 1, 'report group for house owner');
  ok(st.online.length === 2 && st.online.some(o => o.name === 'سالم'), 'online list');

  // ===== منع كتابة =====
  x = await req('POST', '/api/admin/act', { a: 'ban', k: rb.k }, AH); ok(x.s === 200, 'ban B');
  await wait(1300); A.inbox.length = 0; Bc.inbox.length = 0; Bc.send({ t: 'say', x: 'هل أقدر أكتب؟' }); await wait(500);
  ok(Bc.inbox.some(m => m.t === 'err' && m.e === 'banned') && !A.inbox.some(m => m.t === 'msg'), 'banned player cannot chat (A gets nothing)');
  Bc.inbox.length = 0; Bc.send({ t: 'say', k: 0 }); await wait(2000);
  ok(Bc.inbox.some(m => m.t === 'err' && m.e === 'banned'), 'banned also blocks preset messages');
  x = await req('POST', '/api/admin/act', { a: 'unban', k: rb.k }, AH); ok(x.s === 200, 'unban B');
  await wait(1300); A.inbox.length = 0; Bc.send({ t: 'say', x: 'رجعت' }); await wait(500);
  ok(A.inbox.some(m => m.t === 'msg' && m.x === 'رجعت'), 'after unban chat works');
  // الأدمن يمنع بيت (مفتاحه رقم البيت) — حتى لو ما كان متصل
  x = await req('POST', '/api/admin/act', { a: 'ban', k: 'house00001' }, AH); x = await req('GET', '/api/admin/state', null, AH); ok(x.d.bans.some(b => b.k === 'house00001'), 'house ban stored');
  await req('POST', '/api/admin/act', { a: 'unban', k: 'house00001' }, AH);

  // ===== طرد =====
  x = await req('POST', '/api/admin/act', { a: 'kick', id: bid }, AH); await wait(500); ok(x.s === 200 && Bc.closed, 'kick closes connection');
  // لاعب طلع: ما زال قابل للتبليغ (ghost)
  x = await req('POST', '/api/report', { device: 'devA-xxxxxxxx', peer: bid, reason: 4 }); ok(x.s === 200 && x.d.dup, 'report on a player who just left still resolves (ghost)');

  // ===== تجاهل + حذف بيت =====
  x = await req('POST', '/api/admin/act', { a: 'dismiss', k: rb.k }, AH); x = await req('GET', '/api/admin/state', null, AH); ok(!x.d.reports.some(r => r.k === rb.k), 'dismiss removes report');
  x = await req('POST', '/api/admin/act', { a: 'delhouse', id: 'house00001' }, AH); x = await req('GET', '/api/admin/state', null, AH);
  ok(x.d.houses === 1 && !x.d.reports.some(r => r.home === 'house00001'), 'delete house via admin + its reports cleared');
  x = await req('POST', '/api/admin/act', { a: 'hack', k: 'x' }, AH); ok(x.s === 400, 'unknown admin action refused');

  // ===== هوية صاحب المدينة =====
  const Cc = await client(); Cc.send({ t: 'hi', d: 'devC-xxxxxxxx', n: 'من الصفر' }); await wait(200);
  Cc.send({ t: 'p', x: 3, z: 3, y: 0, r: 0, m: 0 }); setInterval(() => Cc.send({ t: 'p', x: 3, z: 3, y: 0, r: 0, m: 0 }), 3000).unref();
  A.inbox.length = 0; await wait(700);
  const meta1 = A.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m);
  const imp = meta1.find(m => m[0] === Cc.inbox.find(q => q.t === 'me').id);
  ok(imp && imp[1] === 'زائر', 'visitor cannot take the name من الصفر (becomes زائر): ' + JSON.stringify(imp));
  x = await req('POST', '/api/house', { name: 'من الصفر', pin: '1234', plot: 40, device: 'devX1-xxxxxxxx' }); ok(x.s === 400, 'house name من الصفر refused');
  x = await req('POST', '/api/house', { name: 'منالصفر', pin: '1234', plot: 41, device: 'devX2-xxxxxxxx' }); ok(x.s === 400, 'house name منالصفر (no space) refused');
  Cc.send({ t: 'admin', k: 'not-the-code' }); A.inbox.length = 0; await wait(700);
  ok(!Cc.inbox.some(m => m.t === 'admin'), 'wrong admin code over ws: no owner identity');
  Cc.send({ t: 'admin', k: ADMIN }); A.inbox.length = 0; await wait(900);
  ok(Cc.inbox.some(m => m.t === 'admin' && m.ok), 'right admin code over ws → confirmed');
  const meta2 = A.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m).find(m => m[0] === Cc.inbox.find(q => q.t === 'me').id);
  ok(meta2 && meta2[1] === 'من الصفر' && meta2[2] === 10 && meta2[4] === 7 && meta2[5] === 5 && meta2[6] === 7, 'others receive owner identity (name, char 10, crown 7, cape 5, tag 7): ' + JSON.stringify(meta2));
  Cc.send({ t: 'hi', d: 'devC-xxxxxxxx', n: 'غيره' }); Cc.send({ t: 'c', c: 4 }); A.inbox.length = 0; await wait(900);
  const meta3 = A.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m).find(m => m[0] === Cc.inbox.find(q => q.t === 'me').id);
  ok(!meta3 || (meta3[1] === 'من الصفر' && meta3[2] === 10), 'owner identity survives re-hi / char change');
  x = await req('POST', '/api/style', { device: 'devC-xxxxxxxx', st: [7, 5, 7, 0, 0] }); ok(x.s === 403 || x.s === 400, 'exclusive items cannot be set through the style API');

  // ===== تخمين الرمز =====
  let last; for (let i = 0; i < 11; i++) last = await req('GET', '/api/admin/state', null, { 'X-Admin': 'guess' + i }, '10.77.7.7');
  ok(last.s === 429, 'admin brute force locked after 10 wrong tokens');
  x = await req('GET', '/api/admin/state', null, AH, '10.77.7.7'); ok(x.s === 429, 'even right token refused from locked network');

  // ===== بلاغات بالدقيقة =====
  let rl; for (let i = 0; i < 7; i++) rl = await req('POST', '/api/report', { device: 'devR' + i + '-xxxxxxxx', peer: 'zzzz', reason: 1 }, null, '10.55.5.5');
  ok(rl.s === 429, 'report rate limit per network');

  await wait(600);
  ok(fs.existsSync(path.join(__dirname, 'moderation.json')), 'moderation.json persisted');
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.kill(); process.exit(fail ? 1 : 0);
});
setTimeout(() => { console.log('timeout'); srv.kill(); process.exit(1); }, 90000);
