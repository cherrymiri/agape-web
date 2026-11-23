import { setMicActive } from './iosAudio.js';
// 숨소리 감지. 마이크 신호는 이 파일 안에서 수치로만 계산되고 저장·전송되지 않습니다.
// 숨 = 지속되고(>약 0.1초) 주변보다 크며 음정이 없는(비주기적) 넓은 대역의 소리.
// 말소리는 성대 진동 때문에 주기성이 높아 걸러지고, 손뼉·키보드는 지속 시간에서 걸러집니다.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 한 프레임의 특징값. 순수 함수 */
export function analyzeFrame(t, spec, sampleRate, fftSize) {
  let e = 0;
  for (let i = 0; i < t.length; i++) e += t[i] * t[i];
  const rms = Math.sqrt(e / t.length);
  const db = 20 * Math.log10(rms + 1e-7);

  // 주기성: 80~400Hz 기본주파수 범위의 정규화 자기상관 최댓값
  const dec = Math.max(1, Math.round(sampleRate / 12000));
  const n = Math.floor(t.length / dec);
  const minLag = Math.floor(sampleRate / dec / 400), maxLag = Math.min(Math.floor(sampleRate / dec / 80), n >> 1);
  let periodicity = 0;
  if (rms > 1e-5) {
    let e0 = 0;
    for (let i = 0; i < n - maxLag; i++) e0 += t[i * dec] ** 2;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0, e1 = 0;
      for (let i = 0; i < n - maxLag; i++) { const a = t[i * dec], b = t[(i + lag) * dec]; c += a * b; e1 += b * b; }
      const r = c / (Math.sqrt(e0 * e1) + 1e-12);
      if (r > periodicity) periodicity = r;
    }
  }

  // 스펙트럼 평탄도: 100Hz~6kHz (1에 가까울수록 잡음 같음)
  const hz = sampleRate / fftSize;
  const lo = Math.max(1, Math.round(100 / hz)), hi = Math.min(spec.length - 1, Math.round(6000 / hz));
  let lg = 0, ar = 0, c = 0;
  for (let i = lo; i <= hi; i++) { const p = Math.pow(10, clamp(spec[i], -140, 0) / 10); lg += Math.log(p + 1e-14); ar += p; c++; }
  const flatness = Math.exp(lg / c) / (ar / c + 1e-14);
  return { rms, db, periodicity, flatness };
}

/** 프레임 특징 → 숨 상태. Web Audio와 분리되어 있어 합성 신호로 시험할 수 있습니다 */
export class BreathGate {
  constructor(sensitivity = 1) { this.sens = sensitivity; this.reset(); }
  reset() { this.floor = null; this.cal = []; this.on = false; this.above = 0; this.below = 0; this.strength = 0; this.level = 0; }
  get gateDb() { return 26 - 18 * this.sens; }         // 감도 0→주변+26dB, 1→주변+8dB
  push(f, dt) {
    if (this.floor === null) {                         // 시작 후 0.6초: 주변 소음 측정
      this.cal.push(f.db);
      if (this.cal.length * dt > .6) { this.cal.sort((a, b) => a - b); this.floor = Math.max(this.cal[this.cal.length >> 1], -75); }
      return;
    }
    const level = this.level = f.db - this.floor, g = this.gateDb;
    // 숨 = 음정이 없는 소리. 마이크에 직접 불면 낮은 '웅—' 바람 소리(평탄도 낮음)가 대부분이라
    // 평탄도가 낮아도 주기성이 확실히 낮으면 숨으로 인정. 말소리(모음)는 주기성이 높아 그대로 걸러짐
    const breathy = f.periodicity < .55 || (f.periodicity < .62 && f.flatness > .06);
    const raw = breathy && level > (this.on ? g - 5 : g);
    if (raw) { this.above += dt; this.below = 0; } else { this.below += dt; this.above = 0; }
    if (!this.on && this.above > .09) this.on = true;
    if (this.on && this.below > .14) this.on = false;
    if (!this.on && !raw) {                            // 주변 소음 추적: 내려갈 땐 빠르게, 올라갈 땐 느리게
      this.floor += (f.db < this.floor ? clamp(f.db - this.floor, -30 * dt, 0) : clamp(f.db - this.floor, 0, 1.5 * dt));
      this.floor = Math.max(this.floor, -80);
    }
    const target = this.on ? clamp((level - g + 5) / 26, .08, 1) : 0;
    this.strength += (target - this.strength) * Math.min(1, dt * 14);
  }
}

