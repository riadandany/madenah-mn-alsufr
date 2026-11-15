// حركة آمنة من الاختراق: أي انتقال يتقسّم لخطوات صغيرة والتصادم يُفحص بعد كل خطوة.
export const MAX_STEP = 0.25;   // أقل بكثير من نصف قطر الشخصية (.55)
export const MAX_STEPS = 64;

export function stepCount(dx, dz, maxStep = MAX_STEP) {
  const len = Math.hypot(dx, dz);
  return len <= maxStep ? 1 : Math.min(MAX_STEPS, Math.ceil(len / maxStep));
}

// يحرّك p بمقدار (dx,dz) على خطوات، وبعد كل خطوة يستدعي resolve(p) اللي يدفع p خارج الجدران
export function moveSwept(p, dx, dz, resolve, maxStep = MAX_STEP) {
  const n = stepCount(dx, dz, maxStep), sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) { p.x += sx; p.z += sz; resolve(p); }
  return n;
}

// دفع دائرة (مركزها p ونصف قطرها R) خارج صندوق b=[minX,maxX,minZ,maxZ,...] — نفس منطق التصادم القديم حرفياً
export function pushOutOfBox(p, b, R) {
  const cx = Math.max(b[0], Math.min(p.x, b[1])), cz = Math.max(b[2], Math.min(p.z, b[3]));
  const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return false;
  if (d2 < 1e-8) {
    const l = p.x - b[0], r = b[1] - p.x, f = p.z - b[2], k = b[3] - p.z, m = Math.min(l, r, f, k);
    if (m === l) p.x = b[0] - R; else if (m === r) p.x = b[1] + R; else if (m === f) p.z = b[2] - R; else p.z = b[3] + R;
    return true;
  }
  const d = Math.sqrt(d2);
  p.x = cx + dx / d * R; p.z = cz + dz / d * R;
  return true;
}
