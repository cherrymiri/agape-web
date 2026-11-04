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
import { Garden, GARDEN } from './garden.js';

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

// ─── 카메라 맞춤 ──────────────────────────────────────
const view = { garden: { pos: new THREE.Vector3(), at: new THREE.Vector3() }, ringNdc: new THREE.Vector2() };
function fit() {
  const w = innerWidth, h = innerHeight, a = w / h, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false);
  composer?.setSize(w, h); composer?.setPixelRatio?.(pixelRatio());
  camera.aspect = a; camera.updateProjectionMatrix();
  const portrait = a < .85;
  const D = Math.max(3.25 / tan, 3.4 / (tan * a));
  const halfH = D * tan;
  view.garden.at.set(0, halfH * .78 - .45, 0);
  view.garden.pos.set(0, view.garden.at.y + D * .2, D);
  view.ringNdc.set(portrait ? .34 : .4, portrait ? .38 : .42);   // 화면 오른쪽 약 65~75% 지점
  updateUpPose();
  // 놓인 막대: 오른쪽 아래, 꽃봉오리 앞
  const v = new THREE.Vector3(portrait ? .52 : .6, portrait ? -.74 : -.6, .5).unproject(camera).sub(camera.position).normalize();
  POSE.rest.p.copy(camera.position).addScaledVector(v, (3.2 - camera.position.z) / v.z);
  view.bubbleK = portrait ? .66 : .8;
  camera.position.copy(view.garden.pos); camera.lookAt(view.garden.at); camAt.copy(view.garden.at);
  lights();
}
function lights() { if (garden) garden.lights.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); }
function layoutGarden() {
  const portrait = innerHeight > innerWidth;
  garden.layout(portrait ? 2.7 : Math.min(5.6, 5.6 * camera.aspect / 1.6), portrait ? 6.8 : 3.6);
  garden.needK = (+params.get('need') || 1) * (portrait ? .84 : 1);
  garden.plantAll();
}
/** 다 핀 꽃들이 화면 중심에 오도록 엔딩 구도를 계산. 문구 자리는 위쪽에 남김 */
function solveEnd() {
  const portrait = camera.aspect < .85, pts = [], flowers = garden.slots;
  for (const s of flowers) for (const dx of [-.62, .62]) for (const dy of [0, 1.42]) pts.push(new THREE.Vector3(s.x + dx, s.y + dy, s.z));
  const box = new THREE.Box3().setFromPoints(pts), c = box.getCenter(new THREE.Vector3());
  const yHi = portrait ? .4 : .36, yLow = portrait ? -.8 : -.84, xLim = .92;
  const el = THREE.MathUtils.degToRad(portrait ? 23 : 12), dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
  const cam = camera.clone(), p = new THREE.Vector3();
  let at = c.clone();
  for (let d = 7; d < 70; d += .4) {
    at = c.clone();
    let lo, hi, mx;
    for (let i = 0; i < 8; i++) {
      cam.position.copy(at).addScaledVector(dir, d); cam.lookAt(at); cam.updateMatrixWorld(true);
      lo = 9; hi = -9; mx = 0;
      for (const q of pts) { p.copy(q).project(cam); lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); mx = Math.max(mx, Math.abs(p.x)); }
      at.y += (lo - yLow) * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * .9;
    }
    if (hi <= yHi && mx <= xLim) break;
  }
  view.end = { pos: cam.position.clone(), at: at.clone() };
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
  up: { p: new THREE.Vector3(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(.06, -2.42, .1)) },
};
function updateUpPose() {
  camera.position.copy(view.garden.pos); camera.lookAt(view.garden.at); camera.updateMatrixWorld();
  const v = new THREE.Vector3(view.ringNdc.x, view.ringNdc.y, .5).unproject(camera).sub(camera.position).normalize();
  const t = (3 - camera.position.z) / v.z;
  POSE.up.p.copy(camera.position).addScaledVector(v, t);
}

