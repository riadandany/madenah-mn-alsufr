// ================= محرك عالم المكعّبات (عالم البناء) — منطق صافي بدون متصفح ولا مكتبات =================
// عالم لا متناهي بالأفقي (قطع 16×16، ارتفاع 64) يتولّد من رقم بذرة ثابت، ويتحمّل تعديلاتك (تكسير/وضع) فوقه.
export const CH = 16, H = 64, SEA = 22;
export const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7, COBBLE: 8, COAL: 9, IRON: 10, GOLD: 11, DIAMOND: 12, WATER: 13, GLASS: 14, BRICK: 15, BEDROCK: 16, WOOL_W: 17, WOOL_R: 18, WOOL_B: 19, WOOL_Y: 20, WOOL_G: 21, WOOL_K: 22, LAMP: 23, CRAFTING: 24, FURNACE: 25, CHEST: 26, TORCH: 27, SNOW: 28, CACTUS: 29, LAVA: 30, OBSIDIAN: 31, FARMLAND: 32, WHEAT0: 33, WHEAT7: 40, SAPLING: 41 };
// بلاطات الصورة المجمّعة (atlas 8×8)
export const T = { GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7, PLANKS: 8, COBBLE: 9, COAL: 10, IRON: 11, GOLD: 12, DIAMOND: 13, WATER: 14, GLASS: 15, BRICK: 16, BEDROCK: 17, WOOL_W: 18, WOOL_R: 19, WOOL_B: 20, WOOL_Y: 21, WOOL_G: 22, WOOL_K: 23, LAMP: 24, CRAFT_TOP: 25, CRAFT_SIDE: 26, FURNACE_TOP: 27, FURNACE_SIDE: 28, CHEST_TOP: 29, CHEST_SIDE: 30, SNOW_TOP: 31, SNOW_SIDE: 32, CACTUS_TOP: 33, CACTUS_SIDE: 34, TORCH: 35, LAVA: 36, OBSIDIAN: 37, FARM_TOP: 38, SAPLING: 39, WHEAT0: 40 };   // محاصيل القمح: 8 مراحل (40..47)
// [الاسم، بلاط فوق، بلاط جنب، بلاط تحت، زمن التكسير (ث)، صلب؟، شفاف؟]
const D = [];
const def = (id, n, top, side, bot, hard, solid = true, trans = false) => { D[id] = { n, top, side, bot, hard, solid, trans }; };
def(0, 'هواء', 0, 0, 0, 0, false, true);
def(B.GRASS, 'عشب', T.GRASS_TOP, T.GRASS_SIDE, T.DIRT, .5); def(B.DIRT, 'تراب', T.DIRT, T.DIRT, T.DIRT, .45); def(B.STONE, 'حجر', T.STONE, T.STONE, T.STONE, 1.3);
def(B.SAND, 'رمل', T.SAND, T.SAND, T.SAND, .35); def(B.LOG, 'خشب', T.LOG_TOP, T.LOG_SIDE, T.LOG_TOP, 1); def(B.LEAVES, 'أوراق', T.LEAVES, T.LEAVES, T.LEAVES, .15, true, true);
def(B.PLANKS, 'ألواح خشب', T.PLANKS, T.PLANKS, T.PLANKS, .7); def(B.COBBLE, 'حجر مكسّر', T.COBBLE, T.COBBLE, T.COBBLE, 1.5);
def(B.COAL, 'فحم', T.COAL, T.COAL, T.COAL, 1.8); def(B.IRON, 'حديد', T.IRON, T.IRON, T.IRON, 2.2); def(B.GOLD, 'ذهب', T.GOLD, T.GOLD, T.GOLD, 2.4); def(B.DIAMOND, 'ألماس', T.DIAMOND, T.DIAMOND, T.DIAMOND, 3);
def(B.WATER, 'ماء', T.WATER, T.WATER, T.WATER, 0, false, true); def(B.GLASS, 'زجاج', T.GLASS, T.GLASS, T.GLASS, .3, true, true); def(B.BRICK, 'طوب', T.BRICK, T.BRICK, T.BRICK, 1.2);
def(B.BEDROCK, 'صخر أساس', T.BEDROCK, T.BEDROCK, T.BEDROCK, 0);
def(B.WOOL_W, 'صوف أبيض', T.WOOL_W, T.WOOL_W, T.WOOL_W, .35); def(B.WOOL_R, 'صوف أحمر', T.WOOL_R, T.WOOL_R, T.WOOL_R, .35); def(B.WOOL_B, 'صوف أزرق', T.WOOL_B, T.WOOL_B, T.WOOL_B, .35);
def(B.WOOL_Y, 'صوف أصفر', T.WOOL_Y, T.WOOL_Y, T.WOOL_Y, .35); def(B.WOOL_G, 'صوف أخضر', T.WOOL_G, T.WOOL_G, T.WOOL_G, .35); def(B.WOOL_K, 'صوف أسود', T.WOOL_K, T.WOOL_K, T.WOOL_K, .35);
def(B.LAMP, 'مصباح', T.LAMP, T.LAMP, T.LAMP, .4);
def(B.CRAFTING, 'طاولة تصنيع', T.CRAFT_TOP, T.CRAFT_SIDE, T.PLANKS, 2.5); def(B.FURNACE, 'فرن', T.FURNACE_TOP, T.FURNACE_SIDE, T.FURNACE_TOP, 3.5); def(B.CHEST, 'صندوق', T.CHEST_TOP, T.CHEST_SIDE, T.CHEST_TOP, 2.5);
def(B.OBSIDIAN, 'سبج', T.OBSIDIAN, T.OBSIDIAN, T.OBSIDIAN, 50); def(B.FARMLAND, 'أرض زراعة', T.FARM_TOP, T.DIRT, T.DIRT, .6); def(B.SAPLING, 'شتلة', T.SAPLING, T.SAPLING, T.SAPLING, 0, false, true);
for (let k = 0; k < 8; k++) def(B.WHEAT0 + k, 'قمح', T.WHEAT0 + k, T.WHEAT0 + k, T.WHEAT0 + k, 0, false, true);
def(B.TORCH, 'مشعل', T.TORCH, T.TORCH, T.TORCH, 0, false, true); def(B.SNOW, 'ثلج', T.SNOW_TOP, T.SNOW_SIDE, T.DIRT, .2); def(B.CACTUS, 'صبار', T.CACTUS_TOP, T.CACTUS_SIDE, T.CACTUS_TOP, .4); def(B.LAVA, 'حمم', T.LAVA, T.LAVA, T.LAVA, 0, false, true);
// صلابة عالم البناء الحقيقية (ثواني باليد ×1.5) + الأداة المناسبة + مستوى الأداة اللازم عشان يعطي غرضه
const HARD = { [B.GRASS]: .6, [B.DIRT]: .5, [B.STONE]: 1.5, [B.SAND]: .5, [B.LOG]: 2, [B.LEAVES]: .2, [B.PLANKS]: 2, [B.COBBLE]: 2, [B.COAL]: 3, [B.IRON]: 3, [B.GOLD]: 3, [B.DIAMOND]: 3, [B.GLASS]: .3, [B.BRICK]: 2, [B.WOOL_W]: .8, [B.WOOL_R]: .8, [B.WOOL_B]: .8, [B.WOOL_Y]: .8, [B.WOOL_G]: .8, [B.WOOL_K]: .8, [B.LAMP]: .3, [B.CRAFTING]: 2.5, [B.FURNACE]: 3.5, [B.CHEST]: 2.5, [B.SNOW]: .2, [B.CACTUS]: .4 };
const TOOL = { pickaxe: [B.STONE, B.COBBLE, B.COAL, B.IRON, B.GOLD, B.DIAMOND, B.BRICK, B.FURNACE], axe: [B.LOG, B.PLANKS, B.CRAFTING, B.CHEST], shovel: [B.GRASS, B.DIRT, B.SAND, B.SNOW] };
const LVL = { [B.STONE]: 1, [B.COBBLE]: 1, [B.COAL]: 1, [B.BRICK]: 1, [B.FURNACE]: 1, [B.IRON]: 2, [B.GOLD]: 3, [B.DIAMOND]: 3 };   // أقل مستوى أداة (خشب=1 حجر=2 حديد=3 ألماس=4، الذهب=1)
for (const id in HARD) D[id].hard = HARD[id];
for (const k in TOOL) for (const id of TOOL[k]) D[id].tool = k;
for (const id in LVL) D[id].lvl = LVL[id];
for (const id of [B.SAPLING, ...Array.from({ length: 8 }, (_, k) => B.WHEAT0 + k)]) D[id].cross = true;   // نباتات بشكل X
D[B.OBSIDIAN].lvl = 4; D[B.OBSIDIAN].tool = 'pickaxe'; D[B.FARMLAND].tool = 'shovel';
export const BLOCKS = D;
export const isSolid = id => id > 0 && D[id] && D[id].solid;
export const isTrans = id => id === 0 || (D[id] && D[id].trans);
export const breakable = id => id !== B.AIR && id !== B.BEDROCK && id !== B.WATER && id !== B.LAVA;
export const isLiquid = id => id === B.WATER || id === B.LAVA;
export const LIGHT_SRC = { [B.TORCH]: 14, [B.LAMP]: 15, [B.LAVA]: 15 };   // مستوى الإضاءة (0..15)
export const dropOf = id => id === B.GRASS ? B.DIRT : id === B.STONE ? B.COBBLE : id;   // العشب يعطي تراب، والحجر يعطي حجر مكسّر
// بالبناء (إبداعي): كل المكعبات متاحة
export const PALETTE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.LOG, B.LEAVES, B.PLANKS, B.GLASS, B.BRICK, B.WOOL_W, B.WOOL_R, B.WOOL_B, B.WOOL_Y, B.WOOL_G, B.WOOL_K, B.LAMP, B.CRAFTING, B.FURNACE, B.CHEST, B.TORCH, B.SNOW, B.CACTUS, B.COAL, B.IRON, B.GOLD, B.DIAMOND];
// ---------- ضجيج حتمي (نفس البذرة = نفس العالم عند كل اللاعبين) ----------
const hs = (x, y, z, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const sm = t => t * t * (3 - 2 * t);
export function noise2(x, z, s) { const xi = Math.floor(x), zi = Math.floor(z), u = sm(x - xi), v = sm(z - zi), a = hs(xi, 0, zi, s), b = hs(xi + 1, 0, zi, s), c = hs(xi, 0, zi + 1, s), d = hs(xi + 1, 0, zi + 1, s); const t1 = a + (b - a) * u, t2 = c + (d - c) * u; return t1 + (t2 - t1) * v; }
export function noise3(x, y, z, s) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi); const g = (i, j, k) => hs(xi + i, yi + j, zi + k, s); const l = (a, b, t) => a + (b - a) * t; return l(l(l(g(0, 0, 0), g(1, 0, 0), u), l(g(0, 1, 0), g(1, 1, 0), u), v), l(l(g(0, 0, 1), g(1, 0, 1), u), l(g(0, 1, 1), g(1, 1, 1), u), v), w); }
export const fbm2 = (x, z, s, o = 3) => { let a = .5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += noise2(x * f, z * f, s + i * 17) * a; n += a; a *= .5; f *= 2; } return t / n; };
// ===== حدّ عالم البناء داخل المدينة: bx = x - (مركز الساحة + 144)، bz = z - مركز الساحة. المنطقة: bx ≥ 0 و bz ≥ -200 (بدون زاوية قصور المشتركين) =====
export const BASE_Y = 30, NORTH_BZ = -200, VIP_BX = 71, VIP_BZ = 205;
export const inDomain = (bx, bz) => bx >= 0 && bz >= NORTH_BZ && !(bx <= VIP_BX && bz >= VIP_BZ);
// 🧱 سور الحدود: عمودين صخر أساس (ما ينكسر) لأعلى العالم، على حد المدينة (z) وحول زاوية مدينة المشتركين — بدل ما تختفي الأرض وتطيح
export const isWall = (bx, bz) => bx >= 0 && ((bz === NORTH_BZ || bz === NORTH_BZ + 1) || ((bz === VIP_BZ - 1 || bz === VIP_BZ - 2) && bx <= VIP_BX + 2) || ((bx === VIP_BX + 1 || bx === VIP_BX + 2) && bz >= VIP_BZ - 2));
export const borderDist = (bx, bz) => Math.min(bx, bz - NORTH_BZ, Math.hypot(Math.max(0, bx - VIP_BX), Math.max(0, VIP_BZ - bz)));
export const blendAt = (bx, bz) => { const t = Math.max(0, Math.min(1, borderDist(bx, bz) / 170)); return t * t * (3 - 2 * t); };   // 0 عند الحدّ (أرض مسطحة مثل المدينة) ← 1 بعد 170م (تضاريس كاملة)
export function heightAt(x, z, seed) { const c = fbm2(x / 130, z / 130, seed, 3), m = fbm2(x / 34, z / 34, seed + 7, 3), raw = 31 + (c - .5) * 58 + (m - .5) * 12 + Math.max(0, fbm2(x / 220 + 11.7, z / 220 - 5.3, seed + 55, 3) - .58) * 150, f = blendAt(x, z); return Math.max(5, Math.min(H - 10, Math.floor(BASE_Y + (raw - BASE_Y) * f + .5))); }
const idx = (x, y, z) => (y * CH + z) * CH + x;

