import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGlassMaterials, createWandMaterial, createGlassEnvironment, applyGlass } from './glass_materials.js';
import { BreathMic } from './breath.js';
import { Bubbles, CONFIG } from './bubbles.js';
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
  view.ringNdc.set(portrait ? .34 : .4, portrait ? .3 : .36);   // 화면 오른쪽 약 65~75% 지점
  const hwI = Di * tan * a;                                      // 놓인 막대도 오른쪽에
  POSE.rest.p.x = portrait ? hwI * .22 - .55 : hwI * .4 - 1.0;
  updateUpPose();
  view.bubbleK = portrait ? .78 : 1;
  garden && layoutGarden();
  lights();
}
function lights() { if (garden) garden.lights.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); }
function layoutGarden() {
  const keep = { p: camera.position.clone(), q: camera.quaternion.clone() };
  camera.position.copy(view.garden.pos); camera.lookAt(view.garden.at); camera.updateMatrixWorld();
  // 들어 올린 막대의 손잡이 뒤에는 꽃을 심지 않음
  const low = POSE.up.p.clone().add(new THREE.Vector3(0, -1.57 * W, 0)).project(camera);
  const top = POSE.up.p.clone().project(camera);
  garden.layout(camera, innerHeight > innerWidth ? .22 : .3, { x0: Math.min(low.x, top.x), x1: Math.max(low.x, top.x), y: low.y, pad: innerHeight > innerWidth ? .17 : .09 });
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
  rest: { p: new THREE.Vector3(.1, .13, 3.2), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .92, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)) },
  up: { p: new THREE.Vector3(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(.06, -2.42, .1)) },
};
function updateUpPose() {
  camera.position.copy(view.garden.pos); camera.lookAt(view.garden.at); camera.updateMatrixWorld();
  const v = new THREE.Vector3(view.ringNdc.x, view.ringNdc.y, .5).unproject(camera).sub(camera.position).normalize();
  const t = (3 - camera.position.z) / v.z;
  POSE.up.p.copy(camera.position).addScaledVector(v, t);
}

const bubbles = new Bubbles({ scene, wand, W, ringR: RING_R });
if (params.has('pop')) CONFIG.popRatio = clamp(+params.get('pop'), 0, 1);

// ─── 상태 ────────────────────────────────────────────
const S = {
  phase: 'loading', up: false, lift: 0, camT: 0, film: null, form: 0, h: 0, peak: 0, blowT: 0,
  time: 0, sim: { on: false, strength: 0 }, hold: false, micDenied: false, flowersSeen: 0,
  endT: 0, noMic: !!window.AGAPE_NO_MIC,
};
let mic = null, garden = null;
const sens = (() => { try { return +(localStorage.getItem('agape.sens') ?? 50); } catch { return 50; } })();
$('sens').value = sens;

function breath(dt) {
  if (S.sim.on) return S.sim.strength;
  // 대체 입력: 누르고 있는 동안 세기가 살아 움직이되, 시간이 지나도 약해지지 않음
  if (S.hold) {
    S.holdT = (S.holdT || 0) + dt;
    const t = S.holdT, p = S.holdP || 0;
    const body = .62 + .2 * Math.sin(t * .83 + p) + .12 * Math.sin(t * 2.1 + 2 * p);
    return clamp(Math.min(1, .35 + t * 2.2) * body * (1 + .16 * Math.sin(t * 5.3 + 3 * p)), .22, 1);
  }
  S.holdT = 0; S.holdP = Math.random() * 6.3;
  // 마이크: 감지된 실제 숨 그대로. 멈추면 멈추고 다시 불면 바로 이어짐
  return mic?.gate.on ? mic.gate.strength : 0;
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
  $('setBtn').hidden = !(live && S.up && !window.AGAPE_NO_MIC);
  if ($('setBtn').hidden) { $('settings').hidden = true; $('setBtn').setAttribute('aria-expanded', false); }
}

