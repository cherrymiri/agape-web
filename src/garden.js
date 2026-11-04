// 정원: 슬롯 배치, 꽃 생성(Bloom), 개화 후 인스턴싱, 씨앗과 빛.
import * as THREE from 'three';
import { GLASS_KEYS, applyGlass } from './glass_materials.js';

// 정원 설정
export const GARDEN = {
  count: 22,                 // 꽃 수 (주소 ?count=)
  need: [1.7, 3],             // 한 송이가 다 피는 데 필요한 수분량 범위 (클수록 체험이 길어짐, 주소 ?need=1.2 배율)
  bud: [1.35, 1.74],           // 꽃봉오리로 쓰는 Bloom 재생 위치(초). 이 구간은 꽃잎이 닫혀 있음
  zones: { center: .4, side: .3 },
  readyFull: .85,            // 이 비율의 꽃이 다 피면 '충분히 자란 정원'
  readyAvg: .93,             // 전체 평균 성장도 기준
};

export const hill = z => .24 * Math.max(0, -z);   // 보이는 바닥은 없고, 뒤쪽 꽃이 조금 높이 놓이는 깊이감만 남음
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


const rnd = (a, b) => a + Math.random() * (b - a);

/** 꽃마다 재질 복제본. 뿌리 쪽이 어둠 속으로 사라지게 하고(바닥 없음), 성장에 따라 빛이 살아남 */
function flowerMaterial(base, rootY) {
  const m = base.clone(), u = { value: rootY };
  m.onBeforeCompile = sh => {
    sh.uniforms.uRootY = u;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRootY; varying float vWY;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(uRootY + .02, uRootY + .36, vWY);');
  };
  m.customProgramCacheKey = () => 'rootfade';
  return m;
}