// ---------- توليد قطعة ----------
// بيئة العمود: 0 عادي، 1 صحراء، 2 ثلج (حسب الحرارة)
export function biomeAt(x, z) { if (borderDist(x, z) < 260) return 0; const t = fbm2(x / 230 + 7.3, z / 230 - 3.1, 8101, 2); return t > .62 ? 1 : t < .36 ? 2 : 0; }
export function genChunk(cx, cz, seed, flat) {
  const b = new Uint8Array(CH * CH * H);
  if (flat) { for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) { b[idx(x, 0, z)] = B.BEDROCK; for (let y = 1; y <= 27; y++) b[idx(x, y, z)] = B.STONE; b[idx(x, 28, z)] = B.DIRT; b[idx(x, 29, z)] = B.DIRT; b[idx(x, 30, z)] = B.GRASS; } return b; }
  const hmap = new Int16Array((CH + 6) * (CH + 6)), hm = (lx, lz) => hmap[(lz + 3) * (CH + 6) + (lx + 3)];
  for (let lz = -3; lz < CH + 3; lz++) for (let lx = -3; lx < CH + 3; lx++) hmap[(lz + 3) * (CH + 6) + (lx + 3)] = heightAt(cx * CH + lx, cz * CH + lz, seed);
  for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const wx = cx * CH + lx, wz = cz * CH + lz, h = hm(lx, lz), beach = h <= SEA + 1;
    if (!inDomain(wx, wz)) continue;   // برّا حدود عالم البناء: هواء (المدينة)
    const bio = biomeAt(wx, wz), desert = bio === 1 && !beach, snow = bio === 2 && !beach;
    b[idx(lx, 0, lz)] = B.BEDROCK;
    for (let y = 1; y <= h; y++) {
      let id;
      if (y === h) id = beach || desert ? B.SAND : h >= 51 ? B.SNOW : h > 47 ? B.STONE : snow ? B.SNOW : B.GRASS; else if (y >= h - 3) id = beach || desert ? B.SAND : h > 47 ? B.STONE : B.DIRT;
      else {
        id = B.STONE; const r = hs(wx, y, wz, seed + 5);
        if (y < h - 4) { if (r < .011) id = B.COAL; else if (y < 40 && r < .0175) id = B.IRON; else if (y < 18 && r < .0205) id = B.GOLD; else if (y < 12 && r < .022) id = B.DIAMOND; }
        if (y > 3 && y < h - 4 && (noise3(wx / 11, y / 8, wz / 11, seed + 21) > .665 || (Math.abs(noise3(wx / 24, y / 14, wz / 24, seed + 41) - .5) < .035 && Math.abs(noise3(wx / 24, y / 14, wz / 24, seed + 43) - .5) < .05))) id = y <= 9 ? B.LAVA : B.AIR;   // مغارات وأنفاق (وحمم بالأعماق)
      }
      b[idx(lx, y, lz)] = id;
    }
    for (let y = h + 1; y <= SEA; y++) b[idx(lx, y, lz)] = B.WATER;
    if (h > SEA + 4 && blendAt(wx, wz) > .6 && Math.abs(noise2(wx / 70 + 3.3, wz / 70 - 8.1, seed + 61) - .5) < .016) for (let y = 16; y <= h; y++) b[idx(lx, y, lz)] = B.AIR;   // أخدود
  }
  // أشجار (غابات): تُحسب لأعمدة أوسع من القطعة عشان الشجرة تكمل عبر الحدود
  for (let lz = -2; lz < CH + 2; lz++) for (let lx = -2; lx < CH + 2; lx++) {
    const wx = cx * CH + lx, wz = cz * CH + lz, h = hm(lx, lz); if (!inDomain(wx, wz) || h <= SEA + 1 || h > 44 || blendAt(wx, wz) < .3 || Math.abs(noise2(wx / 70 + 3.3, wz / 70 - 8.1, seed + 61) - .5) < .02) continue;
    const bt = biomeAt(wx, wz); if (bt === 1) continue; const forest = fbm2(wx / 60, wz / 60, seed + 31, 2), p = bt === 2 ? .01 : forest > .5 ? .05 : .006; if (hs(wx, 1, wz, seed + 9) >= p) continue;
    const th = 4 + Math.floor(hs(wx, 2, wz, seed + 9) * 3), top = h + th;
    const put = (x, y, z, id) => { if (x < 0 || x >= CH || z < 0 || z >= CH || y < 0 || y >= H) return; const i = idx(x, y, z); if (b[i] === B.AIR || (id === B.LOG && b[i] === B.LEAVES)) b[i] = id; };
    for (let y = h + 1; y <= top; y++) put(lx, y, lz, B.LOG);   // (جذع)
    for (let dy = -1; dy <= 2; dy++) { const r = dy >= 1 ? 1 : 2; for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hs(wx + dx, dy, wz + dz, seed + 3) < .5) continue; if (dx === 0 && dz === 0 && dy <= 0) continue; put(lx + dx, top + dy, lz + dz, B.LEAVES); } }
  }
  // صبار بالصحراء
  for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const wx = cx * CH + lx, wz = cz * CH + lz, h = hm(lx, lz); if (!inDomain(wx, wz) || h <= SEA + 1 || biomeAt(wx, wz) !== 1 || hs(wx, 7, wz, seed + 13) >= .012) continue;
    const n = 2 + Math.floor(hs(wx, 8, wz, seed + 13) * 3); for (let y = h + 1; y <= h + n && y < H; y++) if (b[idx(lx, y, lz)] === B.AIR) b[idx(lx, y, lz)] = B.CACTUS;
  }
  for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) { const wx = cx * CH + lx, wz = cz * CH + lz; if (inDomain(wx, wz) && isWall(wx, wz)) for (let y = 1; y < H; y++) b[idx(lx, y, lz)] = B.BEDROCK; }   // 🧱 السور
  return b;
}