export class BreathMic {
  constructor(sens) { this.gate = new BreathGate(sens); this.ready = false; }
  static supported() { return !!(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext)); }
  static async alreadyGranted() {
    try { return (await navigator.permissions.query({ name: 'microphone' })).state === 'granted'; } catch { return false; }
  }
  // 순서는 잘 작동하는 EROS와 같게: 마이크 권한 → 오디오 컨텍스트 → 분석기.
  // (오디오를 먼저 켜 두면 마이크가 켜질 때 기기 오디오 설정이 바뀌면서 입력이 무음이 되는 경우가 있음)
  async start() {
    if (this.ready) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });   // 브라우저 소리 처리는 모두 끔 (숨소리를 깎거나 효과음이 날 때 입력을 눌러 버림)
    } catch (e) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e;   // 권한 거부는 다시 시도해도 같음
      await new Promise(r => setTimeout(r, 400));
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });   // 세부 조건을 못 맞추거나 장치가 잠깐 바빴던 경우 한 번 더
    }
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = new C();
    await Promise.race([this.ctx.resume?.().catch(() => {}), new Promise(r => setTimeout(r, 1200))]);   // 못 깨어나면 다음 터치 때 wake()
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0;
    this.src = this.ctx.createMediaStreamSource(this.stream);
    setMicActive(true);
    this.src.connect(this.an);                       // 출력(스피커)에는 연결하지 않음
    this.t = new Float32Array(this.an.fftSize);
    this.f = new Float32Array(this.an.frequencyBinCount);
    this.gate.reset();
    this.deadT = 0; this.offT = 0; this.chkT = 0;
    this.ready = true;
  }
  /** 화면 잠금·탭 전환·전화 등으로 멈춘 오디오를 다시 깨움. 터치 이벤트 안에서 부르면 iOS에서도 확실히 깨어남 */
  wake() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); }
  /** 마이크 트랙이 끊겼는지 (iOS는 백그라운드로 가면 트랙을 끊기도 함) */
  get lost() { return this.ready && this.stream?.getAudioTracks().every(t => t.readyState === 'ended'); }
  get running() { return this.ready && this.ctx?.state === 'running'; }
  /** 체험 도중 마이크가 죽었는지: 트랙 끊김·음소거, 완전한 무음(실제 마이크는 0이 나오지 않음), 오디오가 계속 멈춤 */
  get stuck() {
    if (!this.ready) return false;
    const tr = this.stream?.getAudioTracks()[0];
    return !tr || tr.readyState === 'ended' || this.deadT > 2.5 || this.offT > 3;
  }
  update(dt) {
    if (!this.ready) return;
    dt = Math.min(dt, .1);
    // 1초마다 상태 점검: 멈춘 오디오는 다시 깨움 (효과음 재생·이어폰 연결 변화 등으로 멈추는 경우)
    if ((this.chkT += dt) > 1) { this.chkT = 0; if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); }
    if (this.ctx.state !== 'running') { this.offT += dt; this.gate.on = false; this.gate.strength = 0; this.gate.level = 0; return; }
    this.offT = 0;
    this.an.getFloatTimeDomainData(this.t);
    this.an.getFloatFrequencyData(this.f);
    const fr = analyzeFrame(this.t, this.f, this.ctx.sampleRate, this.an.fftSize);
    const tr = this.stream.getAudioTracks()[0];
    // 완전한 무음이거나, 같은 소리 조각이 그대로 반복되면(입력이 더 이상 들어오지 않음) 죽은 것으로 봄
    const t = this.t, sig = t[0] + t[97] * 3 + t[511] * 7 + t[1500] * 11, same = sig === this.sig; this.sig = sig;
    this.deadT = fr.rms < 1e-6 || same || tr?.muted ? this.deadT + dt : 0;
    this.gate.push(fr, dt);
  }
  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    setMicActive(false);
    this.ctx?.close?.()?.catch?.(() => {});
    this.stream = this.ctx = this.an = this.src = null; this.ready = false; this.gate.reset();
  }
}