async function toggleWand() {
  if (S.phase !== 'play') return;
  S.up = !S.up;
  if (S.up) {
    bubbles.showRing();
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
// 입력은 그 손가락·마우스가 실제로 떨어질 때만 끝남 (포인터 캡처가 풀려도 유지)
let holdId = null;
const holdEnd = e => { if (holdId !== null && (!e || e.pointerId === undefined || e.pointerId === holdId)) { holdId = null; hold(false); } };
hb.addEventListener('pointerdown', e => { e.preventDefault(); holdId = e.pointerId; try { hb.setPointerCapture(e.pointerId); } catch {} hold(true); });
addEventListener('pointerup', holdEnd); addEventListener('pointercancel', holdEnd);
addEventListener('blur', () => holdEnd()); document.addEventListener('visibilitychange', () => { if (document.hidden) holdEnd(); });
hb.addEventListener('contextmenu', e => e.preventDefault());
hb.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
hb.addEventListener('selectstart', e => e.preventDefault());
addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat && S.up && (S.micDenied || S.noMic) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); hold(true); } });
addEventListener('keyup', e => { if (e.code === 'Space') hold(false); });

$('setBtn').onclick = () => { const s = $('settings'); s.hidden = !s.hidden; $('setBtn').setAttribute('aria-expanded', !s.hidden); };
$('sens').oninput = e => { const v = +e.target.value; if (mic) mic.gate.sens = v / 100; try { localStorage.setItem('agape.sens', v); } catch {} };
$('noMic').onclick = () => { S.noMic = true; mic?.stop(); $('settings').hidden = true; hint('아래 버튼을 길게 눌러 불어 보세요'); syncUi(); };
$('againBtn').onclick = resetAll;

// ─── 엔딩과 초기화 ─────────────────────────────────────
// 목표 꽃 수가 채워지면: 입력을 닫고 → 마지막 꽃이 다 필 때까지 기다린 뒤 → 막대가 물러나고 카메라가 정원을 담음
function beginFinish() {
  S.phase = 'finishing'; S.finishT = 0; holdEnd(); hold(false); hint(''); $('settings').hidden = true; syncUi();
  mic?.stop(); bubbles.releaseAll();
}
function startEnding() {
  S.phase = 'ending'; S.up = false; S.endT = 0; holdEnd(); hold(false); hint(''); syncUi();
  mic?.stop(); bubbles.releaseAll();
  view.endFrom = camera.position.clone();
}
function resetAll() {
  bubbles.clear(); garden.reset(); layoutGarden();
  Object.assign(S, { phase: 'play', up: false, lift: 0, camT: 0, h: 0, peak: 0, blowT: 0, hold: false, sim: { on: false, strength: 0 }, noMic: !!window.AGAPE_NO_MIC, micDenied: false, blown: false, endT: 0, finishT: 0 });
  holdEnd(); hold(false); mic?.stop(); mic = null;
  $('ending').classList.remove('on'); $('ending').hidden = true; $('micState').textContent = '';
  hint('막대를 눌러 들어 올리세요'); syncUi();
}

