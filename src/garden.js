// 정원: 슬롯 배치, 꽃 생성(Bloom), 개화 후 인스턴싱, 씨앗과 빛.
import * as THREE from 'three';
import { GLASS_KEYS, applyGlass } from './glass_materials.js';

export const hill = z => .24 * Math.max(0, -z);
const KEYS = 'ABCDE'.split('');
const HALO = { aurora: [.62, .58, 1], pearl: [1, .78, .92], milky: [.82, .82, 1], glow: [1, .72, .42] };

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** 20가지 조합이 고르게 나오도록 섞은 주머니에서 하나씩 뽑음 */
export class ComboBag {
  constructor() { this.bag = []; this.last = null; }
  next() {
    if (!this.bag.length) {
      for (const k of KEYS) for (const m of GLASS_KEYS) this.bag.push([k, m]);
      shuffle(this.bag);
      if (this.last && this.bag.at(-1)[0] === this.last[0]) this.bag.unshift(this.bag.pop());
    }
    return this.last = this.bag.pop();
  }
}

const dot = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, '#fff'); r.addColorStop(.18, '#ffffff99'); r.addColorStop(.5, '#ffffff22'); r.addColorStop(1, '#fff0');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

/** 씨앗과 꽃의 은은한 빛을 한 번의 드로우로 그림 */
class Lights {
  constructor(scene, cap = 260) {
    this.cap = cap; this.items = new Set();
    const g = this.g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(cap), 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { map: { value: dot }, uScale: { value: 500 } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; uniform float uScale; varying vec3 c;
        void main(){ c=aColor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 c; void main(){ gl_FragColor=vec4(c*texture2D(map,gl_PointCoord).a,1.); }`,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 6; scene.add(this.pts);
  }
  add(o) { this.items.add(o); return o; }
  remove(o) { this.items.delete(o); }
  clear() { this.items.clear(); }
  flush() {
    const p = this.g.attributes.position, c = this.g.attributes.aColor, s = this.g.attributes.aSize; let i = 0;
    for (const o of this.items) { if (i >= this.cap) break;
      p.setXYZ(i, o.pos.x, o.pos.y, o.pos.z); c.setXYZ(i, o.col[0] * o.a, o.col[1] * o.a, o.col[2] * o.a); s.setX(i, o.size); i++; }
    this.g.setDrawRange(0, i); p.needsUpdate = c.needsUpdate = s.needsUpdate = true;
  }
}

/** 개화가 끝난 꽃을 파츠·재질별 InstancedMesh로 합쳐 드로우콜을 일정하게 유지 */
class Pools {
  constructor(scene, cap) { this.scene = scene; this.cap = cap; this.map = new Map(); }
  get(geo, mat) {
    const k = geo.uuid + mat.uuid;
    let m = this.map.get(k);
    if (!m) { m = new THREE.InstancedMesh(geo, mat, this.cap); m.count = 0; m.frustumCulled = false; m.list = []; this.map.set(k, m); this.scene.add(m); }
    return m;
  }
  add(geo, mat, matrix, owner) {
    const m = this.get(geo, mat);
    m.list.push({ e: matrix.clone(), owner, z: matrix.elements[14] });
    m.list.sort((a, b) => a.z - b.z);                // 뒤쪽부터 그려 반투명 겹침을 안정시킴
    this.write(m);
  }
  write(m) { m.list.forEach((x, i) => m.setMatrixAt(i, x.e)); m.count = m.list.length; m.instanceMatrix.needsUpdate = true; }
  removeOwner(owner) { for (const m of this.map.values()) { const n = m.list.length; m.list = m.list.filter(x => x.owner !== owner); if (m.list.length !== n) this.write(m); } }
  clear() { for (const m of this.map.values()) { this.scene.remove(m); m.dispose(); } this.map.clear(); }
  get drawCalls() { let n = 0; for (const m of this.map.values()) if (m.count) n++; return n; }
}

export class Garden {
  constructor(scene, protos, mats) {
    this.scene = scene; this.protos = protos; this.mats = mats;
    this.lights = new Lights(scene); this.pools = new Pools(scene, 700);
    this.group = new THREE.Group(); scene.add(this.group);
    this.reset();
  }
  reset() {
    this.seeds = []; this.growing = []; this.done = []; this.bag = new ComboBag(); this.counts = {};
    this.group.clear(); this.pools.clear(); this.lights.clear(); this.slots = this.slots?.map(s => (s.taken = false, s)) ?? [];
    this.total = 0;
  }
  get glow() { return Math.min(1, this.done.length / 40); }
  /** camera에서 실제로 보이는 곳만 슬롯으로 등록 */
  layout(camera, topNdc, block) {
    if (this.total) return;
    const slots = [], v = new THREE.Vector3(), SPACE = 1.2;
    for (let r = 0; r < 14; r++) {
      const z = 1.1 - r * 1.3;
      for (let i = -12; i <= 12; i++) {
        const x = (i + (r % 2) * .5) * SPACE + (Math.random() - .5) * .22;
        const zz = z + (Math.random() - .5) * .3, y = hill(zz);
        v.set(x - Math.sign(x) * -.6, y + 1.32, zz).project(camera);
        const top = v.y, side = Math.abs(v.x);
        const hid = block && v.x > block.x0 - block.pad && v.x < block.x1 + block.pad && top > block.y - .05;
        if (top < topNdc && side < .97 && !hid) slots.push({ x, z: zz, y, r, taken: false });
      }
    }
    this.slots = slots;
  }
  pick(x) {
    const free = this.slots.filter(s => !s.taken);
    if (!free.length) return this.recycle();
    let best = null, bs = 1e9;
    for (const s of free) { const q = s.r * 1.5 + Math.abs(s.x - x * .5) * .22 + Math.random() * 1.6; if (q < bs) { bs = q; best = s; } }
    best.taken = true; return best;
  }
  recycle() {                                         // 슬롯이 가득 차면 가장 오래된 꽃의 자리를 내어줌
    const old = this.done.shift(); if (!old) return null;
    this.pools.removeOwner(old); this.lights.remove(old.halo); return old.slot;
  }
  spawnSeed(pos, cap = 110) {
    const live = this.done.length + this.growing.length + this.seeds.length;
    const slot = live >= cap ? this.recycle() : this.pick(pos.x); if (!slot) return;
    const s = { from: pos.clone(), pos: pos.clone(), t: 0, dur: 2.6 + Math.random() * 1.3, slot, sway: Math.random() * 6, col: [1, .88, .7], a: 1, size: .42 };
    this.lights.add(s); this.seeds.push(s);
  }
  plant(slot) {
    const [k, m] = this.bag.next();
    const p = this.protos[k], o = p.scene.clone(true);
    applyGlass(o, this.mats[m]);
    const scale = .9 + Math.random() * .16;
    o.position.set(slot.x, slot.y, slot.z); o.rotation.y = (Math.random() - .5) * .34; o.scale.setScalar(scale);
    this.group.add(o);
    const mx = new THREE.AnimationMixer(o), a = mx.clipAction(p.animations[0]);
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = .85; a.play();
    const f = { obj: o, mixer: mx, action: a, key: k, mat: m, slot, scale, dur: p.animations[0].duration / .85, t: 0 };
    this.growing.push(f); this.total++;
    this.counts[k] = (this.counts[k] || 0) + 1; this.counts[m] = (this.counts[m] || 0) + 1;
    return f;
  }
  finish(f) {
    f.obj.updateMatrixWorld(true);
    f.obj.traverse(n => { if (n.isMesh) this.pools.add(n.geometry, n.material, n.matrixWorld, f); });
    this.group.remove(f.obj); f.mixer.stopAllAction(); f.mixer.uncacheRoot(f.obj);
    const c = HALO[f.mat], top = new THREE.Vector3(f.slot.x, f.slot.y + .8 * f.scale, f.slot.z);
    f.halo = this.lights.add({ pos: top, col: c, a: f.mat === 'glow' ? .1 : .07, base: f.mat === 'glow' ? .1 : .07, size: f.mat === 'glow' ? 2.6 : 2.0, pulse: 1 });
    this.done.push(f);
  }
  update(dt) {
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const s = this.seeds[i]; s.t += dt / s.dur;
      const e = Math.min(s.t, 1), q = e * e * (3 - 2 * e);
      s.pos.set(THREE.MathUtils.lerp(s.from.x, s.slot.x, q) + Math.sin(s.sway + e * 7) * .18 * (1 - e),
        THREE.MathUtils.lerp(s.from.y, s.slot.y + .05, q), THREE.MathUtils.lerp(s.from.z, s.slot.z, q));
      if (s.t >= 1) { this.seeds.splice(i, 1); s.a = 1; s.fade = 1; this.arrive(s); }
    }
    for (const o of this.lights.items) {
      if (o.fade !== undefined) { o.fade -= dt / 1.1; o.a = Math.max(o.fade, 0); if (o.fade <= 0) this.lights.remove(o); }
      if (o.pulse > 0) { o.pulse = Math.max(0, o.pulse - dt / 1.6); o.a = o.base + o.pulse * .22; }
    }
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const f = this.growing[i]; f.mixer.update(dt); f.t += dt;
      if (f.t >= f.dur) { this.growing.splice(i, 1); this.finish(f); }
    }
    this.lights.flush();
  }
  arrive(s) { this.plant(s.slot); }
  settleAll() { // 엔딩·테스트용: 남은 씨앗과 꽃을 끝까지 진행
    while (this.seeds.length || this.growing.length) this.update(.1);
  }
}
