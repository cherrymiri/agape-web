// AGAPE 효과음. Freesound의 실제 녹음(모두 CC0, 표기 의무 없음)을 다듬어 씁니다:
//   pop_e  "Pop 01" (Cartoon_Pop_02) by LilMati    freesound.org/s/506546  CC0
//   pop_f  "Mouth Plops.wav" by CapsLok            freesound.org/s/181907  CC0
//   bloom  "Windchime soft" by Vendarro            freesound.org/s/399538  CC0
// 소리는 첫 클릭·터치 때 켜집니다(PC·모바일 동일). 모두 짧고 음정이 있어 숨 감지(지속되는 잡음)에 잡히지 않습니다.
const LEVEL = { pop_e: 0.55, pop_f: 0.55, bloom: 0.6 };
const POPS = ['pop_e', 'pop_f'];
let ctx = null, out = null, voices = 0, lastPop = '';
const bufs = {}, last = {};

function decode(data) {
  return new Promise((ok, fail) => { const p = ctx.decodeAudioData(data, ok, fail); if (p && p.then) p.then(ok, fail); });
}
function setup() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12;
  out = ctx.createGain(); out.gain.value = 0.8; out.connect(comp).connect(ctx.destination);
  const base = import.meta.env.BASE_URL || '/';
  for (const n of Object.keys(LEVEL)) fetch(`${base}sfx/${n}.mp3`).then(r => r.arrayBuffer()).then(decode).then(b => { bufs[n] = b; }).catch(() => {});
}
function unlock() {
  setup(); if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
}
for (const e of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(e, unlock, { capture: true, passive: true });

function play(name, { gain = 1, rate = 1, kind = name, gap = 0 } = {}) {
  if (!ctx || ctx.state !== 'running' || !bufs[name] || voices >= 6) return;
  if (gap && ctx.currentTime - (last[kind] ?? -9) < gap) return;
  last[kind] = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = bufs[name]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain * LEVEL[name];
  s.connect(g).connect(out); voices++; s.onended = () => { voices--; }; s.start();
}

export const sfx = {
  // 비눗방울이 꽃에 닿아 터질 때: 두 가지 '뽁'이 섞여서, 같은 소리가 연달아 나오지 않게
  pop(size = 0.5) {
    let n = POPS[Math.floor(Math.random() * POPS.length)];
    if (n === lastPop) n = POPS[(POPS.indexOf(n) + 1) % POPS.length];
    lastPop = n;
    const k = Math.max(0, Math.min(1, size));
    play(n, { kind: 'pop', gap: 0.06, gain: 0.75 + 0.25 * Math.random(), rate: (1.12 - 0.22 * k) * (0.96 + Math.random() * 0.08) });   // 큰 방울은 조금 낮게
  },
  // 유리꽃이 다 피었을 때: 작은 풍경
  bloom() { play('bloom', { kind: 'bloom', gap: 0.5, rate: 0.97 + Math.random() * 0.06 }); },
};