// ---------- العالم ----------
export class World {
  constructor(seed, flat = false) { this.seed = seed; this.flat = flat; this.bounded = !flat; this.lights = new Map(); this.chunks = new Map(); this.edits = new Map(); this.dirty = new Set(); this.onEdit = null; }
  key(cx, cz) { return cx + ',' + cz; }
  has(cx, cz) { return this.chunks.has(this.key(cx, cz)); }
  ensure(cx, cz) {
    const k = this.key(cx, cz); let c = this.chunks.get(k); if (c) return c;
    c = { cx, cz, b: genChunk(cx, cz, this.seed, this.flat) }; const ed = this.edits.get(k); if (ed) for (const [i, id] of ed) c.b[i] = id;
    this.chunks.set(k, c); this.scanLights(c); return c;
  }
  scanLights(c) { const a = []; for (let i = 0; i < c.b.length; i++) { const l = LIGHT_SRC[c.b[i]]; if (l) a.push([c.cx * CH + (i % CH), Math.floor(i / (CH * CH)), c.cz * CH + Math.floor(i / CH) % CH, l]); } if (a.length) this.lights.set(this.key(c.cx, c.cz), a); else this.lights.delete(this.key(c.cx, c.cz)); }
  unload(cx, cz) { this.chunks.delete(this.key(cx, cz)); this.lights.delete(this.key(cx, cz)); }
  lightsNear(cx, cz) { const out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.lights.get((cx + a) + ',' + (cz + b)); if (l) for (const q of l) out.push(q); } return out; }
  get(x, y, z) {
    if (y < 0) return this.bounded && !inDomain(x, z) ? B.AIR : B.BEDROCK; if (y >= H) return B.AIR; if (this.bounded && !inDomain(x, z)) return B.AIR;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH), c = this.chunks.get(cx + ',' + cz); if (!c) return B.STONE;   // قطعة ما تحمّلت: نعتبرها صلبة (ما نسقط بالفراغ)
    return c.b[idx(x - cx * CH, y, z - cz * CH)];
  }
  loaded(x, z) { return this.chunks.has(Math.floor(x / CH) + ',' + Math.floor(z / CH)); }
  set(x, y, z, id, record = true) {
    if (y < 0 || y >= H || (this.bounded && !inDomain(x, z))) return false; const cx = Math.floor(x / CH), cz = Math.floor(z / CH), c = this.chunks.get(cx + ',' + cz); if (!c) return false;
    const lx = x - cx * CH, lz = z - cz * CH, i = idx(lx, y, lz); const was = c.b[i]; if (was === id) return false; c.b[i] = id; if (LIGHT_SRC[was] || LIGHT_SRC[id]) { const k2 = cx + ',' + cz; const arr = (this.lights.get(k2) || []).filter(q => !(q[0] === x && q[1] === y && q[2] === z)); if (LIGHT_SRC[id]) arr.push([x, y, z, LIGHT_SRC[id]]); if (arr.length) this.lights.set(k2, arr); else this.lights.delete(k2); for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) this.dirty.add((cx + a) + ',' + (cz + b2)); }
    this.dirty.add(cx + ',' + cz); if (lx === 0) this.dirty.add((cx - 1) + ',' + cz); if (lx === CH - 1) this.dirty.add((cx + 1) + ',' + cz); if (lz === 0) this.dirty.add(cx + ',' + (cz - 1)); if (lz === CH - 1) this.dirty.add(cx + ',' + (cz + 1));
    if (record) { const k = cx + ',' + cz; let ed = this.edits.get(k); if (!ed) this.edits.set(k, ed = new Map()); ed.set(i, id); if (this.onEdit) this.onEdit(k); }
    return true;
  }
  surface(x, z) { for (let y = H - 1; y >= 0; y--) { const id = this.get(x, y, z); if (isSolid(id) || id === B.WATER) return y; } return 0; }
}

