// 숨의 흐름에서 비눗방울이 태어나고 흩어지는 시스템.
//
// 생성: 고정 타이머가 없습니다. 숨의 세기가 '생성 밀도(λ)'를 정하고, 숨 안의 국면(부풂·연달아·잔방울·쉼)과
//       천천히 요동치는 돌풍값이 그 밀도를 흔듭니다. 실제 생성 시각은 그 밀도의 확률 과정에서 나옵니다.
// 성장: 모든 방울은 고리의 막 위 한 점에서 부풀어 오릅니다. 들어오는 공기량만큼 자라고, 숨이 멎으면 그 크기로 떨어집니다.
// 결말: 방울마다 태어날 때 '꽃에게 닿음/멀리 떠남'이 정해집니다. 떠나는 방울은 터지지 않고 아무것도 남기지 않습니다.
import * as THREE from 'three';
import { createFilm } from './film.js';

export const CONFIG = {
  driftRatio: .3,      // 꽃에 닿지 않고 터지지도 않은 채 멀리 떠나는 비율 (주소 ?drift=0.25)
  sizeMin: .06,        // 방울 반지름 범위 (꽃 머리 지름 ≈ 1)
  sizeMax: .72,
  maxBuds: 5,          // 고리에서 동시에 부풀 수 있는 방울 수
  endBubbles: 24,      // 엔딩 화면에 머무는 방울 수 상한
  density: .3,        // 전체 생성 밀도 배율
  seekDelay: [.15, 1.8],  // 태어난 뒤 꽃 쪽으로 기울기 시작하는 시간 범위(초)
};

const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(6.2832 * Math.random());
const logn = (s) => Math.exp(gauss() * s);

const PHASE = {
  swell:   { rate: 1.1, mu: .60, sig: .36, t: [.5, 1.4], spread: .32 },   // 큰 방울이 천천히
  run:     { rate: 3.4, mu: .29, sig: .34, t: [.45, 1.2], spread: .45 },  // 중간 방울이 연달아
  scatter: { rate: 12,  mu: .125, sig: .48, t: [.22, .75], spread: .85 }, // 작은 방울이 흩어짐
  lilt:    { rate: 1.6, mu: .22, sig: .45, t: [.2, .7], spread: .5 },     // 밀도가 잠깐 묽어지는 구간 (멈추지는 않음)
};

export class Bubbles {
  constructor({ scene, wand, W, ringR }) {
    this.scene = scene; this.wand = wand; this.W = W; this.ringR = ringR;
    this.list = []; this.buds = []; this.ring = null; this.form = 0;
    this.ambT = 0; this.since = 0; this.excite = 0; this.gust = 0; this.t = 0; this.prevB = 0; this.breathT = 0; this.phase = null; this.phaseLeft = 0; this.onset = true;
    this.stats = { born: 0, hits: 0, flew: 0, sizes: [], times: [], fates: [] };
    this.pos = new THREE.Vector3(); this.ndc = new THREE.Vector3();
  }

  // ── 고리의 막 ──
  showRing() { if (this.ring) return; const f = createFilm(this.ringR); f.material.uniforms.uH.value = .0025; this.wand.add(f); this.ring = f; this.form = 0; }
  hideRing() {
    if (this.ring) { this.wand.remove(this.ring); this.ring.material.dispose(); this.ring = null; }
    for (const b of this.buds) { this.wand.remove(b.m); b.m.material.dispose(); }
    this.buds = [];
  }
  clear() {
    this.hideRing();
    for (const b of this.list) { this.scene.remove(b.m); b.m.material.dispose(); }
    this.ambT = 0; this.endMode = false; this.list = []; this.gust = 0; this.excite = 0; this.onset = true; this.prevB = 0; this.breathT = 0; this.phase = null;
    this.stats = { born: 0, hits: 0, flew: 0, sizes: [], times: [], fates: [] };
  }

  /** 엔딩: 떠 있는 방울은 마저 꽃에 닿거나 멀리 떠남. 퇴장 중 태어나는 방울은 그대로 떠남 */
  settle() {
    this.endMode = true;
    for (const b of this.list) { if (b.fate === 'seek') b.delay = 0; else b.exit.multiplyScalar(1.8); }
  }