/** 작은 투명 물방울: 비눗막이 터지며 흩어졌다가 꽃에 맺히고 스며듦. 한 번의 드로우 */
class Drops {
  constructor(scene, cap = 240) {
    this.cap = cap; this.list = [];
    const g = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `varying vec3 n, v; void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.); n = normalize(normalMatrix * normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 n, v; void main(){ vec3 N = normalize(n); float c = max(dot(N, v), 0.), f = pow(1. - c, 2.2);
        float s = pow(max(dot(reflect(-v, N), normalize(vec3(-.5,.7,.5))), 0.), 40.);
        float a = .10 + .55 * f + s; vec3 col = mix(vec3(.84,.88,1.), vec3(1.), s); gl_FragColor = vec4(col * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    this.mesh = new THREE.InstancedMesh(g, mat, cap); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  clear() { this.list = []; this.mesh.count = 0; }
}

export class Garden {
  constructor(scene, protos, mats) {
    this.scene = scene; this.protos = protos; this.mats = mats; this.goal = GARDEN.count; this.needK = 1;
    this.lights = new Lights(scene); this.drops = new Drops(scene);
    this.group = new THREE.Group(); scene.add(this.group);
    this.flowers = []; this.slots = []; this.bag = new ComboBag(); this.counts = {}; this.clock = 0;
  }
  reset() {
    for (const f of this.flowers) { f.mixer.stopAllAction(); f.mixer.uncacheRoot(f.obj); f.mat.dispose(); }
    this.group.clear(); this.lights.clear(); this.drops.clear(); this.flowers = []; this.slots = []; this.clock = 0;
    this.bag = new ComboBag(); this.counts = {};
  }
  get built() { return this.flowers.length > 0; }
  get fullShare() { return this.flowers.filter(f => f.g > .985).length / this.flowers.length; }
  get avg() { return this.flowers.reduce((a, f) => a + f.g, 0) / this.flowers.length; }
  get ready() { return this.fullShare >= GARDEN.readyFull && this.avg >= GARDEN.readyAvg; }

  /** 중앙에서 좌우로 번지는 불규칙 군집. 앞·중간·뒤 깊이감 */
  layout(span, back) {
    const N = this.goal, k = Math.sqrt(N / 22), S = span * k, front = 1.3, B = back * k;
    const Z = GARDEN.zones, zones = [[-.3, .3, Z.center], [-1, -.3, Z.side], [.3, 1, Z.side]];
    const slots = [], space = .98;
    const gap = (x, z) => { let m = 9; for (const s of slots) m = Math.min(m, Math.hypot(s.x - x, (s.z - z) * .62)); return m; };
    zones.forEach(([a, c, share], zi) => { for (let i = 0, n = zi === 2 ? N - slots.length : Math.round(N * share); i < n; i++) {
      let best = null, bs = -9;
      for (let t = 0; t < 48; t++) {
        const x = S * (a + (c - a) * Math.random()), z = front - (front + B) * Math.random() ** .85;
        const g = gap(x, z), q = Math.min(g, space + .25) - (g < space ? 3 * (space - g) : 0) - .1 * Math.abs(x) / S + Math.random() * .12;
        if (q > bs) { bs = q; best = { x, z }; }
      }
      slots.push({ ...best, y: hill(best.z) });
    } });
    this.slots = slots;
  }
  /** 처음부터 닫힌 꽃봉오리로 심어 둠 */
  plantAll() {
    for (const slot of this.slots) {
      const [k, m] = this.bag.next();
      const p = this.protos[k], o = p.scene.clone(true), mat = flowerMaterial(this.mats[m], slot.y);
      applyGlass(o, mat);
      const scale = rnd(.9, 1.06);
      o.position.set(slot.x, slot.y, slot.z); o.rotation.y = rnd(-.2, .2); o.rotation.z = rnd(-.05, .05); o.scale.setScalar(scale);
      this.group.add(o);
      const clip = p.animations[0], mx = new THREE.AnimationMixer(o), a = mx.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.paused = true;
      const f = {
        obj: o, mat, key: k, matKey: m, slot, scale, mixer: mx, action: a, dur: clip.duration, head: o.getObjectByName('Head'), headPos: new THREE.Vector3(),
        t0: rnd(...GARDEN.bud), g: 0, target: 0, shown: -1, wet: 0, rate: rnd(.5, 1.05), need: rnd(...GARDEN.need) * this.needK, appetite: rnd(.45, 1.6),
        base: { e: mat.emissiveIntensity, env: mat.envMapIntensity, ir: mat.iridescence },
      };
      f.halo = this.lights.add({ pos: f.headPos, col: HALO[m], a: .02, size: 1.5 });
      this.flowers.push(f); this.apply(f);
      this.counts[k] = (this.counts[k] || 0) + 1; this.counts[m] = (this.counts[m] || 0) + 1;
    }
  }
  apply(f) {
    if (Math.abs(f.g - f.shown) > 1e-4 || f.g === 1 && f.shown !== 1) {
      f.action.time = f.g >= 1 ? f.dur : f.t0 + (f.dur - f.t0) * f.g; f.mixer.update(0); f.shown = f.g;
      f.obj.updateMatrixWorld(true); f.head.getWorldPosition(f.headPos); f.headR = (.2 + .34 * f.g) * f.scale;
    }
    const k = .3 + .7 * f.g * f.g * (3 - 2 * f.g), m = f.mat, b = f.base;
    m.emissiveIntensity = b.e * k * (1 + .4 * f.wet);
    m.envMapIntensity = b.env * (.5 + .5 * f.g);
    m.iridescence = b.ir * (.3 + .7 * f.g);
    f.halo.a = .015 + .05 * f.g + .09 * f.wet; f.halo.size = 1.3 + .7 * f.g;
  }
  /** 비눗방울이 향할 꽃. 목마른 꽃일수록 조금 더 자주, 다 핀 꽃에게도 닿음 */
  pickTarget() {
    const pa = Math.min(this.clock / 30, 1);          // 처음엔 꽃마다 받는 양이 들쭉날쭉하고, 시간이 갈수록 뒤처진 꽃에게도 고루 닿음
    let sum = 0; const w = this.flowers.map(f => { const left = Math.max(f.need * (1 - f.target), 0) / 3, v = f.target > .97 ? .1 : (f.appetite * (1 - pa) + pa) * (.3 + left * left * (1 + 2 * pa)); sum += v; return v; });
    let u = Math.random() * sum;
    for (let i = 0; i < w.length; i++) { u -= w[i]; if (u <= 0) return this.flowers[i]; }
    return this.flowers[0];
  }
  /** 방울 위치에서 닿는 꽃 */
  touching(p, r, target) {
    for (const f of this.flowers) {
      if (f.target > .97 && f !== target) continue;     // 다 핀 꽃은 그 꽃을 향한 방울이 닿을 때만
      if (p.distanceTo(f.headPos) < r * .55 + f.headR) return f;
    }
    return null;
  }
  /** 비눗막이 터지는 순간: 물방울이 흩어졌다가 꽃에 맺힘 */
  burst(pos, r, f, k = 1) {
    const n = Math.round(4 + Math.min(r / k, 1) * 11), amount = (.5 + .95 * Math.min(r / k, 1.1)) / n;
    for (let i = 0; i < n && this.drops.list.length < this.drops.cap; i++) {
      const dir = new THREE.Vector3().randomDirection();
      this.drops.list.push({
        f, from: pos.clone().addScaledVector(dir, r * Math.random()), mid: dir.multiplyScalar(r * .5 + .12), t: 0, dur: rnd(.28, .7), size: rnd(.022, .06) * (.7 + .5 * Math.min(r, 1)),
        off: new THREE.Vector3().randomDirection().multiplyScalar(rnd(.5, 1)), stick: rnd(.7, 1.5), landed: false, amount, p: pos.clone(),
      });
    }
  }
  update(dt, ending) {
    this.clock += dt;
    const D = this.drops, tmp = D.p; let c = 0;
    for (let i = D.list.length - 1; i >= 0; i--) {
      const d = D.list[i], f = d.f; d.t += dt;
      let size = d.size;
      const anchor = tmp.copy(d.off).multiplyScalar(f.headR).add(f.headPos);
      if (d.t < d.dur) {
        const e = d.t / d.dur, q = e * e * (3 - 2 * e), o = Math.sin(e * Math.PI);
        d.p.copy(d.from).lerp(anchor, q).addScaledVector(d.mid, o * .6); d.p.y -= .1 * o;
      } else {
        if (!d.landed) { d.landed = true; f.wet = 1; f.target = Math.min(1, f.target + d.amount / f.need); }
        const e = (d.t - d.dur) / d.stick;                 // 맺혔다가 스며듦
        if (e >= 1) { D.list.splice(i, 1); continue; }
        d.p.copy(anchor); size *= (1 - e * e) * .85;
      }
    }
    for (const d of D.list) {
      let size = d.size; if (d.landed) { const e = (d.t - d.dur) / d.stick; size *= (1 - e * e) * .85; }
      D.m.compose(d.p, D.q, D.s.setScalar(Math.max(size, 1e-4))); D.mesh.setMatrixAt(c++, D.m);
    }
    D.mesh.count = c; D.mesh.instanceMatrix.needsUpdate = true;

    for (const f of this.flowers) {
      if (ending && f.target < 1) f.target = Math.min(1, f.target + dt * .35);     // 사랑을 받은 꽃들은 마저 피어남
      f.g += Math.min((f.target - f.g) * (1 - Math.exp(-dt * (ending ? Math.max(f.rate, 1.5) : f.rate))), dt * .55);
      if (f.target - f.g < 2e-3) f.g = f.target;
      f.wet = Math.max(0, f.wet - dt / 1.6);
      this.apply(f);
    }
    this.lights.flush();
  }
}
