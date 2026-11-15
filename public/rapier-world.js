// عالم Rapier للتجربة: صناديق التصادم الثابتة (نفس SOL) + متحكم شخصية جاهز بكبسولة.
// الكبسولة تغطي الارتفاع من y+.35 إلى y+2 (مطابق للتصادم القديم: يتجاهل اللي تحت y+.35 وفوق y+2).
export async function createRapierWorld(RAPIER) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });   // بدون جاذبية: الارتفاع يديره التطبيق (groundAt)
  const R = 0.55, LOW = 0.35, HIGH = 2.0, HALF = (HIGH - LOW - 2 * R) / 2;
  const ctrl = world.createCharacterController(0.01);
  ctrl.setUp({ x: 0, y: 1, z: 0 });
  ctrl.setSlideEnabled(true);
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, R));   // بلا جسم: نحرّكها يدوياً
  let statics = [];

  function setSolids(boxes) {
    for (const c of statics) world.removeCollider(c, false);
    statics = [];
    for (const b of boxes) {
      const hx = (b[1] - b[0]) / 2, hz = (b[3] - b[2]) / 2, hy = (b[5] - b[4]) / 2;
      if (hx <= 0 || hz <= 0 || hy <= 0) continue;
      statics.push(world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation((b[0] + b[1]) / 2, (b[4] + b[5]) / 2, (b[2] + b[3]) / 2)
      ));
    }
    world.step();   // يحدّث بنية البحث للمجسمات الجديدة
  }

  // يحرّك p (x,z) بمقدار dx,dz مع تصادم. y = ارتفاع القدمين. الارتفاع نفسه ما نغيّره.
  function move(p, y, dx, dz) {
    col.setTranslation({ x: p.x, y: y + LOW + R + HALF, z: p.z });
    ctrl.computeColliderMovement(col, { x: dx, y: 0, z: dz });
    const m = ctrl.computedMovement();
    p.x += m.x; p.z += m.z;
  }

  return { setSolids, move, count: () => statics.length };
}
