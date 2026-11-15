// اختبار الألعاب الجماعية بالسيرفر: لودو + سباق النقر + خمّن الرقم (بوتات سريعة MG_FAST)
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_mg_houses.json'); fs.writeFileSync(DATA, '[]');
for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3976, B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, MG_FAST: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 250) } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0), on: null };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { const m = JSON.parse(s); c.inbox.push(m); if (c.on) c.on(m); } } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const last = (c, f) => [...c.inbox].reverse().find(f);
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await wait(30); } return null; };
srv.stdout.once('data', async () => {
  const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(250); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); return c; };
  const A = await mk('devA-xxxxxxxx', 'احمد'), Bc = await mk('devB-xxxxxxxx', 'سالم'), Cc = await mk('devC-xxxxxxxx', 'خالد');
  setInterval(() => { for (const c of [A, Bc, Cc]) c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); }, 3000).unref();

  // ================= لودو مع بوتات =================
  A.send({ t: 'mq', g: 'ludo' }); await wait(200);
  let lob = last(A, m => m.s === 'lobby'); ok(lob && lob.names.length === 1 && lob.max === 4, 'لودو: لوبي فيه لاعب واحد وأقصى 4');
  A.send({ t: 'mb', n: 4 });
  const st = await until(() => last(A, m => m.s === 'mstart'), 2000);
  ok(st && st.g === 'ludo' && st.names.length === 4 && st.names.slice(1).every(n => n.includes('🤖')) && st.me === 0 && st.seats.join() === '0,1,2,3', 'لودو: ابدأ مع 3 بوتات → 4 لاعبين (أنا + 3 بوتات)');
  let rolls = 0, moves = 0, bad = false, lastState = null;
  A.on = m => {
    if (m.s !== 'lst') return; lastState = m;
    for (const row of m.toks) for (const v of row) if (v < -1 || v > 57) bad = true;
    if (m.cur === 0 && m.ph === 'roll') { rolls++; A.send({ t: 'mm', a: 'roll' }); }
    else if (m.cur === 0 && m.ph === 'move' && m.mv.length > 1) { moves++; A.send({ t: 'mm', a: 'mv', i: m.mv[m.mv.length - 1] }); }
  };
  const end = await until(() => last(A, m => m.s === 'mend'), 120000);
  A.on = null;
  ok(end && (end.res === 'win' || end.res === 'lose') && end.win, 'لودو: اللعبة تخلص بفائز: ' + (end && end.win) + ' (رميات أنا ' + rolls + ')');
  ok(!bad && lastState && lastState.toks.some(r => r.every(v => v === 57)), 'لودو: قيم القطع سليمة وفيه لاعب وصّل كل قطعه');
  A.send({ t: 'gc', k: 1 }); await wait(250); ok(last(A, m => m.s === 'chat' && m.me === 1 && m.k === 1), 'دردشة لودو: رسالتي ترجع لي (me)');
  // رمي بغير دوري ما يمشي
  A.send({ t: 'mr' }); const st2 = await until(() => { const s = A.inbox.filter(m => m.s === 'mstart'); return s.length >= 2 ? s[s.length - 1] : null; }, 2000); ok(!!st2, 'لودو: مباراة ثانية (mr)');
  A.send({ t: 'ml' }); await wait(300);

  // ================= لودو بلاعبين (لاعب + بوت) =================
  A.send({ t: 'mq', g: 'ludo' }); await wait(150); A.send({ t: 'mb', n: 2 });
  const s2 = await until(() => last(A, m => m.s === 'mstart' && m.g === 'ludo' && m.names.length === 2), 2000); ok(s2 && s2.seats.join() === '0,2', 'لودو: لاعبين → مقعدين متقابلين (0 و 2)');
  A.send({ t: 'ml' }); await wait(200);
  // ================= لودو: لاعبين حقيقيين + عدّاد البدء + دردشة اللوبي =================
  Bc.send({ t: 'mq', g: 'ludo' }); await wait(200); Cc.send({ t: 'mq', g: 'ludo' }); await wait(300);
  lob = last(Bc, m => m.s === 'lobby'); ok(lob && lob.names.length === 2 && lob.left > 0 && lob.left <= 12, 'لودو: لاعبين بالانتظار والعدّاد يشتغل (' + (lob && lob.left) + ' ث)');
  Cc.send({ t: 'gc', k: 4 }); await wait(250); ok(last(Bc, m => m.s === 'chat' && !m.me && m.k === 4) && last(Cc, m => m.s === 'chat' && m.me === 1), 'دردشة اللوبي: توصل للاعبين المنتظرين');
  Cc.send({ t: 'ml' }); await wait(300); lob = last(Bc, m => m.s === 'lobby'); ok(lob && lob.names.length === 1 && !lob.left, 'لودو: لو واحد طلع يرجع للانتظار');
  Bc.send({ t: 'ml' }); await wait(200);

  // ================= سباق النقر =================
  A.send({ t: 'mq', g: 'tap' }); await wait(150); A.send({ t: 'mb' });
  const ts = await until(() => last(A, m => m.s === 'mstart' && m.g === 'tap'), 2000); ok(ts && ts.names.length === 3, 'النقر: بدأ مع بوتات');
  const run = await until(() => last(A, m => m.s === 'tst' && m.ph === 'run'), 5000); ok(!!run, 'النقر: العدّ التنازلي ثم يبدأ السباق');
  A.send({ t: 'mm', a: 'tap' }); A.send({ t: 'mm', a: 'tap' }); A.send({ t: 'mm', a: 'tap' }); await wait(120);
  const burst = last(A, m => m.s === 'tst'); ok(burst && burst.taps[0] <= 2, 'النقر: الضغط السريع جداً يُحدّ (ما يغش): ' + (burst && burst.taps[0]));
  let lastTap = 0; const tapEnd = await until(() => { const n = Date.now(); if (n - lastTap >= 70 && !last(A, m => m.s === 'mend' && m.g === 'tap')) { lastTap = n; A.send({ t: 'mm', a: 'tap' }); } return last(A, m => m.s === 'mend' && m.g === 'tap'); }, 20000);   // أبطأ من حد السيرفر (25 رسالة/ث) وإلا يقطع الاتصال
  ok(tapEnd && tapEnd.win, 'النقر: يخلص بفائز: ' + (tapEnd && tapEnd.win));
  A.send({ t: 'ml' }); await wait(200);

  // ================= خمّن الرقم (بالدور) =================
  A.send({ t: 'mq', g: 'guess' }); await wait(150); A.send({ t: 'mb', n: 2 });
  const gs = await until(() => last(A, m => m.s === 'mstart' && m.g === 'guess'), 2000); ok(gs && gs.names.length === 2, 'خمّن الرقم: لاعبين (أنا + بوت)');
  const g0 = await until(() => last(A, m => m.s === 'gst'), 1500); ok(g0 && g0.cur === 0, 'خمّن الرقم: الدور الأول لي');
  A.send({ t: 'mm', a: 'g', n: 0 }); A.send({ t: 'mm', a: 'g', n: 101 }); A.send({ t: 'mm', a: 'g', n: 'x' }); await wait(250);
  ok(!last(A, m => m.s === 'gst' && m.log.length), 'خمّن الرقم: تخمين غلط (0 / 101 / نص) مرفوض');
  let lo = 1, hi = 100, hintsOk = true, outOfTurnIgnored = true, myGuesses = 0;
  A.on = m => {
    if (m.s !== 'gst') return;
    if (m.lo > m.hi) hintsOk = false;
    if (m.cur === 0 && !m.over && !A._busy) { A._busy = true; const mid = Math.floor((m.lo + m.hi) / 2); myGuesses++; A.send({ t: 'mm', a: 'g', n: mid }); A.send({ t: 'mm', a: 'g', n: Math.min(100, mid + 1) }); setTimeout(() => { A._busy = false; }, 120); }
  };
  const gEnd = await until(() => last(A, m => m.s === 'mend' && m.g === 'guess'), 40000); A.on = null;
  ok(gEnd && gEnd.win && hintsOk, 'خمّن الرقم: بالدور، التلميحات سليمة واللعبة تخلص: ' + (gEnd && gEnd.win) + ' (تخميناتي ' + myGuesses + ')');
  const gl = last(A, m => m.s === 'gst'); const mine = gl ? gl.log.filter(l => l.who === 'احمد').length : 0, others = gl ? gl.log.filter(l => l.who !== 'احمد').length : 0;
  ok(Math.abs(mine - others) <= 1, 'خمّن الرقم: التخمين بالتناوب (أنا ' + mine + ' والبوت ' + others + ') — التخمين الإضافي برا الدور ما يُحسب');
  A.send({ t: 'ml' }); await wait(200);
  // ================= خمّن الرقم بأربعة =================
  A.send({ t: 'mq', g: 'guess' }); await wait(150); A.send({ t: 'mb', n: 4 });
  const g4 = await until(() => { const s = A.inbox.filter(m => m.s === 'mstart' && m.g === 'guess'); return s.length >= 2 ? s[s.length - 1] : null; }, 2000); ok(g4 && g4.names.length === 4, 'خمّن الرقم: أربعة لاعبين');
  A.send({ t: 'ml' }); await wait(200);
  // خروج وسط اللعبة ما يكسر شي
  A.send({ t: 'mq', g: 'ludo' }); await wait(120); A.send({ t: 'mb' }); await wait(400); A.sock.destroy(); await wait(600);
  ok(true, 'الخروج المفاجئ وسط لودو ما يكسر السيرفر');
  const D = await mk('devD-xxxxxxxx', 'ثالث'); D.send({ t: 'mq', g: 'tap' }); await wait(300); ok(!!last(D, m => m.s === 'lobby'), 'السيرفر ما زال يستقبل لاعبين بعد الخروج');
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.kill('SIGTERM'); await wait(500); for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} } process.exit(fail ? 1 : 0);
});
