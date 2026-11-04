// 정원: 슬롯 배치, 꽃 생성(Bloom), 개화 후 인스턴싱, 씨앗과 빛.
import * as THREE from 'three';
import { GLASS_KEYS, applyGlass } from './glass_materials.js';

// 정원 설정
export const GARDEN = {
  count: 30,                 // 꽃 수 (주소 ?count=). 전부 피면 엔딩
  scale: [.5, .6],           // 꽃 크기 배율 (형태는 그대로, 균일 축소)
  stem: [1.2, 1.5],          // 봉오리일 때의 줄기: Bloom 재생 위치(초). 작을수록 짧음
  pearl: .078,               // 진주 봉오리 반지름
  bloom: [2.2, 3.1],         // 비눗방울이 닿은 뒤 다 피기까지(초)
  zones: { center: .46, side: .27 },
  // 재질 비중: 흰빛·연보라·진주빛 중심, 따뜻한 발광은 드물게
  mats: { aurora: 10, pearl: 9, milky: 8, glow: 3 },
  glowDim: .62,              // 발광 유리의 밝기 배율 (전체 색감 맞춤)
};

export const hill = z => .24 * Math.max(0, -z);   // 보이는 바닥은 없고, 뒤쪽 꽃이 조금 높이 놓이는 깊이감만 남음
const KEYS = 'ABCDE'.split('');
const HALO = { aurora: [.62, .62, 1], pearl: [.92, .8, 1], milky: [.82, .84, 1], glow: [1, .84, .78] };

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** 20가지 조합이 고르게 나오도록 섞은 주머니에서 하나씩 뽑음 */
export class ComboBag {
  constructor() { this.bag = []; }
  next() {
    if (!this.bag.length) {
      const ms = []; for (const m in GARDEN.mats) for (let i = 0; i < GARDEN.mats[m]; i++) ms.push(m);
      shuffle(ms);
      const ks = []; while (ks.length < ms.length) ks.push(...shuffle([...KEYS]));
      this.bag = ms.map((m, i) => [ks[i], m]);
    }
    return this.bag.pop();
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
  const m = base.clone(), u = { value: rootY };   // 뿌리가 어둠 속으로 사라짐
  m.onBeforeCompile = sh => {
    sh.uniforms.uRootY = u;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRootY; varying float vWY;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(uRootY, uRootY + .05, vWY);');
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

/** 진주 봉오리: 짧은 줄기 끝의 작은 빛방울. 잎 없음. 전부 한 번의 드로우 */
class Pearls {
  constructor(scene, cap = 120) {
    const pts = []; const N = 18;
    for (let i = 0; i <= N; i++) {               // 끝이 살짝 모인 물방울 윤곽
      const t = i / N, a = Math.PI * t, w = Math.sin(a) * (.8 + .2 * t) * (1 - .2 * (1 - t) ** 3);
      pts.push(new THREE.Vector2(Math.max(w, 1e-3), 1.28 * Math.cos(a) + .1));
    }
    const g = new THREE.LatheGeometry(pts, 20);
    this.mat = new THREE.MeshPhysicalMaterial({ name: 'PEARL_Bud', color: 0xf3f0fb, roughness: .22, clearcoat: 1, clearcoatRoughness: .08,
      iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [300, 460], emissive: 0xd9d6f6, emissiveIntensity: .34, envMapIntensity: 1.3 });
    this.mesh = new THREE.InstancedMesh(g, this.mat, cap); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.s = new THREE.Vector3(); this.q = new THREE.Quaternion();
  }
}

export class Garden {
  constructor(scene, protos, mats) {
    this.scene = scene; this.protos = protos; this.mats = mats; this.goal = GARDEN.count;
    this.lights = new Lights(scene); this.drops = new Drops(scene); this.pearls = new Pearls(scene);
    this.group = new THREE.Group(); scene.add(this.group);
    this.flowers = []; this.slots = []; this.bag = new ComboBag(); this.counts = {}; this.clock = 0;
  }
  reset() {
    for (const f of this.flowers) { f.mixer.stopAllAction(); f.mixer.uncacheRoot(f.obj); f.mat.dispose(); }
    this.group.clear(); this.lights.clear(); this.drops.clear(); this.flowers = []; this.slots = []; this.clock = 0;
    this.bag = new ComboBag(); this.counts = {}; this.pearls.mesh.count = 0;
  }
  get built() { return this.flowers.length > 0; }
  get opened() { return this.flowers.filter(f => f.g >= 1).length; }
  get avg() { return this.flowers.reduce((a, f) => a + f.g, 0) / this.flowers.length; }
  get ready() { return this.flowers.length > 0 && this.flowers.every(f => f.g >= 1); }

  /** 촘촘한 타원 군집. 뒤로 갈수록 높아져 꽃들이 겹겹이 쌓임 */
  layout(span, back, cx) {
    const N = this.goal, k = Math.sqrt(N / 30), S = span * k, B = back * k, zc = .55 - B;
    const slots = [], space = .5;
    const gap = (x, z) => { let m = 9; for (const s of slots) m = Math.min(m, Math.hypot(s.x - x, (s.z - z) * .62)); return m; };
    for (let i = 0; i < N; i++) {
      let best = null, bs = -9;
      for (let t = 0; t < 70; t++) {
        const a = Math.random() * 6.2832, r = Math.sqrt(Math.random());
        const x = cx + Math.cos(a) * r * S * (1 + .08 * Math.sin(a * 3)), z = zc + Math.sin(a) * r * B;
        const g = gap(x, z), q = Math.min(g, space + .18) - (g < space ? 3 * (space - g) : 0) - .14 * r + Math.random() * .1;
        if (q > bs) { bs = q; best = { x, z }; }
      }
      slots.push({ ...best, y: hill(best.z) });
    }
    this.slots = slots;
  }
  plantAll() {
    for (const slot of this.slots) {
      const [k, m] = this.bag.next();
      const p = this.protos[k], o = p.scene.clone(true), mat = flowerMaterial(this.mats[m], slot.y);
      if (m === 'glow') mat.emissiveIntensity *= GARDEN.glowDim;
      applyGlass(o, mat);
      const scale = rnd(...GARDEN.scale);
      o.position.set(slot.x, slot.y, slot.z); o.rotation.y = rnd(-.22, .22); o.rotation.z = rnd(-.05, .05); o.scale.setScalar(scale);
      this.group.add(o);
      const clip = p.animations[0], mx = new THREE.AnimationMixer(o), a = mx.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.paused = true;
      const f = {
        obj: o, mat, key: k, matKey: m, slot, scale, mixer: mx, action: a, dur: clip.duration, head: o.getObjectByName('Head'), headPos: new THREE.Vector3(),
        t0: rnd(...GARDEN.stem), g: 0, shown: -1, wet: 0, opening: false, bt: 0, bloom: rnd(...GARDEN.bloom), claims: 0, phase: rnd(0, 6.3), pr: rnd(.85, 1.2) * GARDEN.pearl,
        base: { e: mat.emissiveIntensity, env: mat.envMapIntensity, ir: mat.iridescence },
      };
      f.halo = this.lights.add({ pos: f.headPos, col: HALO[m], a: .012, size: .55 });
      this.flowers.push(f); this.apply(f);
      this.counts[k] = (this.counts[k] || 0) + 1; this.counts[m] = (this.counts[m] || 0) + 1;
    }
    this.pearls.mesh.count = this.flowers.length;
    this.pearls.mesh.instanceMatrix.needsUpdate = true;
  }
  apply(f) {
    const g = f.g, e = g * g * (3 - 2 * g);
    if (Math.abs(g - f.shown) > 1e-4 || (g >= 1 && f.shown !== 1)) {
      f.action.time = g >= 1 ? f.dur : f.t0 + (f.dur - f.t0) * e; f.mixer.update(0); f.shown = g;
      // 꽃은 진주 안에서 작게 시작해 커지며 나옴. 다 피면 원본 크기 그대로
      const r = Math.min(Math.max((g - .06) / .5, 0), 1), rv = r * r * (3 - 2 * r);
      f.head.scale.multiplyScalar(Math.max(rv, .001)); f.head.visible = rv > .004;
      f.obj.updateMatrixWorld(true); f.head.getWorldPosition(f.headPos); f.headR = (.13 + .24 * g) * f.scale + .05;
    }
    const k = .62 + .38 * e, m = f.mat, b = f.base;
    m.emissiveIntensity = b.e * k * (1 + .35 * f.wet);
    m.envMapIntensity = b.env * (.55 + .45 * g);
    m.iridescence = b.ir * (.35 + .65 * g);
    f.halo.a = .012 + .02 * g + .05 * f.wet; f.halo.size = .55 + .55 * g;
  }
  /** 아직 피지 않은 봉오리 중, 다른 방울이 덜 향한 곳으로. 모두 피었으면 아무 꽃이나 */
  pickTarget() {
    const buds = this.flowers.filter(f => !f.opening && f.g < 1), list = buds.length ? buds : this.flowers;
    let sum = 0; const w = list.map(f => { const v = 1 / (1 + 4 * f.claims); sum += v; return v; });
    let u = Math.random() * sum, t = list[0];
    for (let i = 0; i < w.length; i++) { u -= w[i]; if (u <= 0) { t = list[i]; break; } }
    t.claims++; return t;
  }
  touching(p, r, target) {
    for (const f of this.flowers) {
      if ((f.opening || f.g >= 1) && f !== target) continue;   // 핀 꽃은 그 꽃을 향한 방울만
      if (p.distanceTo(f.headPos) < r * .6 + f.headR) return f;
    }
    return null;
  }
  burst(pos, r, f) {
    const n = Math.round(4 + Math.min(r / .5, 1) * 9);
    if (!f.opening && f.g < 1) f.opening = true, f.touched = true;   // 닿은 순간 예약: 다른 방울은 다음 봉오리로
    for (let i = 0; i < n && this.drops.list.length < this.drops.cap; i++) {
      const dir = new THREE.Vector3().randomDirection();
      this.drops.list.push({ f, from: pos.clone().addScaledVector(dir, r * Math.random()), mid: dir.multiplyScalar(r * .5 + .08), t: 0, dur: rnd(.22, .55), size: rnd(.012, .032), off: new THREE.Vector3().randomDirection().multiplyScalar(rnd(.6, 1)), stick: rnd(.6, 1.3), landed: false, p: pos.clone() });
    }
  }
  update(dt) {
    this.clock += dt;
    const D = this.drops, tmp = new THREE.Vector3();
    for (let i = D.list.length - 1; i >= 0; i--) {
      const d = D.list[i], f = d.f; d.t += dt;
      const anchor = tmp.copy(d.off).multiplyScalar(f.headR).add(f.headPos);
      if (d.t < d.dur) {
        const e = d.t / d.dur, q = e * e * (3 - 2 * e), o = Math.sin(e * Math.PI);
        d.p.copy(d.from).lerp(anchor, q).addScaledVector(d.mid, o * .6); d.p.y -= .06 * o;
      } else {
        if (!d.landed) { d.landed = true; f.wet = 1; }
        if ((d.t - d.dur) / d.stick >= 1) { D.list.splice(i, 1); continue; }
        d.p.copy(anchor);
      }
    }
    let c = 0;
    for (const d of D.list) {
      let size = d.size; if (d.landed) { const e = (d.t - d.dur) / d.stick; size *= (1 - e * e) * .85; }
      D.m.compose(d.p, D.q, D.s.setScalar(Math.max(size, 1e-4))); D.mesh.setMatrixAt(c++, D.m);
    }
    D.mesh.count = c; D.mesh.instanceMatrix.needsUpdate = true;

    const P = this.pearls; c = 0;
    for (const f of this.flowers) {
      if (f.opening && f.wet > 0 || f.bt > 0) { f.bt += dt; f.g = Math.min(f.bt / f.bloom, 1); }
      f.wet = Math.max(0, f.wet - dt / 1.5);
      this.apply(f);
      // 진주: 살짝 숨 쉬다가, 물을 받으면 부풀었다 꽃 중심으로 스며듦
      const breathe = 1 + .045 * Math.sin(this.clock * 1.1 + f.phase), g = f.g;
      const s = g <= 0 ? 1 + .25 * f.wet : g < .14 ? 1.25 + g * .9 : Math.max(0, 1.38 * (1 - ((g - .14) / .46)));
      const r = Math.max(f.pr * Math.max(s, 0) * breathe * f.scale / .55, 1e-4);
      P.m.compose(f.headPos, P.q, P.s.set(r, r, r)); P.mesh.setMatrixAt(c++, P.m);
    }
    P.mesh.count = c; P.mesh.instanceMatrix.needsUpdate = true;
    this.lights.flush();
  }
}