// ---------- بناء شبكة (mesh) للقطعة: وجوه ظاهرة فقط ----------
const FACES = [   // [dx,dy,dz, ظل, زوايا الوجه ×4 (x,y,z)]
  [0, 1, 0, 1, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [0, -1, 0, .55, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [1, 0, 0, .82, [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [-1, 0, 0, .82, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [0, 0, 1, .7, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [0, 0, -1, .7, [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]]];
export function meshChunk(world, cx, cz, tileUV) {
  const O = { p: [], u: [], c: [], i: [] }, Wt = { p: [], u: [], c: [], i: [] }, c = world.chunks.get(cx + ',' + cz); if (!c) return null;
  const x0 = cx * CH, z0 = cz * CH, srcs = world.lightsNear(cx, cz), bnd = world.bounded;
  // أسرع: نقرأ القطعة وجيرانها الثمانية مباشرة بالأرقام (كان كل فحص جار يبني نص ويدوّر بالقائمة ← ~25ms للقطعة)
  const NB = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = world.chunks.get((cx + a) + ',' + (cz + b)); NB.push(q ? q.b : null); }
  const get = (lx, y, lz) => {   // نفس World.get لكن بإحداثيات محلية (من -1 إلى CH)
    if (y < 0) return bnd && !inDomain(x0 + lx, z0 + lz) ? B.AIR : B.BEDROCK; if (y >= H) return B.AIR;
    if (bnd && !inDomain(x0 + lx, z0 + lz)) return B.AIR;
    const dx = lx < 0 ? -1 : lx >= CH ? 1 : 0, dz = lz < 0 ? -1 : lz >= CH ? 1 : 0, arr = NB[(dx + 1) * 3 + dz + 1]; if (!arr) return B.STONE;
    return arr[((y * CH + (lz - dz * CH)) * CH) + (lx - dx * CH)];
  };
  const TOP = new Int16Array((CH + 2) * (CH + 2)).fill(-2);
  const solidTop = (lx, lz) => { const k = (lx + 1) * (CH + 2) + lz + 1; let t = TOP[k]; if (t === -2) { t = -1; for (let y = H - 1; y >= 0; y--) { const id = get(lx, y, lz); if (id !== 0 && isSolid(id) && !isTrans(id)) { t = y; break; } } TOP[k] = t; } return t; };
  let LS = 0, LB = 0;   // نتيجة lightAt (بدون إنشاء مصفوفات)
  // ضوء المشاعل/الحمم = أكبر (قوة − مسافة مانهاتن) من كل المصادر. بدل ما نمر على مئات المصادر لكل وجه، نحسب خريطة للقطع التسع
  // مرة وحدة بمسح منفصل لكل محور (نفس النتيجة بالضبط) ← كانت أثقل شي بالعالم (الحمم الطبيعية كلها مصادر ضوء)
  const GW = CH * 3, GX0 = x0 - CH, GZ0 = z0 - CH; let LG = null;
  if (srcs.length) {
    LG = new Int8Array(GW * H * GW).fill(-64); const at = (gx, y, gz) => (y * GW + gz) * GW + gx;
    for (const q of srcs) { const gx = q[0] - GX0, gz = q[2] - GZ0; if (gx >= 0 && gx < GW && gz >= 0 && gz < GW && q[1] >= 0 && q[1] < H) { const i = at(gx, q[1], gz); if (q[3] > LG[i]) LG[i] = q[3]; } }
    for (let y = 0; y < H; y++) for (let gz = 0; gz < GW; gz++) { const r = at(0, y, gz); for (let gx = 1; gx < GW; gx++) { const v = LG[r + gx - 1] - 1; if (v > LG[r + gx]) LG[r + gx] = v; } for (let gx = GW - 2; gx >= 0; gx--) { const v = LG[r + gx + 1] - 1; if (v > LG[r + gx]) LG[r + gx] = v; } }
    for (let y = 0; y < H; y++) for (let gx = 0; gx < GW; gx++) { for (let gz = 1; gz < GW; gz++) { const i = at(gx, y, gz), v = LG[i - GW] - 1; if (v > LG[i]) LG[i] = v; } for (let gz = GW - 2; gz >= 0; gz--) { const i = at(gx, y, gz), v = LG[i + GW] - 1; if (v > LG[i]) LG[i] = v; } }
    const SL = GW * GW; for (let gz = 0; gz < GW; gz++) for (let gx = 0; gx < GW; gx++) { const b0 = gz * GW + gx; for (let y = 1; y < H; y++) { const i = b0 + y * SL, v = LG[i - SL] - 1; if (v > LG[i]) LG[i] = v; } for (let y = H - 2; y >= 0; y--) { const i = b0 + y * SL, v = LG[i + SL] - 1; if (v > LG[i]) LG[i] = v; } }
  }
  const lightAt = (lx, y, lz) => { LS = y > solidTop(lx, lz) ? 1 : 0; LB = 0; if (LG) { const yy = y < 0 ? 0 : y >= H ? H - 1 : y, v = LG[(yy * GW + (lz + CH)) * GW + (lx + CH)] - (y < 0 ? -y : y >= H ? y - H + 1 : 0); if (v > 0) LB = v / 15; } };
  for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const id = c.b[idx(lx, y, lz)]; if (id === 0) continue; const info = D[id], liquid = id === B.WATER || id === B.LAVA, M = liquid ? Wt : O, X = x0 + lx, Z = z0 + lz;
    if (info.cross) {   // نبات بشكل X (قمح/شتلة): مستطيلين متقاطعين بوجهين
      lightAt(lx, y, lz); const lt = [LS, LB], uv = tileUV(info.top), quads = [[[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]]];
      for (const q of quads) for (const side of [0, 1]) { const bs = M.p.length / 3, pts = side ? [q[1], q[0], q[3], q[2]] : q; for (let k = 0; k < 4; k++) { M.p.push(X + pts[k][0], y + pts[k][1], Z + pts[k][2]); M.c.push(lt[0], lt[1], .9); M.u.push(k === 0 || k === 3 ? uv[0] : uv[2], k < 2 ? uv[1] : uv[3]); } M.i.push(bs, bs + 1, bs + 2, bs, bs + 2, bs + 3); }
      continue;
    }
    if (id === B.TORCH) {   // مشعل: عمود رفيع
      const [sk, bl] = [0, 1], base = M.p.length / 3, uv = tileUV(info.top), w0 = .4375, w1 = .5625; const bx = [[w0, 0, w0], [w1, 0, w0], [w1, 0, w1], [w0, 0, w1]];
      const faces = [[[w0, 0, w1], [w1, 0, w1], [w1, .62, w1], [w0, .62, w1]], [[w1, 0, w0], [w0, 0, w0], [w0, .62, w0], [w1, .62, w0]], [[w1, 0, w1], [w1, 0, w0], [w1, .62, w0], [w1, .62, w1]], [[w0, 0, w0], [w0, 0, w1], [w0, .62, w1], [w0, .62, w0]], [[w0, .62, w1], [w1, .62, w1], [w1, .62, w0], [w0, .62, w0]]];
      for (const f of faces) { const bs = M.p.length / 3; for (let k = 0; k < 4; k++) { M.p.push(X + f[k][0], y + f[k][1], Z + f[k][2]); M.c.push(0, 1, 1); M.u.push(k === 0 || k === 3 ? uv[0] : uv[2], k < 2 ? uv[1] : uv[3]); } M.i.push(bs, bs + 1, bs + 2, bs, bs + 2, bs + 3); }
      continue;
    }
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], ny = y + F[1], nb = get(lx + F[0], ny, lz + F[2]);
      if (liquid) { if (nb === id || (isSolid(nb) && !isTrans(nb))) continue; if (f !== 0 && nb !== 0) continue; }
      else if (info.trans) { if (nb === id || (!isTrans(nb) && nb !== 0)) continue; } else if (!isTrans(nb)) continue;
      const tile = f === 0 ? info.top : f === 1 ? info.bot : info.side, uv = tileUV(tile), base = M.p.length / 3, sh = F[3]; if (id === B.LAVA) { LS = 1; LB = 1; } else lightAt(lx + F[0], ny, lz + F[2]);
      for (let k = 0; k < 4; k++) { const q = F[4][k]; M.p.push(X + q[0], y + q[1] - (liquid && f === 0 ? .12 : 0), Z + q[2]); M.c.push(LS, LB, sh); M.u.push(k === 0 || k === 3 ? uv[0] : uv[2], k < 2 ? uv[1] : uv[3]); }
      M.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const pack = M => ({ p: new Float32Array(M.p), u: new Float32Array(M.u), c: new Float32Array(M.c), i: new Uint32Array(M.i) });
  return { o: pack(O), w: pack(Wt) };
}

// ---------- فيزياء اللاعب ----------
export const PW = .3, PH = 1.8, EYE = 1.62;
const hit = (w, x, y, z) => { for (let bx = Math.floor(x - PW); bx <= Math.floor(x + PW); bx++) for (let bz = Math.floor(z - PW); bz <= Math.floor(z + PW); bz++) for (let by = Math.floor(y); by <= Math.floor(y + PH - .001); by++) if (isSolid(w.get(bx, by, bz))) return true; return false; };
export function stepPlayer(w, P, mx, mz, jump, dt) {
  dt = Math.min(dt, .05);
  const eyeB = w.get(Math.floor(P.x), Math.floor(P.y + EYE), Math.floor(P.z)), feetB = w.get(Math.floor(P.x), Math.floor(P.y + .2), Math.floor(P.z)); P.inLava = feetB === B.LAVA || eyeB === B.LAVA; P.inWater = feetB === B.WATER || eyeB === B.WATER || P.inLava; P.underwater = eyeB === B.WATER;
  const sp = P.inWater ? 2.2 : 4.4, kx = P.kx || 0, kz = P.kz || 0; P.kx = kx * Math.max(0, 1 - dt * 7); P.kz = kz * Math.max(0, 1 - dt * 7); P.vx = mx * sp + kx; P.vz = mz * sp + kz;
  if (P.inWater) { P.vy -= 9 * dt; if (P.vy < -2.5) P.vy = -2.5; if (jump) P.vy = Math.min(3.2, P.vy + 22 * dt); } else { P.vy -= 28 * dt; if (P.vy < -40) P.vy = -40; if (jump && P.onGround) { P.vy = 8.6; P.onGround = false; } }
  let nx = P.x + P.vx * dt;
  if (hit(w, nx, P.y, P.z)) { if (P.onGround && P.vx !== 0 && !hit(w, nx, P.y + 1.01, P.z)) { P.y += 1.01; P.x = nx; } else P.vx = 0; } else P.x = nx;   // خطوة لفوق (مكعب واحد) لو الطريق مسدود
  let nz = P.z + P.vz * dt;
  if (hit(w, P.x, P.y, nz)) { if (P.onGround && P.vz !== 0 && !hit(w, P.x, P.y + 1.01, nz)) { P.y += 1.01; P.z = nz; } else P.vz = 0; } else P.z = nz;
  const ny = P.y + P.vy * dt; P.onGround = false;
  if (hit(w, P.x, ny, P.z)) {
    if (P.vy < 0) { P.y = Math.floor(ny) + 1; P.onGround = true; } else P.y = Math.floor(ny + PH) - PH - .001;
    P.vy = 0;
  } else P.y = ny;
  if (P.y < -20) { P.y = w.surface(Math.floor(P.x), Math.floor(P.z)) + 2; P.vy = 0; }
}

// ---------- شعاع التحديد (أي مكعب أشوفه) ----------
export function raycast(w, ox, oy, oz, dx, dy, dz, maxD = 6, liquid = false) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz); const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : 1e30, tdy = dy ? Math.abs(1 / dy) : 1e30, tdz = dz ? Math.abs(1 / dz) : 1e30;
  let tx = dx ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : 1e30, ty = dy ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : 1e30, tz = dz ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : 1e30, nx = 0, ny = 0, nz = 0, d = 0;
  for (let n = 0; n < 40; n++) {
    const id = w.get(x, y, z); if (id !== B.AIR && (liquid || (id !== B.WATER && id !== B.LAVA)) && D[id]) return { x, y, z, nx, ny, nz, id, d };
    if (tx < ty && tx < tz) { d = tx; x += sx; tx += tdx; nx = -sx; ny = 0; nz = 0; } else if (ty < tz) { d = ty; y += sy; ty += tdy; nx = 0; ny = -sy; nz = 0; } else { d = tz; z += sz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    if (d > maxD) return null;
  }
  return null;
}

// مكان بداية على اليابسة (نبحث بالدوائر من الوسط بدون ما نولّد قطع): أرض عشب، يفضّل قرب غابة
export function landSpawn(seed) {
  for (let r = 0; r <= 90; r++) { let best = null, bs = -1; const n = r === 0 ? 1 : 12; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + r * .7, x = Math.round(Math.cos(a) * r * 10) + 8, z = Math.round(Math.sin(a) * r * 10) + 8, h = heightAt(x, z, seed); if (h >= SEA + 3 && h <= 40) { const f = fbm2(x / 60, z / 60, seed + 31, 2); if (f > bs) { bs = f; best = { x: x + .5, y: h + 1.01, z: z + .5 }; } } } if (best) return best; }
  return { x: 8.5, y: 40, z: 8.5 };
}
export function findSpawn(w, x = 8, z = 8) { for (let r = 0; r < 40; r++) { const px = x + r * 3, y = w.surface(px, z); if (w.get(px, y, z) !== B.WATER) return { x: px + .5, y: y + 1.01, z: z + .5 }; } return { x: x + .5, y: w.surface(x, z) + 1.01, z: z + .5 }; }

// ================= الأغراض (غير المكعبات) والأدوات والشنطة والتصنيع والصهر =================
export const I = { BUCKET: 110, WATER_BUCKET: 111, LAVA_BUCKET: 112, STICK: 100, COAL: 101, CHARCOAL: 102, IRON_INGOT: 103, GOLD_INGOT: 104, DIAMOND: 105, APPLE: 106, BREAD: 107, WHEAT: 108, SEEDS: 109 };
export const TIERS = ['خشب', 'حجر', 'حديد', 'ذهب', 'ألماس'], KINDS = ['معول', 'فأس', 'مجرفة', 'مجرفة زراعة', 'سيف'], KIND_KEYS = ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'];
const WDMG = { sword: [4, 5, 6, 4, 7], axe: [3, 4, 5, 3, 6], pickaxe: [2, 3, 4, 2, 5], shovel: [2, 3, 4, 2, 5], hoe: [1, 1, 1, 1, 1] };   // ضرر السلاح بنص القلب (2 = قلب)
export const weaponDamage = id => { const t = toolInfo(id); return t ? WDMG[t.kind][t.tier] : 1; };
const DUR = [59, 131, 250, 32, 1561], SPEED = [2, 4, 6, 12, 8], LEVEL = [1, 2, 3, 1, 4];   // متانة وسرعة ومستوى كل خامة
export const TOOL_BASE = 120;   // 120 + نوع*5 + خامة
export const toolId = (kind, tier) => TOOL_BASE + kind * 5 + tier;
export const isTool = id => id >= TOOL_BASE && id < TOOL_BASE + 25;
export const toolInfo = id => isTool(id) ? { kind: KIND_KEYS[Math.floor((id - TOOL_BASE) / 5)], tier: (id - TOOL_BASE) % 5, dur: DUR[(id - TOOL_BASE) % 5], speed: SPEED[(id - TOOL_BASE) % 5], level: LEVEL[(id - TOOL_BASE) % 5] } : null;
export const ITEMS = { [I.STICK]: { n: 'عصا' }, [I.COAL]: { n: 'فحم' }, [I.CHARCOAL]: { n: 'فحم خشب' }, [I.IRON_INGOT]: { n: 'سبيكة حديد' }, [I.GOLD_INGOT]: { n: 'سبيكة ذهب' }, [I.DIAMOND]: { n: 'ألماس' }, [I.APPLE]: { n: 'تفاحة', food: 4 }, [I.BREAD]: { n: 'خبز', food: 5 }, [I.WHEAT]: { n: 'قمح' }, [I.SEEDS]: { n: 'بذور' }, [I.BUCKET]: { n: 'دلو' }, [I.WATER_BUCKET]: { n: 'دلو ماء' }, [I.LAVA_BUCKET]: { n: 'دلو حمم' } };
for (let k = 0; k < 5; k++) for (let t = 0; t < 5; t++) ITEMS[toolId(k, t)] = { n: KINDS[k] + ' ' + TIERS[t], tool: true };
export const itemName = id => id < 100 ? (BLOCKS[id] ? BLOCKS[id].n : '؟') : (ITEMS[id] ? ITEMS[id].n : '؟');
export const isFood = id => !!(ITEMS[id] && ITEMS[id].food);
export const stackMax = id => isTool(id) || (id >= 110 && id <= 112) ? 1 : 64;
export const validId = id => (id > 0 && id < 100 && !!BLOCKS[id]) || !!ITEMS[id];

// وقت التكسير (ثواني) حسب عالم البناء: الصلابة × (1.5 لو الأداة تكفي، 5 لو لا) ÷ سرعة الأداة المناسبة
export function breakInfo(id, held) {
  const b = BLOCKS[id]; if (!b || !breakable(id)) return { t: Infinity, ok: false }; const ti = held ? toolInfo(held) : null, match = ti && b.tool === ti.kind;
  const ok = !b.lvl || (match && ti.level >= b.lvl), t = b.hard * (ok ? 1.5 : 5) / (match ? ti.speed : 1); return { t: Math.max(.05, t), ok, tool: match };
}
// اللي يطلع من المكعب لما ينكسر
export function blockDrops(id, ok, rnd = Math.random) {
  const b = BLOCKS[id]; if (!b) return []; if (b.lvl && !ok) return [];
  switch (id) {
    case B.GRASS: return Math.random() < .12 ? [[B.DIRT, 1], [I.SEEDS, 1]] : [[B.DIRT, 1]]; case B.FARMLAND: return [[B.DIRT, 1]];
    case B.SAPLING: return [[B.SAPLING, 1]]; case B.WHEAT7: return rnd() < .5 ? [[I.WHEAT, 1], [I.SEEDS, 2]] : [[I.WHEAT, 1], [I.SEEDS, 1]]; case B.STONE: return [[B.COBBLE, 1]]; case B.COAL: return [[I.COAL, 1]]; case B.DIAMOND: return [[I.DIAMOND, 1]]; case B.GLASS: return [];
    case B.LEAVES: { const r = rnd(); return r < .005 ? [[I.APPLE, 1]] : r < .055 ? [[B.SAPLING, 1]] : r < .075 ? [[I.STICK, 1]] : []; }
    default: if (id > B.WHEAT0 && id < B.WHEAT7) return [[I.SEEDS, 1]]; if (id === B.WHEAT0) return [[I.SEEDS, 1]]; return [[id, 1]];
  }
}
// ----- الشنطة: 36 خانة (0..8 شريط الأدوات) كل خانة null أو {id,n,d} (d = كم استُخدمت الأداة) -----
export const SLOTS = 36;
export const newInv = () => Array.from({ length: SLOTS }, () => null);
export function invAdd(inv, id, n = 1, d = 0) {
  const mx = stackMax(id);
  for (let i = 0; i < inv.length && n > 0; i++) { const s = inv[i]; if (s && s.id === id && mx > 1 && s.n < mx) { const k = Math.min(n, mx - s.n); s.n += k; n -= k; } }
  for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { const k = Math.min(n, mx); inv[i] = { id, n: k, d }; n -= k; }
  return n;   // اللي ما انحط (الشنطة ممتلئة)
}
export const invCount = (inv, id) => inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
export function invTake(inv, id, n = 1) { if (invCount(inv, id) < n) return false; for (let i = inv.length - 1; i >= 0 && n > 0; i--) { const s = inv[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) inv[i] = null; } } return true; }
export const invFlat = inv => { const a = []; inv.forEach((s, i) => { if (s) a.push(i, s.id, s.n, s.d || 0); }); return a; };
export function invFrom(arr) { const inv = newInv(); if (Array.isArray(arr)) for (let j = 0; j + 3 < arr.length; j += 4) { const i = arr[j] | 0, id = arr[j + 1] | 0, n = arr[j + 2] | 0; if (i >= 0 && i < SLOTS && validId(id) && n > 0) inv[i] = { id, n: Math.min(n, stackMax(id)), d: arr[j + 3] | 0 }; } return inv; }
// ----- وصفات عالم البناء (تُعرض بدفتر الوصفات؛ table = تحتاج طاولة تصنيع) -----
const R_ = (out, n, ing, table) => ({ out, n, ing, table: !!table });
export const RECIPES = [];
const mats = [B.PLANKS, B.COBBLE, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND], need = [[3, 2], [3, 2], [1, 2], [2, 2], [2, 1]];   // معول 3 + عصاتين، فأس 3 + عصاتين، مجرفة 1 + عصاتين، مجرفة زراعة 2 + عصاتين
RECIPES.push(R_(B.PLANKS, 4, [[B.LOG, 1]]), R_(I.STICK, 4, [[B.PLANKS, 2]]), R_(B.CRAFTING, 1, [[B.PLANKS, 4]]));
for (let k = 0; k < 5; k++) for (let t = 0; t < 5; t++) RECIPES.push(R_(toolId(k, t), 1, [[mats[t], need[k][0]], [I.STICK, need[k][1]]], true));
RECIPES.push(R_(I.BUCKET, 1, [[I.IRON_INGOT, 3]], true), R_(I.BREAD, 1, [[I.WHEAT, 3]], true));
RECIPES.push(R_(B.TORCH, 4, [[I.COAL, 1], [I.STICK, 1]]), R_(B.TORCH, 4, [[I.CHARCOAL, 1], [I.STICK, 1]]));
RECIPES.push(R_(B.FURNACE, 1, [[B.COBBLE, 8]], true), R_(B.CHEST, 1, [[B.PLANKS, 8]], true), R_(B.GLASS, 4, [[B.SAND, 4]], true), R_(B.BRICK, 4, [[B.STONE, 4]], true), R_(B.LAMP, 1, [[B.GOLD, 1], [I.COAL, 1]], true));
export const canCraft = (inv, r, nearTable) => (!r.table || nearTable) && r.ing.every(([id, k]) => invCount(inv, id) >= k);
export function doCraft(inv, r, nearTable) { if (!canCraft(inv, r, nearTable)) return false; const probe = inv.map(s => s && { ...s }); for (const [id, k] of r.ing) invTake(probe, id, k); if (invAdd(probe, r.out, r.n) > 0) return false; for (const [id, k] of r.ing) invTake(inv, id, k); invAdd(inv, r.out, r.n); return true; }
// ----- الفرن: صهر ووقود -----
export const SMELT = { [B.IRON]: I.IRON_INGOT, [B.GOLD]: I.GOLD_INGOT, [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE, [B.LOG]: I.CHARCOAL };
export const FUEL = { [I.COAL]: 8, [I.CHARCOAL]: 8, [B.LOG]: 1.5, [B.PLANKS]: 1.5, [B.CRAFTING]: 1.5, [I.STICK]: .5 };   // كم غرض يصهر الغرض الواحد من الوقود (10 ثواني للغرض)
export const SMELT_TIME = 10;
export function furnaceTick(f, dt) {   // f = {i:slot,fu:slot,o:slot,burn,prog}; يرجع true لو تغيّر شي
  let ch = false; const can = () => f.i && SMELT[f.i.id] !== undefined && (!f.o || (f.o.id === SMELT[f.i.id] && f.o.n < 64));
  if (f.burn > 0) { f.burn = Math.max(0, f.burn - dt); ch = true; }
  if (can() && f.burn <= 0 && f.fu && FUEL[f.fu.id] !== undefined) { f.burn = f.burnMax = FUEL[f.fu.id] * SMELT_TIME; f.fu.n--; if (f.fu.n <= 0) f.fu = null; ch = true; }
  if (can() && f.burn > 0) { f.prog = (f.prog || 0) + dt; ch = true; if (f.prog >= SMELT_TIME) { f.prog = 0; const out = SMELT[f.i.id]; if (f.o) f.o.n++; else f.o = { id: out, n: 1, d: 0 }; f.i.n--; if (f.i.n <= 0) f.i = null; } }
  else if (f.prog) { f.prog = Math.max(0, f.prog - dt * 2); ch = true; }
  return ch;
}

// ================= سوائل وأشجار (دوال صافية) =================
// أين ينسكب السائل لما تحط دلو: ينزل لتحت لين يلقى أرض، ثم ينتشر أفقياً (ماء 3 مربعات، حمم 2) فوق أرض صلبة. يرجّع مواقع المكعبات الجديدة (بدون المكان الأصلي).
export function spreadLiquid(w, x, y, z, id) {
  const out = [], seen = new Set([x + ',' + y + ',' + z]), R_ = id === B.LAVA ? 2 : 3, free = (a, b, c) => { const v = w.get(a, b, c); return v === B.AIR || v === B.WATER && id !== B.WATER || v === B.LAVA && id !== B.LAVA ? false : v === B.AIR; };
  let cy = y; while (cy > 1 && w.get(x, cy - 1, z) === B.AIR && out.length < 12) { cy--; out.push([x, cy, z]); seen.add(x + ',' + cy + ',' + z); }
  const q = [[x, cy, z, 0]]; while (q.length && out.length < 40) {
    const [qx, qy, qz, d] = q.shift(); if (d >= R_) continue; const below = w.get(qx, qy - 1, qz); if (!(isSolid(below) || below === id)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + dx, nz = qz + dz, k = nx + ',' + qy + ',' + nz; if (seen.has(k) || w.get(nx, qy, nz) !== B.AIR) continue; seen.add(k); out.push([nx, qy, nz]); q.push([nx, qy, nz, d + 1]); }
  }
  return out;
}
// ماء + حمم = سبج: لو حطيت ماء جنب حمم، الحمم تصير سبج. ولو حطيت حمم جنب ماء، المكان نفسه يصير سبج
export function liquidContact(w, x, y, z, id) {
  const out = [], nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const [a, b, c] of nb) { const v = w.get(x + a, y + b, z + c); if (id === B.WATER && v === B.LAVA) out.push([x + a, y + b, z + c, B.OBSIDIAN]); if (id === B.LAVA && v === B.WATER) { out.length = 0; out.push([x, y, z, B.OBSIDIAN]); return out; } }
  return out;
}
// شجرة كبرت من شتلة عند (x,y,z): جذع + أوراق (فقط بالمواقع الفاضية)
export function treeCells(w, x, y, z, rnd = Math.random) {
  const h = 4 + Math.floor(rnd() * 2), top = y + h - 1, out = [];
  for (let k = 0; k < h; k++) out.push([x, y + k, z, B.LOG]);
  for (let dy = -1; dy <= 2; dy++) { const r = dy >= 1 ? 1 : 2; for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; if (dx === 0 && dz === 0 && dy <= 0) continue; const px = x + dx, py = top + dy, pz = z + dz; if (w.get(px, py, pz) === B.AIR) out.push([px, py, pz, B.LEAVES]); } }
  return out;
}
export const isCrop = id => id >= B.WHEAT0 && id <= B.WHEAT7;