  /** 엔딩: 막대가 떠난 뒤에도 화면 밖 어딘가에서 불어오는 듯 방울이 불규칙하게 계속 흘러옴. 문구 앞은 비켜 감 */
  ambient(dt, camera) {
    this.ambT -= dt;
    if (this.ambT > 0 || this.list.length >= CONFIG.endBubbles) return;
    this.ambT = Math.random() < .3 ? rnd(.1, .3) : rnd(.3, 1.0);          // 가끔 연달아, 대개는 띄엄띄엄
    const y = rnd(-.85, .92), high = y > .3, z = rnd(-.6, 2.2);
    const v3 = new THREE.Vector3(1, y, .5).unproject(camera).sub(camera.position).normalize();
    const p = camera.position.clone().addScaledVector(v3, (z - camera.position.z) / v3.z);
    const R = Math.min(.13 * logn(.6), .44) / this.W, a = R * .7;
    const m = createFilm(a), u = m.material.uniforms, h = R + Math.sqrt(R * R - a * a);
    u.uForm.value = 1; u.uH.value = h; u.uClose.value = 1;
    const rW = R * this.W; m.scale.setScalar(this.W); this.scene.add(m);
    p.x += rW + .2;
    this.list.push({
      m, u, r: rW, R, age: 0, close: 1, closeT: 1, pop: -1, st: 0, stV: 0, p, ambient: true, high, fate: 'fly',
      v: new THREE.Vector3(-rnd(.15, .5), rnd(-.06, .1), rnd(-.04, .04)), drag: rnd(.08, .22), rise: rnd(.02, .1), gain: rnd(.2, .7),
      swayA: rnd(.03, .24), swayF: rnd(.3, 1.1), swayP: rnd(6.2832), drift: new THREE.Vector3(), driftS: rnd(.06, .22), driftK: rnd(.3, 1),
      exit: new THREE.Vector3(-rnd(.03, .14), rnd(-.02, .03), 0),
    });
  }

  // ── 숨 → 생성 밀도 ──
  nextPhase(b) {
    const w = {
      swell: (.5 - .25 * b) * (this.breathT < .35 ? 5 : 1),
      run: .75,
      scatter: .22 + 1.2 * b * b,
      lilt: this.breathT < .3 ? 0 : .5 + .3 * (1 - b),
    };
    if (this.phase) w[this.phase] *= .25;
    let u = rnd(Object.values(w).reduce((a, c) => a + c, 0));
    for (const k in w) { u -= w[k]; if (u <= 0) { this.phase = k; break; } }
    const [a, c] = PHASE[this.phase].t; this.phaseLeft = rnd(a, c) * logn(.25);
  }

  sampleSize(b) {
    const p = PHASE[this.phase];
    const q = Math.random() < .24 ? PHASE[Object.keys(PHASE)[Math.floor(rnd(4))]] : p;   // 다른 국면의 크기가 섞여 나옴
    let r = q.mu * logn(q.sig) * (.68 + .78 * b) * this.fitK;
    if (this.breathT > .9 && b > .45 && Math.random() < .09) r *= rnd(1.6, 2.3);   // 드물게 아주 큰 방울
    return clamp(r, CONFIG.sizeMin, CONFIG.sizeMax);
  }

  startBud(b) {
    this.since = 0; this.excite += rnd(1, 8);   // 하나가 나오면 잠깐 연달아 나오기 쉬워짐
    const rW = this.sampleSize(b), R = this.ringR, r = rW / this.W;
    const big = this.buds.some(x => x.a > R * .55);
    let a = clamp(r * rnd(.55, .9), .03, R * .9);
    if (big) a = Math.min(a, R * .3);                     // 큰 방울이 부푸는 동안은 가장자리에서 작은 것만
    const off = rnd(.25, 1) * (R - a) * (big ? 1 : .8), th = rnd(6.2832);
    const m = createFilm(a); m.material.uniforms.uForm.value = 1;
    m.position.set(Math.cos(th) * off, Math.sin(th) * off, .004); this.wand.add(m);
    this.buds.push({ m, u: m.material.uniforms, a, r: Math.max(r, a), p: 0, T: (.1 + 1.55 * Math.pow(rW, 1.6)) * logn(.45), st: 0, phase: this.phase, b0: b });
  }

