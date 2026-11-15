// حذف الخيام المهجورة (14 يوم) + صيغة /api/h المضغوطة
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, 'madinah_prune_houses.json'), PORT = 3987, D = 86400e3, now = Date.now();
const day = ms => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
const H = (id, plot, type, t, last, extra = {}) => ({ id, plot, type, name: 'بيت' + plot, t, dev: 'dev' + id + 'xxxxxxxx', ip: null, days: type ? 3 : 1, last, lk: [], ch: 0, st: [0, 0, 0, 0, 0], ...extra });
fs.writeFileSync(DATA, JSON.stringify([
  H('a000000001', 0, 0, now - 20 * D, day(now - 20 * D)),             // خيمة مهجورة 20 يوم → تنحذف
  H('a000000002', 1, 0, now - 20 * D, day(now - 2 * D)),              // خيمة زارها قبل يومين → تبقى
  H('a000000003', 2, 2, now - 40 * D, day(now - 30 * D), { st: [1, 0, 2, 0, 0], dx: ['palm'], pk: [[2, 0]] }),   // فيلا مهجورة → تبقى (مو خيمة)
  H('a000000004', 3, 0, now - 20 * D, undefined),                     // خيمة بلا last، انبنت قبل 20 يوم → تنحذف
  H('a000000005', 4, 0, now - 3 * D, undefined),                      // خيمة جديدة → تبقى
]));
try { fs.unlinkSync(path.join(__dirname, 'removed-tents.jsonl')); } catch {}
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, PRUNE_DELAY_MS: 300, PRUNE_MIN: 1 }, stdio: ['ignore', 'pipe', 'inherit'] });
let logs = ''; srv.stdout.on('data', d => logs += d);
setTimeout(async () => {
  try {
    const d = await (await fetch(`http://127.0.0.1:${PORT}/api/h`)).json();
    const ids = d.h.map(x => x[0]).sort();
    ok(d.count === 3 && ids.join() === 'a000000002,a000000003,a000000005', 'انحذفت الخيمتين المهجورتين وبقت الثلاثة (' + ids.join() + ')');
    const v = d.h.find(x => x[0] === 'a000000003');
    ok(Array.isArray(v) && v[1] === 2 && v[2] === 2 && v[3] === 'بيت2' && v[4] === 3 && v[5] === 0 && v[6] === 0 && JSON.stringify(v[7]) === '[1,0,2,0,0]' && JSON.stringify(v[8]) === '["palm"]' && JSON.stringify(v[9]) === '[[2,0]]', 'الصيغة المضغوطة للفيلا كاملة: ' + JSON.stringify(v));
    const t = d.h.find(x => x[0] === 'a000000005');
    ok(t.length === 4, 'الخيمة الفاضية 4 عناصر بس (الأصفار محذوفة): ' + JSON.stringify(t));
    const old = await (await fetch(`http://127.0.0.1:${PORT}/api/houses`)).json();
    ok(old.houses.length === 3 && old.houses[0].id && 'likes' in old.houses[0], 'الصيغة القديمة /api/houses باقية للأدوات');
    const rm = fs.readFileSync(path.join(__dirname, 'removed-tents.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    ok(rm.length === 2 && rm.every(h => h.type === 0), 'المحذوفة محفوظة بسجل removed-tents.jsonl');
    ok(/حذف 2 خيمة/.test(logs), 'السجل يطبع العدد');
    await new Promise(r => setTimeout(r, 3000));
    const file = JSON.parse(fs.readFileSync(DATA, 'utf8')); ok(file.length === 3, 'الملف انحفظ بعد الحذف');
  } catch (e) { console.log('ERR', e); fail++; }
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
}, 1500);
