// اختبار محرك عالم المكعّبات (بدون متصفح): توليد حتمي، أشجار/معادن/ماء، شبكة صحيحة، فيزياء، تكسير/وضع، حفظ التعديلات
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), tmp = path.join(os.tmpdir(), 'voxcore_' + process.pid + '.mjs');
fs.copyFileSync(path.join(HERE, '..', 'public', 'voxcore.js'), tmp);
const V = await import(pathToFileURL(tmp).href); fs.unlinkSync(tmp);
let pass = 0, fail = 0; const ok = (c, m, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  → ' + extra : '')); };
const { B, CH, H, SEA, World, genChunk, meshChunk, stepPlayer, raycast, heightAt } = V;
const tileUV = t => [(t % 8) / 8, 1 - (Math.floor(t / 8) + 1) / 8, (t % 8 + 1) / 8, 1 - Math.floor(t / 8) / 8];
const SEED = 20261113;
// 1) التوليد حتمي
const a = genChunk(3, -2, SEED, false), b = genChunk(3, -2, SEED, false), c2 = genChunk(3, -2, SEED + 1, false);
ok(a.every((v, i) => v === b[i]) && !a.every((v, i) => v === c2[i]), 'نفس البذرة = نفس القطعة، وبذرة ثانية = عالم مختلف');
// 2) الطبيعة: عشب/تراب/حجر/أشجار/معادن/ماء/مغارات (نمسح منطقة 12×12 قطعة)
const cnt = {}; let air = 0;
for (let cx = 24; cx < 44; cx++) for (let cz = 0; cz < 20; cz++) { const ch = genChunk(cx, cz, SEED, false); for (let i = 0; i < ch.length; i++) { cnt[ch[i]] = (cnt[ch[i]] || 0) + 1; } }
ok(cnt[B.GRASS] > 5000 && cnt[B.DIRT] > 5000 && cnt[B.STONE] > 100000, 'أرض طبيعية: عشب وتراب وحجر', `${cnt[B.GRASS]}/${cnt[B.DIRT]}/${cnt[B.STONE]}`);
ok(cnt[B.LOG] > 200 && cnt[B.LEAVES] > 1000, 'غابات: خشب وأوراق', `${cnt[B.LOG]}/${cnt[B.LEAVES]}`);
ok(cnt[B.COAL] > 100 && cnt[B.IRON] > 30 && cnt[B.GOLD] > 5, 'معادن: فحم وحديد وذهب', `${cnt[B.COAL]}/${cnt[B.IRON]}/${cnt[B.GOLD]}/${cnt[B.DIAMOND] || 0}`);
ok(cnt[B.WATER] > 3000 && cnt[B.SAND] > 1000, 'مياه وشواطئ رمل', `${cnt[B.WATER]}/${cnt[B.SAND]}`);
ok(cnt[B.BEDROCK] === 400 * 256, 'صخر الأساس تحت كل شي');
// 3) الشجرة تكمل عبر حدود القطع (نفس العالم بغض النظر من أي قطعة نبدأ)
const w = new World(SEED); for (let cx = 20; cx <= 26; cx++) for (let cz = 10; cz <= 16; cz++) w.ensure(cx, cz);
let crossOK = true; for (let cx = 21; cx <= 25 && crossOK; cx++) for (let cz = 11; cz <= 15; cz++) { const alone = genChunk(cx, cz, SEED, false), ch = w.chunks.get(cx + ',' + cz).b; if (!alone.every((v, i) => v === ch[i])) { crossOK = false; break; } }
ok(crossOK, 'القطعة نفسها بغض النظر عن ترتيب التحميل (الأشجار عبر الحدود سليمة)');
// 4) الشبكة: كل وجه اتجاهه صح (التفاف)، وما فيه وجوه داخلية بين مكعبين صلبين
const m = meshChunk(w, 23, 13, tileUV); const o = m.o; let badWind = 0;
for (let t = 0; t < o.i.length; t += 3) { const [i0, i1, i2] = [o.i[t], o.i[t + 1], o.i[t + 2]], p = i => [o.p[i * 3], o.p[i * 3 + 1], o.p[i * 3 + 2]]; const A = p(i0), Bv = p(i1), Cv = p(i2); const u = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], v = [Cv[0] - A[0], Cv[1] - A[1], Cv[2] - A[2]]; const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const cx = (A[0] + Bv[0] + Cv[0]) / 3, cy = (A[1] + Bv[1] + Cv[1]) / 3, cz = (A[2] + Bv[2] + Cv[2]) / 3; const dir = n.map(x => Math.sign(Math.round(x * 100) / 100)); const out = [cx + dir[0] * .3, cy + dir[1] * .3, cz + dir[2] * .3]; const ib = V.isSolid(w.get(Math.floor(out[0]), Math.floor(out[1]), Math.floor(out[2]))) && !V.isTrans(w.get(Math.floor(out[0]), Math.floor(out[1]), Math.floor(out[2]))); if (ib) badWind++; }
ok(o.i.length > 300 && badWind === 0, 'الشبكة: وجوه كثيرة واتجاهها للخارج دائماً', `${o.i.length / 3} مثلث، ${badWind} معكوس`);
const flatW = new World(1, true); for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) flatW.ensure(cx, cz); const fm = meshChunk(flatW, 0, 0, tileUV);
ok(fm.o.i.length === 256 * 6, 'عالم البناء المسطح: سطح واحد فقط يتم رسمه (256 وجه علوي)', String(fm.o.i.length / 6));
// 5) الفيزياء (عالم مسطح: سطحه y=30)
const fw = new World(1, true); for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) fw.ensure(cx, cz);
const P = { x: 8.5, y: 36, z: 8.5, vx: 0, vy: 0, vz: 0, onGround: false };
for (let i = 0; i < 120; i++) stepPlayer(fw, P, 0, 0, false, .033);
ok(P.onGround && Math.abs(P.y - 31) < .01, 'اللاعب يسقط ويوقف فوق الأرض', P.y.toFixed(2));
const y0 = P.y; stepPlayer(fw, P, 0, 0, true, .033); for (let i = 0; i < 6; i++) stepPlayer(fw, P, 0, 0, false, .033); ok(P.y > y0 + .5, 'القفز يرفعه');
for (let i = 0; i < 60; i++) stepPlayer(fw, P, 0, 0, false, .033);
for (let k = -1; k <= 1; k++) for (let y = 31; y <= 33; y++) fw.set(12, y, 8 + k, B.STONE, false);
const Q = { x: 8.5, y: 31, z: 8.5, vx: 0, vy: 0, vz: 0, onGround: true }; for (let i = 0; i < 80; i++) stepPlayer(fw, Q, 1, 0, false, .033);
ok(Q.x < 11.75 && Q.x > 11, 'جدار ثلاثة مكعبات يوقفه (ما يعدّي)', Q.x.toFixed(2));
fw.set(-6, 31, 8, B.STONE, false); const R2 = { x: -9.5, y: 31, z: 8.5, vx: 0, vy: 0, vz: 0, onGround: true }; for (let i = 0; i < 50; i++) stepPlayer(fw, R2, 1, 0, false, .033);
ok(R2.x > -5, 'مكعب واحد قدّامه: يطلع عليه بدون ما يقفز', R2.x.toFixed(2) + ' y=' + R2.y.toFixed(2));
// 6) تحديد الهدف + تكسير + وضع + حفظ التعديلات
const ex = 40, ez = 40, top = 30; const tgt = raycast(fw, ex + .5, top + 4.5, ez + .5, 0, -1, 0, 8);
ok(tgt && tgt.y === top && tgt.ny === 1, 'الشعاع يلقط أعلى مكعب ويعرف وجهه', JSON.stringify(tgt && [tgt.x, tgt.y, tgt.z, tgt.ny]));
const side = raycast(fw, 0.5, 31.5, 8.5, 1, 0, 0, 20); ok(side && side.x === 12 && side.nx === -1, 'الشعاع الأفقي يلقط الجدار من جهته', JSON.stringify(side && [side.x, side.nx]));
ok(raycast(fw, 0.5, 40, 0.5, 0, 1, 0, 6) === null, 'ما فيه شي فوق: ما يلقط شي');
const fwk = fw;
const was = fw.get(ex, top, ez); fw.set(ex, top, ez, B.AIR); ok(fw.get(ex, top, ez) === B.AIR && fw.dirty.size > 0, 'التكسير يغيّر العالم ويعلّم القطعة للتحديث');
fw.set(ex, top, ez, B.PLANKS); const key = Math.floor(ex / CH) + ',' + Math.floor(ez / CH), edits = JSON.stringify([...fw.edits.get(key)]);
fw.unload(Math.floor(ex / CH), Math.floor(ez / CH)); const w2 = new World(1, true); w2.edits.set(key, new Map(JSON.parse(edits))); w2.ensure(Math.floor(ex / CH), Math.floor(ez / CH));
ok(w2.get(ex, top, ez) === B.PLANKS, 'التعديلات تنحفظ وترجع بعد إعادة التوليد (عالم دائم)'); ok(was === B.GRASS, 'قبل التعديل كان عشب', String(was));
ok(edits.length < 100, 'حجم التعديل صغير جداً (أرقام فقط)', edits.length + ' حرف');
// 7) المخزون والأدوات والتصنيع والصهر (قواعد عالم البناء)
const { I, breakInfo, blockDrops, invAdd, invCount, invTake, newInv, invFlat, invFrom, RECIPES, canCraft, doCraft, toolId, furnaceTick, SMELT, FUEL } = V;
const inv = newInv(); ok(invAdd(inv, B.LOG, 70) === 0 && inv[0].n === 64 && inv[1].n === 6, 'الشنطة: الكومة 64 والباقي بخانة ثانية');
ok(V.stackMax(toolId(0, 0)) === 1 && invAdd(newInv(), toolId(0, 0), 3) === 0, 'الأدوات ما تتكدّس');
const bare = breakInfo(B.LOG, 0), axe = breakInfo(B.LOG, toolId(1, 2)); ok(Math.abs(bare.t - 3) < .01 && Math.abs(axe.t - 3 / 6) < .01 && axe.tool, 'الشجرة: 3 ثواني باليد، و0.5 بفأس حديد', bare.t + ' / ' + axe.t.toFixed(2));
ok(breakInfo(B.STONE, 0).t > 7 && breakInfo(B.STONE, toolId(0, 0)).t < 1.5 && !breakInfo(B.STONE, 0).ok, 'الحجر باليد بطيء ما يعطي شي، وبمعول خشب سريع');
ok(!breakInfo(B.IRON, toolId(0, 0)).ok && breakInfo(B.IRON, toolId(0, 1)).ok && !breakInfo(B.DIAMOND, toolId(0, 1)).ok && breakInfo(B.DIAMOND, toolId(0, 2)).ok, 'مستويات الأدوات: حديد يحتاج حجر، وألماس يحتاج حديد');
ok(blockDrops(B.STONE, false).length === 0 && blockDrops(B.STONE, true)[0][0] === B.COBBLE && blockDrops(B.GRASS, true)[0][0] === B.DIRT && blockDrops(B.COAL, true)[0][0] === I.COAL && blockDrops(B.GLASS, true).length === 0, 'اللي ينكسر يعطي الغرض الصح (حجر مكسّر، فحم، تراب...)');
let apples = 0, sticks = 0; for (let k = 0; k < 4000; k++) { const d = blockDrops(B.LEAVES, true); if (d[0] && d[0][0] === I.APPLE) apples++; if (d[0] && d[0][0] === I.STICK) sticks++; } ok(apples > 5 && apples < 60 && sticks > 40, 'الأوراق تعطي أحياناً تفاحة وعصا', apples + '/' + sticks);
const bag = newInv(); invAdd(bag, B.LOG, 3); const rec = n => RECIPES.find(r => r.out === n);
ok(doCraft(bag, rec(B.PLANKS)) && invCount(bag, B.PLANKS) === 4 && invCount(bag, B.LOG) === 2, 'تصنيع: خشب ← 4 ألواح');
doCraft(bag, rec(B.PLANKS)); ok(doCraft(bag, rec(I.STICK)) && invCount(bag, I.STICK) === 4 && invCount(bag, B.PLANKS) === 6, 'تصنيع: لوحين ← 4 عصي');
ok(doCraft(bag, rec(B.CRAFTING)) && invCount(bag, B.CRAFTING) === 1, 'تصنيع: 4 ألواح ← طاولة تصنيع');
const pk = rec(toolId(0, 0)); ok(!canCraft(bag, pk, false) && invCount(bag, B.PLANKS) === 2, 'معول خشب يحتاج طاولة قريبة (ولا ينصنع بدونها)');
invAdd(bag, B.PLANKS, 5); ok(doCraft(bag, pk, true) && invCount(bag, toolId(0, 0)) === 1 && invCount(bag, B.PLANKS) === 4, 'تصنيع معول خشب (3 ألواح + عصاتين) عند الطاولة');
ok(!doCraft(newInv(), rec(B.PLANKS)), 'ما تقدر تصنّع بدون مواد'); const full = newInv(); for (let i = 0; i < 36; i++) full[i] = { id: B.DIRT, n: 64, d: 0 }; full[5] = { id: B.LOG, n: 2, d: 0 }; ok(!doCraft(full, rec(B.PLANKS)) && invCount(full, B.LOG) === 2, 'الشنطة ممتلئة: التصنيع يتوقف وما تضيع المواد');
const rt = invFrom(invFlat(bag)); ok(JSON.stringify(rt) === JSON.stringify(bag), 'الشنطة تنحفظ كأرقام وترجع نفسها', invFlat(bag).length + ' رقم');
ok(!invFrom([0, 9999, 5, 0])[0] && !invFrom([0, 3, 0, 0])[0], 'أرقام غلط ما تدخل الشنطة');
const f = { i: { id: B.IRON, n: 2, d: 0 }, fu: { id: I.COAL, n: 1, d: 0 }, o: null, burn: 0, prog: 0 }; for (let k = 0; k < 220; k++) furnaceTick(f, .1);
ok(f.o && f.o.id === I.IRON_INGOT && f.o.n === 2 && !f.i && !f.fu, 'الفرن: يصهر خام الحديد بالفحم (20 ثانية لغرضين)', JSON.stringify(f.o));
const f2 = { i: { id: B.SAND, n: 1, d: 0 }, fu: null, o: null, burn: 0, prog: 0 }; for (let k = 0; k < 150; k++) furnaceTick(f2, .1); ok(!f2.o, 'الفرن بدون وقود ما يشتغل');
ok(SMELT[B.COBBLE] === B.STONE && SMELT[B.LOG] === I.CHARCOAL && FUEL[I.COAL] === 8, 'جداول الصهر والوقود مثل عالم البناء');
ok(!V.breakable(B.BEDROCK) && !V.breakable(B.WATER) && V.breakable(B.STONE), 'صخر الأساس والماء ما ينكسرون');
ok(V.weaponDamage(0) === 1 && V.weaponDamage(toolId(4, 4)) === 7 && V.weaponDamage(toolId(4, 0)) === 4 && V.weaponDamage(toolId(0, 2)) === 4 && !!RECIPES.find(r => r.out === toolId(4, 1)), 'الأسلحة: سيف الألماس 7 (3.5 قلب)، يد فاضية 1، والسيوف لها وصفات');
// حدود المنطقة: برّا الحدّ هواء، وما يتعدّل
const bw = new World(SEED); bw.ensure(-1, 0); bw.ensure(0, 0); ok(bw.get(-3, 20, 5) === B.AIR && bw.get(3, 0, 5) === B.BEDROCK && !bw.set(-2, 31, 5, B.STONE) && bw.get(8, 5, 8) !== B.AIR, 'عالم البناء يبدأ عند الحدّ: غرب الحدّ هواء وما ينبني');
// 7ب) الحدّ مع المدينة مسطّح ويابسة، وبعده تضاريس كاملة
let flatOK = true, lo = 99, hi = 0; for (let bx = 0; bx <= 25; bx += 5) for (let bz = -150; bz <= 150; bz += 25) { const h = heightAt(bx, bz, SEED); lo = Math.min(lo, h); hi = Math.max(hi, h); if (h < SEA + 3) flatOK = false; }
ok(flatOK && hi - lo <= 4, 'عند حدّ المدينة: الأرض يابسة ومسطحة تقريباً (مثل المدينة)', lo + '..' + hi);
let lo2 = 99, hi2 = 0; for (let k = 0; k < 400; k++) { const h = heightAt(500 + k * 13, 100 + k * 7, SEED); lo2 = Math.min(lo2, h); hi2 = Math.max(hi2, h); } ok(hi2 - lo2 > 15, 'بعيد عن الحدّ: تضاريس كاملة (تلال ووديان)', lo2 + '..' + hi2);
ok(V.inDomain(0, 0) && V.inDomain(500, -200) && !V.inDomain(-1, 0) && !V.inDomain(10, -201) && !V.inDomain(30, 300) && V.inDomain(80, 300), 'حدود المنطقة: شرق البحيرة، بدون زاوية قصور المشتركين');
// 8) السطح: عدد ارتفاعات متنوعة (مو مسطح)
const hs = new Set(); for (let i = 0; i < 400; i++) hs.add(heightAt(i * 7, i * 3, SEED)); ok(hs.size > 15, 'تضاريس متنوعة (تلال ووديان)', String(hs.size));
// 9) بيئات وحمم ومشاعل وإضاءة (الكهوف مظلمة، المشعل ينوّر)
let cactus = 0, desertSand = 0; for (let cx = 0; cx < 60 && cactus < 5; cx++) for (let cz = 0; cz < 60 && cactus < 5; cz++) if (V.biomeAt(cx * 16 + 8, cz * 16 + 8 + 100) === 1) { const ch = genChunk(cx, cz + 6, SEED, false); for (let q = 0; q < ch.length; q++) if (ch[q] === B.CACTUS) cactus++; }
ok(cnt[B.SNOW] > 2000 && cactus >= 5 && cnt[B.LAVA] > 200, 'بيئات: ثلج وصحراء بصبار، وحمم بالأعماق', (cnt[B.SNOW] || 0) + '/' + cactus + '/' + (cnt[B.LAVA] || 0));
ok(V.biomeAt(0, 0) >= 0 && new Set(Array.from({ length: 60 }, (_, k) => V.biomeAt(k * 90, k * 40))).size === 3, 'ثلاث بيئات (عادي/صحراء/ثلج) بالعالم');
const lw2 = new World(1, true); for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) lw2.ensure(a, b);
lw2.set(17, 29, 30, B.AIR, false); lw2.set(24, 31, 20, B.TORCH, false); ok(lw2.lights.size === 1 && V.LIGHT_SRC[B.TORCH] === 14, 'المشعل مصدر إضاءة مسجّل');
let mm = meshChunk(lw2, 1, 1, tileUV), cc = mm.o.c, anyBlock = false, anySky = false, anyDark = false; for (let q = 0; q < cc.length; q += 3) { if (cc[q + 1] > .5) anyBlock = true; if (cc[q] === 1) anySky = true; if (cc[q] === 0 && cc[q + 1] === 0) anyDark = true; }
ok(anyBlock && anySky && anyDark, 'الإضاءة: سطح مضاء بالسماء، وجوف الحفرة مظلم، وقرب المشعل مضاء', [anyBlock, anySky, anyDark].join('/'));
lw2.set(24, 31, 20, B.AIR, false); ok(lw2.lights.size === 0, 'شيل المشعل: الإضاءة تنمسح');
ok(!!RECIPES.find(r => r.out === B.TORCH && !r.table), 'وصفة المشعل (فحم + عصا ← 4 مشاعل) بدون طاولة');
// 10) جبال وأخاديد، وصحراء بعيدة عن البداية، ومحاصيل ودلاء وسوائل وأشجار
let peak = 0, nearDesert = 0, farDesert = 0; for (let k = 0; k < 3000; k++) { const bx = 200 + k * 9, bz = -150 + (k * 37) % 900; peak = Math.max(peak, heightAt(bx, bz, SEED)); }
for (let bx = 0; bx < 260; bx += 13) for (let bz = -190; bz < 400; bz += 17) if (V.biomeAt(bx, bz) !== 0) nearDesert++; for (let k = 0; k < 400; k++) if (V.biomeAt(400 + k * 11, 100 + k * 7) !== 0) farDesert++;
ok(peak >= 50, 'جبال عالية (قمم 50+)', String(peak)); ok(nearDesert === 0 && farDesert > 20, 'ما فيه صحراء/ثلج قرب البداية (أول 260م)، وتظهر بعيد', nearDesert + '/' + farDesert);
let ravine = 0; for (let cx = 28; cx < 60 && ravine < 3; cx++) for (let cz = 8; cz < 40 && ravine < 3; cz++) { const ch = genChunk(cx, cz, SEED, false); for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) if (ch[(20 * 16 + lz) * 16 + lx] === B.AIR && ch[(60 * 16 + lz) * 16 + lx] === B.AIR && ch[(17 * 16 + lz) * 16 + lx] === B.AIR) { ravine++; break; } }
ok(ravine >= 1, 'أخاديد عميقة مفتوحة للسماء', String(ravine));
let seeds = 0, saplings = 0; for (let k = 0; k < 4000; k++) { if (V.blockDrops(B.GRASS, true).some(d => d[0] === I.SEEDS)) seeds++; if (V.blockDrops(B.LEAVES, true).some(d => d[0] === B.SAPLING)) saplings++; } ok(seeds > 300 && seeds < 700 && saplings > 80, 'البذور من العشب والشتلات من الأوراق', seeds + '/' + saplings);
ok(V.blockDrops(B.WHEAT7, true).some(d => d[0] === I.WHEAT) && !V.blockDrops(B.WHEAT0 + 3, true).some(d => d[0] === I.WHEAT) && V.isCrop(B.WHEAT0 + 2) && V.BLOCKS[B.SAPLING].cross && !V.isSolid(B.WHEAT7), 'القمح الناضج يعطي قمح، والصغير بذور فقط، والنباتات تمشي خلالها');
const bk = newInv(); invAdd(bk, I.IRON_INGOT, 3); ok(doCraft(bk, RECIPES.find(r => r.out === I.BUCKET), true) && invCount(bk, I.BUCKET) === 1 && V.stackMax(I.BUCKET) === 1, 'دلو: 3 سبائك حديد'); const bd = newInv(); invAdd(bd, I.WHEAT, 3); ok(doCraft(bd, RECIPES.find(r => r.out === I.BREAD), true) && invCount(bd, I.BREAD) === 1, 'خبز: 3 قمح');
ok(!V.breakInfo(B.OBSIDIAN, toolId(0, 2)).ok && V.breakInfo(B.OBSIDIAN, toolId(0, 4)).ok && V.breakInfo(B.OBSIDIAN, toolId(0, 4)).t > 8, 'السبج يحتاج معول ألماس وبطيء');
const lq = new World(1, true); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) lq.ensure(a, b);
ok(V.raycast(lq, 5.5, 40, 5.5, 0, -1, 0, 20).y === 30, 'الشعاع العادي يعدّي الماء'); lq.set(5, 31, 5, B.WATER, false); ok(V.raycast(lq, 5.5, 40, 5.5, 0, -1, 0, 20).y === 30 && V.raycast(lq, 5.5, 40, 5.5, 0, -1, 0, 20, true).y === 31, 'الدلو الفاضي يلقط الماء (شعاع السوائل)');
const sp = V.spreadLiquid(lq, 8, 31, 8, B.WATER); ok(sp.length >= 10 && sp.length <= 40 && sp.every(c => c[1] === 31), 'الماء ينسكب وينتشر فوق الأرض (حتى 3 مربعات)', String(sp.length));
lq.set(10, 31, 10, B.AIR, false); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) lq.set(10 + dx, 31, 10 + dz, B.STONE, false); lq.set(10, 30, 10, B.AIR, false); lq.set(10, 29, 10, B.AIR, false); const pit = V.spreadLiquid(lq, 10, 31, 10, B.WATER); ok(pit.length >= 2 && pit.some(c => c[1] === 29 || c[1] === 30), 'الماء ينزل بالحفرة لتحت', String(pit.length));
lq.set(20, 31, 20, B.LAVA, false); const oc = V.liquidContact(lq, 21, 31, 20, B.WATER); ok(oc.length === 1 && oc[0][3] === B.OBSIDIAN && oc[0][0] === 20, 'ماء جنب حمم ← سبج'); lq.set(30, 31, 30, B.WATER, false); const oc2 = V.liquidContact(lq, 31, 31, 30, B.LAVA); ok(oc2.length === 1 && oc2[0][3] === B.OBSIDIAN && oc2[0][0] === 31, 'حمم جنب ماء ← سبج');
const tc = V.treeCells(lq, -10, 31, -10, () => .3); ok(tc.filter(c => c[3] === B.LOG).length >= 4 && tc.filter(c => c[3] === B.LEAVES).length >= 15, 'الشتلة تكبر شجرة (جذع وأوراق)', tc.length + ' مكعب');
console.log(`\n${pass} PASS / ${fail} FAIL`); process.exit(fail ? 1 : 0);