const bubbles = new Bubbles({ scene, wand, W, ringR: RING_R });
if (params.has('drift')) CONFIG.driftRatio = clamp(+params.get('drift'), 0, 1);

// ─── 상태 ────────────────────────────────────────────
const S = {
  phase: 'loading', up: false, lift: 0, camT: 0, film: null, form: 0, h: 0, peak: 0, blowT: 0,
  time: 0, sim: { on: false, strength: 0 }, hold: false, micDenied: false, flowersSeen: 0,
  endT: 0, exitT: 0, quietT: 0, readyT: 0, noteT: -1, playT: 0, noMic: !!window.AGAPE_NO_MIC,
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
  $('title').classList.toggle('small', !!(S.up || S.phase !== 'play' || S.blown));
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
  } else hint(S.blown ? '' : '막대를 눌러 들어 올리세요');
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
// 20번째 꽃이 완전히 피는 순간 시작. 막대 퇴장·카메라·마지막 방울이 동시에 진행됨
function startEnding() {
  S.phase = 'ending'; S.endT = 0; S.exitT = 0; hint(''); syncUi();
  view.endFrom = camera.position.clone(); view.endAtFrom = camAt.clone();
  view.exitX = 7 + (camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  solveEnd(); bubbles.settle();
}
function resetAll() {
  bubbles.clear(); garden.reset(); layoutGarden(); $('note').classList.remove('on');
  Object.assign(S, { phase: 'play', up: false, lift: 0, camT: 0, h: 0, peak: 0, blowT: 0, hold: false, sim: { on: false, strength: 0 }, noMic: !!window.AGAPE_NO_MIC, micDenied: false, blown: false, endT: 0, exitT: 0, quietT: 0, readyT: 0, noteT: -1, playT: 0 });
  holdEnd(); hold(false); mic?.stop(); mic = null;
  $('ending').classList.remove('on'); $('ending').hidden = true; $('micState').textContent = '';
  hint('막대를 눌러 들어 올리세요'); syncUi();
}

// ─── 프레임 ──────────────────────────────────────────
const END_TEXT_AT = 3.6;                         // 마지막 꽃 개화 후 문구가 나타나기까지 (초)
const END_CAMERA_TIME = 3;                     // 카메라가 정원 구도로 옮겨 가는 시간 (초)
const WAND_EXIT_TIME = 1.5;                      // 막대가 오른쪽으로 물러나는 시간 (초). 이 동안 방울이 계속 나옴
const QUIET_BEFORE_END = 2;                      // 정원이 자란 뒤 숨이 이만큼 멎으면 엔딩 (초)
const READY_MAX_WAIT = 12;                       // 계속 불고 있어도 이 시간이 지나면 막대가 천천히 물러남 (초)
const AFTERBREATH = .6;                          // 입력이 없어도 퇴장 중 이어지는 마지막 숨의 세기
const camAt = new THREE.Vector3(), haloTmp = new THREE.Vector3();
function step(dt) {
  S.time += dt;
  mic?.update(dt);
  S.lift += ((S.up ? 1 : 0) - S.lift) * Math.min(1, dt * 3.1);
  if (Math.abs((S.up ? 1 : 0) - S.lift) < .002) S.lift = S.up ? 1 : 0;

  // 카메라
  if (S.phase === 'ending') {
    S.endT += dt;
    const t = ease(clamp(S.endT / END_CAMERA_TIME, 0, 1));
    camera.position.lerpVectors(view.endFrom, view.end.pos, t);
    camera.position.x += Math.sin(S.endT * .22) * .16 * t;
    camAt.lerpVectors(view.endAtFrom, view.end.at, t);
    camera.lookAt(camAt);
    if (S.endT > END_TEXT_AT && $('ending').hidden) { $('ending').hidden = false; requestAnimationFrame(() => $('ending').classList.add('on')); }
  } else {
    camera.position.copy(view.garden.pos); camAt.copy(view.garden.at); camera.lookAt(camAt);
  }

  // 막대
  const e = ease(S.lift);
  wand.position.lerpVectors(POSE.rest.p, POSE.up.p, e);
  wand.position.y += Math.sin(e * Math.PI) * .22 + Math.sin(S.time * .9) * .035 * e;
  if (S.phase === 'ending') {                      // 오른쪽으로 부드럽게 퇴장
    const wasOut = S.exitT >= 1; S.exitT = Math.min(1, S.exitT + dt / WAND_EXIT_TIME);
    const x = ease(S.exitT); wand.position.x += view.exitX * x * x; wand.position.y += .5 * x;
    if (S.exitT >= 1 && !wasOut) { holdEnd(); hold(false); mic?.stop(); }   // 막대가 사라진 순간 입력 종료
  }
  wand.quaternion.slerpQuaternions(POSE.rest.q, POSE.up.q, e);

  const exiting = S.phase === 'ending' && S.exitT < 1;
  const input = breath(dt), blow = exiting ? Math.max(input, AFTERBREATH * (1 - .55 * S.exitT)) : input;
  bubbles.update(dt, blow, {
    active: (S.phase === 'play' || exiting) && S.up && S.lift > .96, lift: S.lift, camera, maxBubbles: quality.t.bubbles,
    garden, portraitK: view.bubbleK,
  });
  garden.update(dt, S.phase === 'ending');
  if (S.phase === 'play') {
    if (bubbles.stats.born) S.playT += dt;
    // 체험 중 문구: 닿는 모습과 떠나는 모습을 어느 정도 본 뒤 한 번만
    if (S.noteT < 0 && bubbles.stats.hits >= 6 && bubbles.stats.flew >= 2) { S.noteT = 0; $('note').classList.add('on'); }
    if (S.noteT >= 0 && S.noteT < 7.5) { S.noteT += dt; if (S.noteT >= 7) $('note').classList.remove('on'); }
    // 엔딩 판단: 정원이 충분히 자랐고, 관람객의 숨이 잦아들었을 때. 계속 불고 있으면 기다림
    S.quietT = input > 0 ? 0 : S.quietT + dt;
    if (garden.ready) { S.readyT += dt; if (S.quietT > QUIET_BEFORE_END || S.readyT > READY_MAX_WAIT) startEnding(); }
  }
  if (S.phase === 'ending' && S.exitT >= 1 && !bubbles.buds.length) bubbles.hideRing();
  if (!S.blown && bubbles.stats.born) { S.blown = true; hint(''); }

  // 설정의 입력 수준 표시
  if (mic?.ready && !$('settings').hidden) {
    const g = mic.gate; $('level').style.width = clamp(g.level / 40, 0, 1) * 100 + '%'; $('gate').style.left = g.gateDb / 40 * 100 + '%';
  }
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
  if (params.has('count')) garden.goal = Math.max(1, Math.round(+params.get('count')));
  ready = true; buildPipeline(); fit(); updateUpPose();
  addEventListener('resize', () => { fit(); updateUpPose(); });
  S.phase = 'play'; layoutGarden();
  hint('막대를 눌러 들어 올리세요'); syncUi();

  // 셰이더를 미리 컴파일해 첫 꽃이 필 때 멈칫하지 않게 함
  renderer.compile(scene, camera);

  renderer.setAnimationLoop(loop);
  if (DEBUG) {
    window.__agape = {
      S, bubbles, CONFIG, garden, quality, THREE, wand, P, camera, scene, renderer, toggleWand, startEnding, resetAll,
      breathe(s) { S.sim.on = s > 0; S.sim.strength = s; },
      step(sec, d = 1 / 30) { frozen = true; for (let t = 0; t < sec; t += d) step(d); },
      resume() { frozen = false; }, draw() { (composer ?? renderer).render(scene, camera); },
      calls: () => renderer.info.render.calls, mic: () => mic,
      startMic,
    };
    window.__ready = true;
  }
})().catch(e => { console.error(e); hint('작품을 불러오지 못했습니다. 새로 고침해 주세요.'); });