  grow(dt, b) {
    const flow = (.34 + 1.35 * b) * (1 + .38 * this.gust);
    for (let i = this.buds.length - 1; i >= 0; i--) {
      const s = this.buds[i], R = lerp(s.a, s.r, Math.max(0, (s.p - .15) / .85));
      if (b > 0) s.p += dt * flow / s.T;
      else if (s.p > .13) s.p = 1.01, s.r = R;            // 숨이 멎으면 지금 크기로 떨어져 나감
      else { s.p -= dt * 2.2; if (s.p <= 0) { this.wand.remove(s.m); s.m.material.dispose(); this.buds.splice(i, 1); continue; } }
      const h = s.p < .15 ? s.a * Math.max(s.p / .15, .02) : R + Math.sqrt(Math.max(R * R - s.a * s.a, 0));
      s.u.uH.value = h; s.u.uTime.value = this.t;
      s.u.uWob.value = lerp(s.u.uWob.value, (.006 + .02 * b) * Math.min(s.r / .25, 1), dt * 8);
      s.st = lerp(s.st, s.r * this.W > .5 ? .24 * s.p : .06 * s.p, dt * 7);   // 큰 방울은 길게 늘어났다가 떨어짐
      s.m.scale.z = 1 + s.st;
      if (s.p >= 1) { this.buds.splice(i, 1); this.release(s, R, b); }
    }
  }

  release(s, R, b) {
    const m = s.m, u = s.u; this.scene.attach(m);
    const rW = R * this.W, q = m.getWorldQuaternion(new THREE.Quaternion());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const spread = PHASE[s.phase].spread, ang = gauss() * spread * .6 + (Math.random() < .5 ? 0 : -.2), rise = gauss() * spread * .45 + .08;
    const dir = new THREE.Vector3(-Math.cos(ang), Math.sin(rise), Math.sin(ang) * .35 + normal.z * .1).normalize();
    const speed = (1.15 + 3.6 * b) * Math.pow(.55 / (rW + .35), .85) * logn(.5) * this.fitV;
    const shy = Math.random();
    const o = {
      m, u, r: rW, age: 0, close: 0, closeT: .07 + .24 * Math.min(rW, 1) * rnd(.7, 1.3), pop: -1, st: s.st, stV: 0,
      p: new THREE.Vector3(0, 0, u.uH.value - R).multiply(m.scale).applyQuaternion(q).add(m.position), R,
      v: dir.multiplyScalar(speed),
      drag: (.5 + .42 / (rW + .25)) * logn(.35),                 // 처음엔 빠르다가 느려지는 정도
      rise: (shy < .1 ? -.05 : .3 * logn(.55)) * (.45 + .2 / (rW + .2)),
      gain: rnd(.3, 1.3) * (1 + .4 / (rW + .4)),                 // 바람에 밀리는 정도
      swayA: Math.random() < .35 ? rnd(.5, 1.4) : rnd(.04, .4), swayF: rnd(.35, 1.7), swayP: rnd(6.2832),
      drift: new THREE.Vector3(), driftS: rnd(.15, .75), driftK: rnd(.25, 1.2),   // 움직임의 변화
    };
    // 결말: 꽃에게 닿거나, 아무것도 남기지 않고 떠남
    if (Math.random() >= CONFIG.driftRatio && !this.endMode) { o.fate = 'seek'; o.target = this.pickTarget(); o.delay = rnd(...CONFIG.seekDelay); o.seekK = rnd(1.8, 3.6) * (.8 / this.fitK) ** 2; }
    else { this.setFlyer(o); if (this.endMode) o.exit.multiplyScalar(2.2); }
    this.list.push(o);
    this.stats.born++; this.stats.sizes.push(+rW.toFixed(3)); this.stats.times.push(+this.t.toFixed(3));
    this.stats.fates.push(o.fate);
    if (rW > .5 && this.ring) this.form = Math.min(this.form, .5);  // 큰 방울이 떨어지면 막이 잠깐 다시 차오름
  }
  setFlyer(o) {
    o.fate = 'fly';
    const up = rnd(.25, 1.1);                                    // 꽃밭 위로 높이 지나 화면 밖으로
    o.exit = new THREE.Vector3(rnd(-1, -.35), up, rnd(-.2, .1)).normalize().multiplyScalar(rnd(.45, 1.2));
  }

