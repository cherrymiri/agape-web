// 정원: 슬롯 배치, 꽃 생성(Bloom), 개화 후 인스턴싱, 씨앗과 빛.
import * as THREE from 'three';
import { GLASS_KEYS, applyGlass } from './glass_materials.js';

// 정원이 완성되는 유리꽃 수. 기기 성능과 무관합니다. (주소에 ?goal=30 으로도 조절)
export const FLOWER_GOAL = 20;
export const TEMPO = { seed: [1, 1.8], bloom: 2.35 };   // 씨앗 이동(초), 꽃 개화(초). 최종 형태는 바뀌지 않음
export const ZONES = { center: .4, side: .3 };          // 중앙과 좌우 각각의 꽃 비율

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
    this.scene = scene; this.protos = protos; this.mats = mats; this.goal = FLOWER_GOAL;
    this.lights = new Lights(scene); this.pools = new Pools(scene, 700);
    this.group = new THREE.Group(); scene.add(this.group);
    this.reset();
  }
  reset() {
    this.seeds = []; this.growing = []; this.done = []; this.bag = new ComboBag(); this.counts = {};
    this.group.clear(); this.pools.clear(); this.lights.clear(); this.slots = this.slots?.map(s => (s.taken = false, s)) ?? [];
    this.total = 0;
  }
  get glow() { return Math.min(1, this.done.length / Math.min(this.goal, 40)); }
  /** 예약 수: 내려오는 씨앗 + 자라는 꽃 + 다 핀 꽃. 추가 씨앗 제한에만 쓰임. 엔딩은 done.length(완전 개화)로 판단 */
  get reserved() { return this.committed; }
  get committed() { return this.done.length + this.growing.length + this.seeds.length; }
  get idle() { return !this.seeds.length && !this.growing.length; }
  /** camera에서 실제로 보이는 곳만 슬롯으로 등록 */
  /** 중앙에서 좌우로 번지는 군집 배치. 격자 없이 앞·중간·뒤에 흩뿌리고, 피어나는 순서도 중앙부터 */
  layout(span, back) {
    if (this.total) return;
    const N = Math.min(this.goal, 120), k = Math.sqrt(N / 20), S = span * k, front = 1.5, B = back * k;
    const zones = [[-.3, .3, ZONES.center], [-1, -.3, ZONES.side], [.3, 1, ZONES.side]];
    const slots = [], space = .96;
    const gap = (x, z) => { let m = 9; for (const s of slots) m = Math.min(m, Math.hypot(s.x - x, (s.z - z) * .62)); return m; };
    for (const [a, c, share] of zones) for (let i = 0, n = Math.round(N * share); i < n; i++) {
      let best = null, bs = -9;
      for (let t = 0; t < 48; t++) {
        const x = S * (a + (c - a) * Math.random()), z = front - (front + B) * Math.random() ** .85;
        const g = gap(x, z), q = Math.min(g, space + .25) - (g < space ? 3 * (space - g) : 0) - .1 * Math.abs(x) / S + Math.random() * .12;
        if (q > bs) { bs = q; best = { x, z }; }
      }
      slots.push({ ...best, y: hill(best.z), taken: false, order: Math.abs(best.x) / S + .3 * (front - best.z) / (front + B) + Math.random() * .34 });
    }
    this.slots = slots.sort((p, q) => p.order - q.order);
  }
  pick(x) {
    const free = this.slots.filter(s => !s.taken).slice(0, 4);
    if (!free.length) return this.recycle();
    let best = free[0], bs = 1e9;
    for (const s of free) { const q = Math.abs(s.x - x * .4) * .3 + Math.random(); if (q < bs) { bs = q; best = s; } }
    best.taken = true; return best;
  }
  recycle() {                                         // 슬롯이 가득 차면 가장 오래된 꽃의 자리를 내어줌
    const old = this.done.shift(); if (!old) return null;
    this.pools.removeOwner(old); this.lights.remove(old.halo); return old.slot;
  }
  spawnSeed(pos) {
    if (this.committed >= this.goal) return false;    // 예약은 목표를 넘지 않음. 넘는 방울은 씨앗 없이 사라짐
    const slot = this.pick(pos.x); if (!slot) return false;
    const s = { from: pos.clone(), pos: pos.clone(), t: 0, dur: TEMPO.seed[0] + Math.random() * (TEMPO.seed[1] - TEMPO.seed[0]), slot, sway: Math.random() * 6, col: [1, .88, .7], a: 1, size: .42 };
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
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = p.animations[0].duration / TEMPO.bloom; a.play();
    const f = { obj: o, mixer: mx, action: a, key: k, mat: m, slot, scale, dur: TEMPO.bloom, t: 0 };
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
