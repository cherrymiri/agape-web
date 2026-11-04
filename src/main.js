import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGlassMaterials, createWandMaterial, createGlassEnvironment, applyGlass } from './glass_materials.js';
import { BreathMic } from './breath.js';
import { createFilm, filmRadius } from './film.js';
import { Quality, TIERS } from './quality.js';
import { Garden, hill } from './garden.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const ease = t => t * t * (3 - 2 * t);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;

// ─── 렌더러 ───────────────────────────────────────────
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040a);
scene.environment = createGlassEnvironment(renderer);
const camera = new THREE.PerspectiveCamera(30, 1, .1, 120);

let composer = null, bloom = null, tierNow = TIERS[1];
function pixelRatio() { return Math.min(devicePixelRatio || 1, tierNow.pixel); }
function buildPipeline() {
  renderer.setPixelRatio(pixelRatio());
  composer?.dispose?.(); composer = null;
  if (tierNow.bloom) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tierNow.samples });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    // 화면 절반 해상도로 빛번짐 계산
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), .17, .5, .82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
}
const quality = new Quality(t => { tierNow = t; if (ready) { buildPipeline(); fit(); } },
  params.has('tier') ? +params.get('tier') : undefined);
var ready = false;

// ─── 바닥과 공간의 빛 ──────────────────────────────────
const groundMat = new THREE.ShaderMaterial({
  uniforms: { uGlow: { value: 0 }, uFocus: { value: new THREE.Vector3(0, 0, 3) }, uFocusA: { value: 1 } },
  vertexShader: `varying vec3 w; void main(){ vec4 p=modelMatrix*vec4(position,1.); w=p.xyz; gl_Position=projectionMatrix*viewMatrix*p; }`,
  fragmentShader: `uniform float uGlow,uFocusA; uniform vec3 uFocus; varying vec3 w;
    void main(){
      float d=length((w.xz-uFocus.xz)*vec2(.42,.62));
      float pool=exp(-d*d*.9)*.030*uFocusA;
      float span=exp(-pow(w.x*.07,2.))*(.004+.052*uGlow);
      float fade=smoothstep(-15.,-5.,w.z);
      vec3 bg=vec3(.0015,.0012,.0030)+vec3(.0075,.0060,.0150)*uGlow*exp(-pow(w.x*.05,2.))*exp(-max(w.y-1.,0.)*.12);
      vec3 c=vec3(.0045,.0038,.0085)+vec3(.46,.40,.78)*pool+vec3(.50,.42,.76)*span;
      gl_FragColor=vec4(mix(bg,c,fade),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
{
  const g = new THREE.PlaneGeometry(120, 60, 1, 70); g.rotateX(-Math.PI / 2); g.translate(0, 0, -6);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hill(p.getZ(i)) - .02);
  scene.add(new THREE.Mesh(g, groundMat));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), groundMat); back.position.set(0, 20, -36); scene.add(back);
}
// ─── 카메라 맞춤 ──────────────────────────────────────
const view = { intro: { pos: new THREE.Vector3(), at: new THREE.Vector3() }, garden: { pos: new THREE.Vector3(), at: new THREE.Vector3() }, ringNdc: new THREE.Vector2() };
function fit() {
  const w = innerWidth, h = innerHeight, a = w / h, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false);
  composer?.setSize(w, h); composer?.setPixelRatio?.(pixelRatio());
  camera.aspect = a; camera.updateProjectionMatrix();
  const portrait = a < .85;
  // 정원: 너비 최소 7.6칸, 높이 최소 9칸을 보장
  const D = Math.max(4.5 / tan, 3.8 / (tan * a));
  const halfH = D * tan;
  view.garden.at.set(0, halfH * .86 - .4, 0);
  view.garden.pos.set(0, view.garden.at.y + D * .23, D);
  // 시작 화면: 놓인 막대에 가까이
  const Di = Math.max(11, 3.1 / (tan * a));
  view.intro.at.set(0, portrait ? 1.0 : 1.5, 3.2);
  view.intro.pos.set(0, view.intro.at.y + Di * .36, 3.2 + Di);
  view.ringNdc.set(portrait ? -.26 : -.5, portrait ? .22 : .16);
  garden && layoutGarden();
  lights();
}
function lights() { if (garden) garden.lights.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); }
function layoutGarden() {
  const keep = { p: camera.position.clone(), q: camera.quaternion.clone() };
  camera.position.copy(view.garden.pos); camera.lookAt(view.garden.at); camera.updateMatrixWorld();
  garden.layout(camera, innerHeight > innerWidth ? .22 : .3);
  camera.position.copy(keep.p); camera.quaternion.copy(keep.q); camera.updateMatrixWorld();
}

// ─── 막대 ────────────────────────────────────────────
const W = 1.6;                                   // 막대 표시 배율(균일). 형태는 그대로
const RING_R = .312;
const wand = new THREE.Group();
wand.scale.setScalar(W); scene.add(wand);
const hit = new THREE.Mesh(new THREE.CapsuleGeometry(.5, 1.5, 2, 8), new THREE.MeshBasicMaterial({ visible: false }));
hit.position.y = -.7; wand.add(hit);
const POSE = {
  rest: { p: new THREE.Vector3(.1, .13, 3.2), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -.92, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)) },
  up: { p: new THREE.Vector3(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(.06, 2.5, -.1)) },
};
function updateUpPose() {
  camera.position.copy(view.garden.pos); camera.lookAt(view.garden.at); camera.updateMatrixWorld();
  const v = new THREE.Vector3(view.ringNdc.x, view.ringNdc.y, .5).unproject(camera).sub(camera.position).normalize();
  const t = (3 - camera.position.z) / v.z;
  POSE.up.p.copy(camera.position).addScaledVector(v, t);
}

// ─── 상태 ────────────────────────────────────────────
const S = {
  phase: 'loading', up: false, lift: 0, camT: 0, film: null, form: 0, h: 0, peak: 0, blowT: 0,
  bubbles: [], time: 0, sim: { on: false, strength: 0 }, hold: false, micDenied: false, flowersSeen: 0,
  endT: 0, popped: 0, spawned: 0,
};
let mic = null, garden = null;
const sens = (() => { try { return +(localStorage.getItem('agape.sens') ?? 50); } catch { return 50; } })();
$('sens').value = sens;

function breath() {
  if (S.sim.on) return S.sim.strength;
  if (S.hold) { S.holdT = (S.holdT || 0) + 1 / 60; return clamp(.32 + S.holdT * .4, 0, .9); }
  S.holdT = 0;
  return mic?.gate.on ? mic.gate.strength : 0;
}

// ─── 비눗막 → 비눗방울 ─────────────────────────────────
function newFilm() {
  const f = createFilm(RING_R); wand.add(f); S.film = f; S.form = 0; S.h = 0; S.peak = 0; S.blowT = 0;
}
function dropFilm() { if (S.film) { wand.remove(S.film); S.film.material.dispose(); S.film = null; } }

function detach() {
  const f = S.film; scene.attach(f); S.film = null;
  const u = f.material.uniforms, dir = new THREE.Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion()));
  const r = filmRadius(u) * W * (.94 + Math.random() * .12);
  S.bubbles.push({ m: f, u, v: dir.multiplyScalar(.75 + S.peak * 1.1).setY(.12), age: 0, life: 6.5 + Math.random() * 3.8 + r, close: 0, r, sway: Math.random() * 6.3, swayK: .5 + Math.random() * .5, pop: -1 });
  S.spawned++;
  if (S.bubbles.length > quality.t.bubbles) { const o = S.bubbles.find(b => b.pop < 0 && b.close >= 1); if (o) o.pop = 0; }
  newFilm();
  S.form = .35;
}

function updateFilm(dt) {
  const f = S.film; if (!f) return;
  const u = f.material.uniforms; S.form = Math.min(1, S.form + dt / .75);
  u.uForm.value = S.form; u.uTime.value = S.time; f.material.uniforms.uAlpha.value = ease(clamp(S.lift * 1.6 - .6, 0, 1));
  const b = S.lift > .96 && S.form > .55 ? breath() : 0;
  const a = RING_R;
  if (b > 0) {
    if (!S.blown) { S.blown = true; hint(''); }
    S.blowT += dt; S.peak = Math.max(S.peak, b);
    S.h += dt * (.16 + 1.15 * b);                       // 세고 길수록 빨리, 크게
    const hMax = a * (1.45 + 2.6 * S.peak);              // 약한 숨은 작게 떨어지고 강한 숨은 크게
    u.uWob.value = lerp(u.uWob.value, .012 + .018 * b, dt * 8);
    if (S.h >= hMax) detach();
  } else {
    u.uWob.value = lerp(u.uWob.value, 0, dt * 4);
    if (S.h > a * .4) {                                  // 숨이 멎으면 부푼 만큼 떨어져 나감 (구가 될 때까지 마저 오므라듦)
      if (S.h < a) S.h += dt * .9; else detach();
    } else { S.h = Math.max(0, S.h - dt * .5); if (!S.h) { S.peak = 0; S.blowT = 0; } }  // 너무 약했으면 도로 잦아듦
  }
  if (S.film) S.film.material.uniforms.uH.value = Math.max(S.h, .0025);
}

const tmp = new THREE.Vector3();
function updateBubbles(dt) {
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  for (let i = S.bubbles.length - 1; i >= 0; i--) {
    const b = S.bubbles[i], u = b.u; b.age += dt; u.uTime.value = S.time;
    if (b.close < 1) {
      b.close = Math.min(1, b.close + dt / .26); u.uClose.value = ease(b.close);
    }
    const damp = Math.exp(-1.15 * dt); b.v.x *= damp; b.v.z *= damp;
    const rise = (.17 + .06 / b.r) * clamp(b.age, 0, 1.4);
    b.v.y += (rise - b.v.y) * Math.min(1, dt * 1.2);
    b.m.position.addScaledVector(b.v, dt);
    b.m.position.x += Math.sin(b.age * b.swayK + b.sway) * .16 * dt;
    b.m.position.z += Math.cos(b.age * b.swayK * .7 + b.sway) * .07 * dt;
    u.uWob.value = .008 * Math.exp(-b.age * .25) + .002;
    // 화면 밖으로 나가지 않도록
    const d = camera.position.distanceTo(b.m.position), hh = d * tan, hw = hh * camera.aspect;
    const lim = Math.max(.3, hw - b.r - .25);
    const dx = b.m.position.x - camera.position.x * 0;
    if (Math.abs(dx) > lim) b.v.x -= Math.sign(dx) * dt * 1.4;
    const top = camera.position.y + (view.garden.at.y - camera.position.y) + hh * .9 - b.r;
    if (b.pop < 0 && (b.age > b.life || (b.age > 2 && b.m.position.y > top))) b.pop = 0;
    if (b.pop >= 0) {
      b.pop += dt / .38; u.uPop.value = Math.min(b.pop, 1);
      if (b.pop >= 1) {
        const c = tmp.set(0, 0, u.uH.value - filmRadius(u)).applyMatrix4(b.m.matrixWorld);
        garden.spawnSeed(c, quality.t.flowers); S.popped++;
        scene.remove(b.m); b.m.material.dispose(); S.bubbles.splice(i, 1);
      }
    }
  }
}

// ─── 조작 ────────────────────────────────────────────
function hint(t) { const e = $('hint'); if (t) e.textContent = t; e.classList.toggle('on', !!t); }

async function startMic(fromClick) {
  if (S.micBusy) return;
  if (!BreathMic.supported()) return micFail();
  mic ||= new BreathMic(+$('sens').value / 100);
  S.micBusy = true; $('micBtn').hidden = true; hint('');
  try { await mic.start(); S.micDenied = false; if (S.up && !S.blown) hint('마이크에 ‘후—’ 하고 불어 보세요'); $('micState').textContent = '마이크 켜짐. 소리는 이 기기 안에서만 처리되고 저장되지 않습니다.'; }
  catch (e) { console.warn(e); micFail(); }
  S.micBusy = false; syncUi();
}
function micFail() { S.micDenied = true; hint('아래 버튼을 길게 누르면 숨 대신 불 수 있어요'); $('micState').textContent = '마이크를 사용할 수 없습니다. 브라우저 권한을 허용하거나 버튼으로 불어 주세요.'; syncUi(); }

function syncUi() {
  const live = S.phase === 'play', micOn = !!mic?.ready;
  $('title').classList.toggle('small', S.up || S.phase !== 'play' || garden?.total > 0);
  $('micBtn').hidden = !(live && S.up && !micOn && !S.micDenied && !S.noMic);
  $('holdBtn').hidden = !(live && S.up && (S.micDenied || S.noMic));
  $('setBtn').hidden = !(live && S.up);
  if ($('setBtn').hidden) { $('settings').hidden = true; $('setBtn').setAttribute('aria-expanded', false); }
  $('gardenBtn').hidden = !(live && garden?.total > 0);
}

async function toggleWand() {
  if (S.phase !== 'play') return;
  S.up = !S.up;
  if (S.up) {
    if (!S.film) newFilm();
    if (!mic?.ready && !S.noMic && !S.micDenied) {
      if (await BreathMic.alreadyGranted()) startMic();
      else hint('막대를 들었어요. 마이크를 켜고 숨을 불어 보세요');
    } else if (mic?.ready) hint(S.blown ? '' : '마이크에 ‘후—’ 하고 불어 보세요');
    else if (!S.blown) hint('아래 버튼을 길게 눌러 불어 보세요');
  } else hint(garden.total ? '' : '막대를 눌러 들어 올리세요');
  syncUi();
}

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function overWand(e) {
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  return ray.intersectObject(hit, false).length > 0;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 14 && overWand(e)) toggleWand();
  down = null;
});
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') canvas.style.cursor = S.phase === 'play' && overWand(e) ? 'pointer' : 'default'; });
$('wandBtn').onclick = toggleWand;
$('micBtn').onclick = () => startMic(true);

const hb = $('holdBtn');
const hold = v => { S.hold = v; hb.classList.toggle('on', v); };
hb.addEventListener('pointerdown', e => { e.preventDefault(); hb.setPointerCapture(e.pointerId); hold(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => hb.addEventListener(n, () => hold(false)));
hb.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat && S.up && (S.micDenied || S.noMic) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); hold(true); } });
addEventListener('keyup', e => { if (e.code === 'Space') hold(false); });

$('setBtn').onclick = () => { const s = $('settings'); s.hidden = !s.hidden; $('setBtn').setAttribute('aria-expanded', !s.hidden); };
$('sens').oninput = e => { const v = +e.target.value; if (mic) mic.gate.sens = v / 100; try { localStorage.setItem('agape.sens', v); } catch {} };
$('noMic').onclick = () => { S.noMic = true; mic?.stop(); $('settings').hidden = true; hint('아래 버튼을 길게 눌러 불어 보세요'); syncUi(); };
$('gardenBtn').onclick = startEnding;
$('againBtn').onclick = resetAll;

// ─── 엔딩과 초기화 ─────────────────────────────────────
function startEnding() {
  S.phase = 'ending'; S.up = false; S.endT = 0; hold(false); hint(''); syncUi();
  dropFilm(); mic?.stop();
  for (const b of S.bubbles) if (b.pop < 0) b.pop = 0;
  view.endFrom = camera.position.clone();
}
function resetAll() {
  for (const b of S.bubbles) { scene.remove(b.m); b.m.material.dispose(); }
  S.bubbles = []; dropFilm(); garden.reset(); layoutGarden();
  Object.assign(S, { phase: 'play', up: false, lift: 0, camT: 0, h: 0, peak: 0, blowT: 0, hold: false, sim: { on: false, strength: 0 }, noMic: false, micDenied: false, blown: false, endT: 0, popped: 0, spawned: 0 });
  mic?.stop(); mic = null;
  $('ending').classList.remove('on'); $('ending').hidden = true; $('micState').textContent = '';
  hint('막대를 눌러 들어 올리세요'); syncUi();
}

// ─── 프레임 ──────────────────────────────────────────
const camAt = new THREE.Vector3(), haloTmp = new THREE.Vector3();
function step(dt) {
  S.time += dt;
  mic?.update(dt);
  S.lift += ((S.up ? 1 : 0) - S.lift) * Math.min(1, dt * 3.1);
  if (Math.abs((S.up ? 1 : 0) - S.lift) < .002) S.lift = S.up ? 1 : 0;
  const hasGarden = garden.total > 0 || S.spawned > 0;
  S.camT += ((S.up || hasGarden ? 1 : 0) - S.camT) * Math.min(1, dt * 1.5);

  // 카메라
  if (S.phase === 'ending') {
    S.endT += dt;
    const t = ease(clamp(S.endT / 6, 0, 1)), g = view.garden;
    const sway = Math.sin(S.endT * .16) * Math.min(1, S.endT / 8);
    const span = g.pos.z * .11;
    camera.position.set(lerp(view.endFrom.x, sway * span, t), lerp(view.endFrom.y, g.pos.y + g.pos.z * .02, t), lerp(view.endFrom.z, g.pos.z * 1.04, t));
    camAt.lerpVectors(g.at, new THREE.Vector3(0, g.at.y + g.pos.z * .015, -2), t);
    camera.lookAt(camAt);
    if (S.endT > 6.2 && $('ending').hidden) { $('ending').hidden = false; requestAnimationFrame(() => $('ending').classList.add('on')); }
  } else {
    const t = ease(S.camT);
    camera.position.lerpVectors(view.intro.pos, view.garden.pos, t);
    camAt.lerpVectors(view.intro.at, view.garden.at, t); camera.lookAt(camAt);
  }

  // 막대
  const e = ease(S.lift);
  wand.position.lerpVectors(POSE.rest.p, POSE.up.p, e);
  wand.position.y += Math.sin(e * Math.PI) * .22 + Math.sin(S.time * .9) * .035 * e;
  wand.quaternion.slerpQuaternions(POSE.rest.q, POSE.up.q, e);
  groundMat.uniforms.uFocus.value.copy(POSE.rest.p);
  groundMat.uniforms.uFocusA.value = 1 - e * .9 * (1);
  groundMat.uniforms.uGlow.value += (garden.glow - groundMat.uniforms.uGlow.value) * Math.min(1, dt);

  updateFilm(dt); updateBubbles(dt); garden.update(dt);

  // 설정의 입력 수준 표시
  if (mic?.ready && !$('settings').hidden) {
    const g = mic.gate; $('level').style.width = clamp(g.level / 40, 0, 1) * 100 + '%'; $('gate').style.left = g.gateDb / 40 * 100 + '%';
  }
  if (garden.total && $('gardenBtn').hidden) syncUi();
}

let last = 0, frozen = false;
function loop(now) {
  const raw = (now - last) / 1000; last = now;
  if (!frozen) { quality.frame(raw); step(Math.min(raw, .05)); }
  (composer ?? renderer).render(scene, camera);
}

// ─── 시작 ────────────────────────────────────────────
const gltf = new GLTFLoader(), load = u => gltf.loadAsync(u);
(async () => {
  const names = 'ABCDE'.split('');
  const [protos, w] = await Promise.all([
    Promise.all(names.map(k => load(`/glb/flower_${k}.glb`))),
    load('/glb/bubble_wand.glb'),
  ]);
  const P = Object.fromEntries(names.map((k, i) => [k, protos[i]]));
  applyGlass(w.scene, createWandMaterial()); wand.add(w.scene);
  garden = new Garden(scene, P, createGlassMaterials());
  ready = true; buildPipeline(); fit(); updateUpPose();
  addEventListener('resize', () => { fit(); updateUpPose(); });
  S.phase = 'play'; camera.position.copy(view.intro.pos); camera.lookAt(view.intro.at);
  hint('막대를 눌러 들어 올리세요'); syncUi();

  // 셰이더를 미리 컴파일해 첫 꽃이 필 때 멈칫하지 않게 함
  const warm = new THREE.Group(); for (const m of Object.values(garden.mats)) { const o = new THREE.Mesh(P.A.scene.children[0].children?.[0]?.geometry ?? new THREE.SphereGeometry(.1), m); warm.add(o); }
  scene.add(warm); warm.position.set(0, -50, 0); renderer.compile(scene, camera); scene.remove(warm);

  renderer.setAnimationLoop(loop);
  if (DEBUG) {
    window.__agape = {
      S, garden, quality, THREE, wand, P, camera, scene, renderer, toggleWand, startEnding, resetAll,
      breathe(s) { S.sim.on = s > 0; S.sim.strength = s; },
      step(sec, d = 1 / 30) { frozen = true; for (let t = 0; t < sec; t += d) step(d); },
      resume() { frozen = false; }, draw() { (composer ?? renderer).render(scene, camera); },
      calls: () => renderer.info.render.calls, mic: () => mic,
      startMic,
    };
    window.__ready = true;
  }
})().catch(e => { console.error(e); hint('작품을 불러오지 못했습니다. 새로 고침해 주세요.'); });
