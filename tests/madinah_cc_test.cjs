// اختبار مركز الشكاوي: العدّاد يوصل لصاحب المدينة والمشرف والمدير العام بس، البلاغات/التظلّمات/السجن، والإجراءات
// node tests/madinah_cc_test.cjs server.js
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_cc_houses.json'), PORT = 3971, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-cc';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'push.json', 'evidence.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devU-xxxxxxxx', 'عمر'), hs('h000000002', 1, 'devM-xxxxxxxx', 'مشرف'), hs('h000000003', 2, 'devW-xxxxxxxx', 'وليد'), hs('h000000004', 3, 'devG-xxxxxxxx', 'مدير')]));
fs.writeFileSync(path.join(__dirname, 'jobs.json'), JSON.stringify({ emp: { h000000004: { j: 'gm', n: 'مدير', t: Date.now() } } }));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, DEL_DAY: 1, EV_SAVE_MS: 1000 }, stdio: ['ignore', 'pipe', 'inherit'] });
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.6.' + (ipN++) + '.7' } });
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
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async dev => { const c = await client(); c.send({ t: 'hi', d: dev }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
const req = (method, p, body) => new Promise(res => { const d = body ? JSON.stringify(body) : ''; const q = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.' + (ipN++) + '.1', Origin: B } }, r => { let s = ''; r.on('data', x => s += x); r.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch {} res({ s: r.statusCode, d: j }); }); }); q.end(d); });
const cnt = c => { const m = last(c, x => x.t === 'ccn') || c.ccn; return m ? (m.off ? 'off' : m.n) : undefined; };
const list = async c => { c.ccn = last(c, x => x.t === 'ccn') || c.ccn; c.inbox.length = 0; c.send({ t: 'cc' }); await wait(450); return last(c, x => x.t === 'ccl'); };
srv.stdout.once('data', async () => {
  await wait(700);
  const AD = await mk('devAdm-xxxxxxx'); AD.send({ t: 'admin', k: ADMIN }); await wait(400);
  const U = await mk('devU-xxxxxxxx'), M = await mk('devM-xxxxxxxx'), W = await mk('devW-xxxxxxxx'), G = await mk('devG-xxxxxxxx');
  AD.send({ t: 'sa', f: M.id, on: true }); await wait(4600);
  ok(cnt(AD) === 0 && cnt(M) === 0 && cnt(G) === 0, 'العدّاد (صفر) يوصل لصاحب المدينة والمشرف والمدير العام', JSON.stringify([cnt(AD), cnt(M), cnt(G)]));
  ok(cnt(W) === undefined && cnt(U) === undefined, 'اللاعب العادي ما يوصله العدّاد');
  W.send({ t: 'cc' }); await wait(400); ok(!last(W, x => x.t === 'ccl') && cnt(W) === 'off', 'اللاعب العادي ما يقدر يفتح المركز');
  // بلاغين على عمر (من جهازين) → الرقم يصير 1 فوراً (مجموعة وحدة)
  U.send({ t: 'say', k: 0 }); await wait(1300); U.send({ t: 'say', x: 'رقمي 0551234567' }); await wait(1300); U.send({ t: 'say', x: 'كلام للدليل' }); await wait(400);
  W.send({ t: 'say', x: 'sh1t' }); await wait(400);
  let r = await req('POST', '/api/report', { device: 'devW-xxxxxxxx', peer: U.id, reason: 0 }); ok(r.s === 200 && r.d.ok, 'بلاغ أول', JSON.stringify(r));
  r = await req('POST', '/api/report', { device: 'devX-xxxxxxxx', peer: U.id, reason: 4 }); await wait(400);
  ok(cnt(AD) === 1 && cnt(M) === 1 && cnt(G) === 1, 'العدّاد صار 1 للكل فوراً (بلاغات نفس الشخص مجموعة وحدة)', JSON.stringify([cnt(AD), cnt(M), cnt(G)]));
  let L = await list(G); const rp = L && L.reps[0];
  ok(rp && rp.c === 2 && rp.rs[0] === 1 && rp.rs[4] === 1 && rp.on === 1 && rp.h === 1 && rp.log.some(l => l.k === 'w' && l.x === 'كلام للدليل'), 'القائمة: عدد البلاغات والأسباب والدليل ومتصل', JSON.stringify(rp));
  ok(rp.log.some(l => l.k === 's' && l.i === 0) && rp.log.some(l => l.k === 'b' && l.e === 'contact' && /0551234567/.test(l.x)), 'الدليل فيه الجاهزة 💬 والمحجوبة 🚫 (رقم) بنصها', JSON.stringify(rp.log));
  ok(typeof rp.w === 'string' && rp.w.length > 2 && rp.log.every(l => l.w && l.t), 'المكان وقت البلاغ + مكان ووقت كل رسالة', rp.w);
  ok(L.adm === 0 && L.jp === 1, 'المدير العام: مو أدمن، وله تبويب السجن', JSON.stringify([L.adm, L.jp]));
  // المدير العام يحظر يوم → البلاغات تنقفل وتنسجل
  clr(U); G.send({ t: 'cca', a: 'ban', k: rp.k, mins: 1440 }); await wait(500);
  ok(last(U, m => m.t === 'bn' && m.on === 1 && m.left > 23 * 3600e3), 'المدير العام حظره يوم من المركز');
  L = last(G, x => x.t === 'ccl'); ok(L && L.reps.length === 0 && L.hist[0] && /يوم/.test(L.hist[0][2]) && L.hist[0][3] === 'مدير', 'البلاغ انقفل وانسجل بالسجل باسم المنفّذ', JSON.stringify(L && L.hist));
  ok(cnt(AD) === 0 && cnt(M) === 0, 'العدّاد رجع صفر عند الباقين', JSON.stringify([cnt(AD), cnt(M)]));
  await wait(400); G.send({ t: 'cca', a: 'ban', k: rp.k, mins: 0 }); await wait(400); ok(last(G, m => m.t === 'err' && /لصاحب المدينة/.test(m.m)), 'الحظر للأبد لصاحب المدينة بس');
  // تظلّم → يطلع بالمركز
  U.send({ t: 'bap' }); await wait(500); ok(cnt(AD) === 1 && cnt(M) === 1 && cnt(G) === 1, 'التظلّم زاد العدّاد', JSON.stringify([cnt(AD), cnt(M), cnt(G)]));
  L = await list(M); const ap = L.aps[0]; ok(ap && ap.k === rp.k && ap.left > 0 && ap.by === 'مدير', 'التظلّم بالقائمة مع المدة واللي حظره', JSON.stringify(ap));
  ok(L.jp === 0, 'المشرف ما يشوف تبويب السجن');
  clr(U); M.send({ t: 'cca', a: 'unb', k: ap.k }); await wait(500); ok(last(U, m => m.t === 'bn' && m.on === 0), 'المشرف فك الحظر من المركز');
  L = last(M, x => x.t === 'ccl'); ok(L && L.aps.length === 0, 'التظلّم انقفل'); await wait(300); ok(cnt(AD) === 0, 'العدّاد صفر');
  // الحماية: ما ينحظر المدير العام
  r = await req('POST', '/api/report', { device: 'devW-xxxxxxxx', peer: G.id, reason: 4 }); await wait(400);
  L = await list(AD); const gr = L.reps.find(x => x.n === 'مدير'); ok(gr && gr.p === 1, 'المدير العام معلّم «ما ينحظر»', JSON.stringify(gr));
  clr(AD); AD.send({ t: 'cca', a: 'ban', k: gr.k, mins: 60 }); await wait(400); ok(last(AD, m => m.t === 'err' && /مشرف/.test(m.m)), 'ما ينحظر المدير العام حتى من المركز');
  AD.send({ t: 'cca', a: 'dis', k: gr.k }); await wait(400); L = last(AD, x => x.t === 'ccl'); ok(L && !L.reps.some(x => x.k === gr.k), 'تجاهل البلاغ');
  // الطرد والحذف لصاحب المدينة بس
  r = await req('POST', '/api/report', { device: 'devU-xxxxxxxx', peer: W.id, reason: 3 }); await wait(400);
  L = await list(M); const wr = L.reps.find(x => x.n === 'وليد');
  ok(wr && wr.log.some(l => l.k === 'b' && l.e === 'bad' && l.x === 'sh1t'), 'الكلمة البذيئة المحجوبة تطلع بالدليل', JSON.stringify(wr && wr.log));
  { const A = await new Promise(res => { const q = http.request({ host: '127.0.0.1', port: PORT, path: '/api/admin/state', headers: { 'X-Admin': ADMIN, 'X-Forwarded-For': '10.8.1.1' } }, r => { let s = ''; r.on('data', x => s += x); r.on('end', () => res(JSON.parse(s))); }); q.end(); });
    const wb = A.bans.find(b => b.name === 'وليد'); ok(wb && wb.auto === 1 && wb.ev.some(l => l.k === 'b'), 'لوحة المشرف: الممنوع تلقائياً مع سببه', JSON.stringify(wb)); }
  M.send({ t: 'cca', a: 'kick', k: wr.k }); await wait(400); W.send({ t: 'say', x: 'هلا' }); await wait(300); ok(!W.sock.destroyed && W.sock.readable, 'المشرف ما يقدر يطرد');
  AD.send({ t: 'cca', a: 'kick', k: wr.k }); await wait(600); let closed = false; W.sock.once('close', () => closed = true); await wait(300); ok(W.sock.destroyed || closed || !W.sock.writable, 'صاحب المدينة طرده');
  const hl = async () => { const H = await req('GET', '/api/houses'); return Array.isArray(H.d) ? H.d : H.d.houses || []; };
  L = await list(M); ok(L.dl === 1, 'المشرف باقي له حذف واحد اليوم (DEL_DAY=1)', L.dl);
  clr(M); M.send({ t: 'cca', a: 'delh', k: wr.k }); await wait(500); ok(!(await hl()).some(x => x.id === wr.k), 'المشرف حذف البيت');
  L = last(M, x => x.t === 'ccl'); ok(L && L.dl === 0, 'باقي له 0', L && L.dl);
  clr(M); M.send({ t: 'cca', a: 'delh', k: 'h000000001' }); await wait(500); ok(last(M, m => m.t === 'err' && /خلصت/.test(m.m)) && (await hl()).some(x => x.id === 'h000000001'), 'بعد الحد: ما يقدر يحذف ثاني');
  clr(G); G.send({ t: 'cca', a: 'delh', k: 'h000000002' }); await wait(500); ok(last(G, m => m.t === 'err' && /مشرف/.test(m.m)) && (await hl()).some(x => x.id === 'h000000002'), 'ما ينحذف بيت مشرف');
  L = await list(AD); ok(L.dl === -1, 'صاحب المدينة بلا حد');
  // اعتراض السجن: الشرطي (هنا المدير العام) يسجن عمر → عمر يعترض → يطلع بتبويب السجن لصاحب المدينة والمدير العام بس
  const U2 = await mk('devU-xxxxxxxx'); await wait(300);
  clr(G); G.send({ t: 'jj', f: U2.id, r: 1, m: 5 }); await wait(500);
  U2.send({ t: 'jp' }); await wait(500);
  L = await list(G); ok(L.jails.length === 1 && L.jails[0].bn === 'مدير' && L.jails[0].left > 0, 'اعتراض السجن بالمركز', JSON.stringify(L.jails));
  L = await list(M); ok(L.jails.length === 0, 'المشرف ما يشوف اعتراضات السجن');
  ok(cnt(G) >= 1, 'العدّاد يحسب اعتراض السجن', cnt(G));
  clr(U2); G.send({ t: 'cca', a: 'jrl', k: L ? (await list(G)).jails[0].k : '' }); await wait(500); ok(last(U2, m => m.t === 'jl' && m.on === 0), 'أطلقه من المركز');
  // المشرف يفقد الصلاحية → الزر يختفي
  AD.send({ t: 'sa', f: M.id, on: false }); await wait(4600); ok(cnt(M) === 'off', 'شيل المشرف → الزر يختفي عنده', cnt(M));
  const EV = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence.json'), 'utf8')); ok(EV.h000000001 && EV.h000000001.some(l => l.k === 's'), 'الأدلة محفوظة بالملف (ما تضيع مع إعادة التشغيل)');
  const MOD = JSON.parse(fs.readFileSync(path.join(__dirname, 'moderation.json'), 'utf8')); ok(Array.isArray(MOD.cch) && MOD.cch.length >= 4 && Array.isArray(MOD.appeals), 'السجل والتظلّمات محفوظة بالملف', JSON.stringify(MOD.cch));
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