  wind(p, t, out) {
    return out.set(
      -.22 + .42 * Math.sin(.19 * t + .23 * p.y + 1.3) + .2 * Math.sin(.47 * t - .31 * p.x),
      .12 * Math.sin(.23 * t + .4 * p.x) + .08 * Math.sin(.53 * t + .2 * p.y),
      .1 * Math.sin(.17 * t + .3 * p.x + 2));
  }

  /** b: 숨 세기 0~1 / active: 막대가 들려 있고 불 수 있는 상태 */
  update(dt, breath, { active, lift, camera, maxBubbles, garden, portraitK = 1 }) {
    this.t += dt; this.fitK = portraitK; this.fitV = portraitK; this.pickTarget = () => garden.pickTarget();
    const b = active ? breath : 0, t = this.t;
    // 고리 막
    if (this.ring) {
      this.form = Math.min(1, this.form + dt / .7);
      const u = this.ring.material.uniforms; u.uForm.value = this.form; u.uTime.value = t;
      u.uAlpha.value = clamp(lift * 1.6 - .6, 0, 1);
      u.uH.value = lerp(u.uH.value, .0025 + .05 * b, dt * 9);
      u.uWob.value = lerp(u.uWob.value, .012 * b, dt * 8);
    }
    this.gust += (-1.3 * this.gust) * dt + 1.7 * Math.sqrt(dt) * gauss();
    this.gust = clamp(this.gust, -1.2, 1.2);

    if (b > 0) {
      this.breathT += dt;
      if (this.onset) { this.onset = false; this.breathT = 0; this.phase = null; this.nextPhase(b); this.phase = Math.random() < .75 ? 'swell' : this.phase; this.startBud(b); }
      if ((b - this.prevB) / dt > 2.6 && this.phase !== 'scatter') { this.phase = 'scatter'; this.phaseLeft = rnd(.25, .6); }   // 세게 치고 나오는 순간
      this.phaseLeft -= dt * (.7 + .8 * b);
      if (this.phaseLeft <= 0) this.nextPhase(b);
      // 숨이 이어지는 한 생성은 끊기지 않음. 화면이 붐비면 밀도만 낮추고, 오래 안 나왔으면 다음 방울이 나올 확률이 올라감
      const room = Math.max(.4, 1 - this.list.length / maxBubbles);
      this.since += dt; this.excite *= Math.exp(-5 * dt);
      const lam = PHASE[this.phase].rate * (b ** 1.15) * 1.5 * (1 + .55 * this.gust) * room * CONFIG.density + this.excite + 14 * this.since ** 2;
      if (this.buds.length < CONFIG.maxBuds && this.form > .5 && Math.random() < 1 - Math.exp(-Math.max(lam, 0) * dt)) this.startBud(b);
    } else if (this.prevB > 0 || !active) { this.onset = true; }
    this.prevB = b;
    this.grow(dt, b);

    this.move(dt, camera, maxBubbles, garden);
  }

  move(dt, camera, maxBubbles, garden) {
    const t = this.t, w = (this._w ||= new THREE.Vector3());
    // 동시 표시 한도를 넘으면 가장 오래된 방울을 터뜨리지 않고 내보냄
    let live = 0; for (const b of this.list) if (b.fate === 'seek' && b.pop < 0) live++;
    if (live > maxBubbles) { const o = this.list.find(b => b.fate === 'seek' && b.pop < 0 && b.close >= 1); if (o) { this.setFlyer(o); o.exit.multiplyScalar(1.5); o.released = true; } }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i], u = b.u; b.age += dt; u.uTime.value = t;
      if (b.close < 1) { b.close = Math.min(1, b.close + dt / b.closeT); const c = b.close; u.uClose.value = c * c * (3 - 2 * c); }
      // 표면 흔들림: 떨어진 직후 출렁이다 가라앉음
      b.stV += (-46 * b.st - 6 * b.stV) * dt; b.st += b.stV * dt; b.m.scale.z = this.W * (1 + b.st);
      u.uWob.value = (.012 * Math.exp(-b.age * .9) + .0025) * Math.min(b.r / .3, 1);