// ─── 프레임 ──────────────────────────────────────────
const END_TEXT_AT = 10;                          // 카메라가 멈춘 뒤 정원을 감상하는 시간을 둔 다음 문구 등장
const WAND_EXIT = new THREE.Vector3(11, -2.2, 3);
const camAt = new THREE.Vector3(), haloTmp = new THREE.Vector3();
function step(dt) {
  S.time += dt;
  mic?.update(dt);
  S.lift += ((S.up ? 1 : 0) - S.lift) * Math.min(1, dt * 3.1);
  if (Math.abs((S.up ? 1 : 0) - S.lift) < .002) S.lift = S.up ? 1 : 0;
  const hasGarden = garden.total > 0 || bubbles.stats.born > 0;
  S.camT += ((S.up || hasGarden ? 1 : 0) - S.camT) * Math.min(1, dt * 1.5);

  // 카메라
  if (S.phase === 'ending') {
    S.endT += dt;
    const t = ease(clamp(S.endT / 7, 0, 1)), g = view.garden;
    const sway = Math.sin(S.endT * .16) * Math.min(1, S.endT / 8);
    const span = g.pos.z * .11;
    camera.position.set(lerp(view.endFrom.x, sway * span, t), lerp(view.endFrom.y, g.pos.y + g.pos.z * .02, t), lerp(view.endFrom.z, g.pos.z * 1.04, t));
    camAt.lerpVectors(g.at, new THREE.Vector3(0, g.at.y + g.pos.z * .015, -2), t);
    camera.lookAt(camAt);
    if (S.endT > END_TEXT_AT && $('ending').hidden) { $('ending').hidden = false; requestAnimationFrame(() => $('ending').classList.add('on')); }
  } else {
    const t = ease(S.camT);
    camera.position.lerpVectors(view.intro.pos, view.garden.pos, t);
    camAt.lerpVectors(view.intro.at, view.garden.at, t); camera.lookAt(camAt);
  }

  // 막대
  const e = ease(S.lift);
  wand.position.lerpVectors(POSE.rest.p, POSE.up.p, e);
  wand.position.y += Math.sin(e * Math.PI) * .22 + Math.sin(S.time * .9) * .035 * e;
  if (S.phase === 'ending') wand.position.addScaledVector(WAND_EXIT, ease(clamp((S.endT - 1.2) / 3.4, 0, 1)));   // 내려간 뒤 화면 밖으로 물러남
  wand.quaternion.slerpQuaternions(POSE.rest.q, POSE.up.q, e);
  groundMat.uniforms.uFocus.value.copy(POSE.rest.p);
  groundMat.uniforms.uFocusA.value = 1 - e * .9 * (1);
  groundMat.uniforms.uGlow.value += (garden.glow - groundMat.uniforms.uGlow.value) * Math.min(1, dt);

  bubbles.update(dt, breath(dt), {
    active: S.phase === 'play' && S.up && S.lift > .96, lift: S.lift, camera, maxBubbles: quality.t.bubbles,
    spawnSeed: p => garden.spawnSeed(p, Math.max(quality.t.flowers, garden.goal)), portraitK: view.bubbleK,
    canSeed: popping => garden.committed + popping < garden.goal,
  });
  if (S.phase === 'play' && garden.committed + bubbles.popping >= garden.goal) beginFinish();
  if (S.phase === 'finishing' && garden.idle && !bubbles.popping) { S.finishT += dt; if (S.finishT > 1.1) startEnding(); }
  if (S.phase === 'ending' && S.lift < .04) bubbles.hideRing();
  garden.update(dt);
  if (!S.blown && bubbles.stats.born) { S.blown = true; hint(''); }

  // 설정의 입력 수준 표시
  if (mic?.ready && !$('settings').hidden) {
    const g = mic.gate; $('level').style.width = clamp(g.level / 40, 0, 1) * 100 + '%'; $('gate').style.left = g.gateDb / 40 * 100 + '%';
  }
  if (garden.total && !$('title').classList.contains('small')) syncUi();
}

let last = 0, frozen = false;
function loop(now) {
  const raw = (now - last) / 1000; last = now;
  if (!frozen) { quality.frame(raw); step(Math.min(raw, .05)); }
  (composer ?? renderer).render(scene, camera);
}

// ─── 시작 ────────────────────────────────────────────
const gltf = new GLTFLoader();
// 테스트용 단일 파일에서는 모델이 페이지 안에 들어 있음
const load = u => {
  const b64 = window.AGAPE_MODELS?.[u.split('/').pop()];
  return b64 ? gltf.parseAsync(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer, '') : gltf.loadAsync(u);
};
(async () => {
  const names = 'ABCDE'.split('');
  const [protos, w] = await Promise.all([
    Promise.all(names.map(k => load(`/glb/flower_${k}.glb`))),
    load('/glb/bubble_wand.glb'),
  ]);
  const P = Object.fromEntries(names.map((k, i) => [k, protos[i]]));
  applyGlass(w.scene, createWandMaterial()); wand.add(w.scene);
  garden = new Garden(scene, P, createGlassMaterials());
  S.bubbles = bubbles;
  if (params.has('goal')) garden.goal = Math.max(1, Math.round(+params.get('goal')));
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
      S, bubbles, CONFIG, garden, quality, THREE, wand, P, camera, scene, renderer, toggleWand, startEnding, beginFinish, resetAll,
      breathe(s) { S.sim.on = s > 0; S.sim.strength = s; },
      step(sec, d = 1 / 30) { frozen = true; for (let t = 0; t < sec; t += d) step(d); },
      resume() { frozen = false; }, draw() { (composer ?? renderer).render(scene, camera); },
      calls: () => renderer.info.render.calls, mic: () => mic,
      startMic,
    };
    window.__ready = true;
  }
})().catch(e => { console.error(e); hint('작품을 불러오지 못했습니다. 새로 고침해 주세요.'); });