      const v = b.v, p = b.p;
      this.wind(p, t + b.swayP * 3, w);
      // 부드러운 무작위 힘(갑자기 방향이 꺾이지 않음)
      const d = b.drift, k = Math.sqrt(dt) * b.driftS * 1.6;
      d.x += -b.driftK * d.x * dt + gauss() * k; d.y += -b.driftK * d.y * dt + gauss() * k; d.z += -b.driftK * d.z * dt + gauss() * k * .5;
      const sway = Math.cos(b.age * b.swayF * 6.2832 * .32 + b.swayP) * b.swayA;
      const ax = b.drag * (w.x * b.gain - v.x) + d.x + sway;
      let ay = b.drag * (b.rise + w.y * b.gain - v.y) + d.y;
      if (b.fate === 'seek' && b.age > b.delay && b.pop < 0) {   // 꽃 쪽으로 서서히 기울어짐: 맞히는 게임이 아니라 바람이 데려가는 느낌
        const pull = Math.min((b.age - b.delay) / 2, 1) * (b.seekK + (b.age > 9 ? (b.age - 9) * .6 : 0));
        const dx = b.target.headPos.x - p.x, dy = b.target.headPos.y - p.y, dz = b.target.headPos.z - p.z, l = Math.hypot(dx, dy, dz) + .001;
        v.x += dx / l * pull * dt; v.z += dz / l * pull * dt; ay = d.y * .6 + b.drag * (w.y * b.gain * .4 - v.y) + dy / l * pull * 1.1;
      }
      const az = b.drag * (w.z * b.gain - v.z) + d.z;
      v.x += ax * dt; v.y += ay * dt; v.z += az * dt;

      this.ndc.copy(p).project(camera);
      const nx = this.ndc.x, ny = this.ndc.y, depth = Math.max(camera.position.distanceTo(p), 1);
      const hh = depth * Math.tan(camera.fov * Math.PI / 360), hw = hh * camera.aspect;
      if (b.fate === 'seek') {                                 // 꽃을 향하는 방울은 화면 안에 머무름
        const mx = 1 - (b.r + .15) / hw, my = Math.min(1 - (b.r + .15) / hh, .66);   // 위쪽 문구를 가리지 않음
        const zone = mx - .16;                                 // 벽 근처에서 부드럽게 속도를 줄이고 되돌림
        if (Math.abs(nx) > zone) {
          const e = (Math.abs(nx) - zone) / .16, sx = Math.sign(nx);
          if (v.x * sx > 0) v.x *= Math.exp(-dt * 9 * e);
          v.x -= sx * e * e * 2.4 * dt;
        }
        if (ny > my) v.y -= (ny - my) * 12 * dt;
        if (p.z > 3.6) v.z -= (p.z - 3.6) * 3 * dt;
      } else {                                                 // 날아가는 방울은 점점 바람을 타고 화면 밖으로
        const ramp = clamp((b.age - .4) / 2.2, 0, 1);
        if (b.ambient && Math.abs(nx) < .55) {                                       // 엔딩 문구 앞은 비켜 감
          const m = (b.r + .1) / hh;
          if (b.high && ny - m < .62) v.y += (.62 - ny + m) * 3 * dt;
          if (!b.high && ny + m > -.2) v.y -= (ny + m + .2) * 3 * dt;
        }
        v.addScaledVector(b.exit, ramp * dt * 1.2);
      }
      p.addScaledVector(v, dt);
      b.m.position.set(0, 0, u.uH.value - b.R).multiply(b.m.scale).applyQuaternion(b.m.quaternion).add(p);

      if (b.fate === 'fly') {
        const out = Math.abs(nx) > 1 + (b.r + .3) / hw || ny > 1 + (b.r + .3) / hh || ny < -1 - (b.r + .3) / hh;
        if (b.ambient && !b.entered) { if (Math.abs(nx) < 1) b.entered = true; else if (b.age < 30) continue; }
        if (out) { const amb = b.ambient; this.remove(i); if (!amb) this.stats.flew++; }      // 화면 밖으로 완전히 나간 뒤에만 정리
        continue;
      }
      if (b.pop < 0 && b.close >= 1 && b.age > .5) {
        const f = garden.touching(p, b.r, b.target);
        if (f) { b.pop = 0; garden.burst(p, b.r, f); this.stats.hits++; }   // 닿는 순간 비눗막이 물방울이 됨
      }
      if (b.pop >= 0) {
        b.pop += dt / (.2 + .26 * Math.min(b.r, 1)); u.uPop.value = Math.min(b.pop, 1);
        if (b.pop >= 1) this.remove(i);
      }
    }
  }
  remove(i) { const b = this.list[i]; this.scene.remove(b.m); b.m.material.dispose(); this.list.splice(i, 1); }
}
