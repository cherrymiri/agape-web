// 렌더 품질 3단계. 프레임이 떨어지면 자동으로 낮추고, 넉넉하면 한 단계까지 되돌립니다.
export const MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));          // iPadOS는 Mac으로 표시됨
// PC: 아이맥 같은 큰 레티나 화면에서 2배로 그리면 비눗방울이 많아질 때 버거워 렉이 걸림 →
// 화면 전체 픽셀 수(budget)로 상한을 둬서, 화면이 커도 그리는 양이 일정하게 유지되게 함
const PC_TIERS = [
  { name: 'low', pixel: 1, bloom: false, samples: 0, bubbles: 26, flowers: 54, budget: 2.6e6 },
  { name: 'mid', pixel: 1.25, bloom: true, samples: 0, bubbles: 34, flowers: 80, budget: 3.6e6 },
  { name: 'high', pixel: 2, bloom: true, samples: 4, bubbles: 42, flowers: 110, budget: 4.2e6 },
];
// 휴대폰·태블릿: 화면(CSS 픽셀)이 작고 DPR이 2~3이라 PC 값(1~1.25배)을 쓰면 흐리고 계단이 생김.
// 선명도는 2배까지 확보하고, 화면 전체 픽셀 수(budget)로 상한을 둬 큰 태블릿에서 과부하를 막음.
// 빛번짐을 쓰는 단계는 화면 대신 렌더 타깃에 그리므로 안티앨리어싱(samples)을 따로 켬.
const MOBILE_TIERS = [
  { name: 'low', pixel: 1.5, bloom: false, samples: 0, bubbles: 26, flowers: 54, budget: 2.2e6 },
  { name: 'mid', pixel: 2, bloom: true, samples: 4, bubbles: 34, flowers: 80, budget: 3e6 },
  { name: 'high', pixel: 2, bloom: true, samples: 4, bubbles: 42, flowers: 110, budget: 3.6e6 },
];
export const TIERS = MOBILE ? MOBILE_TIERS : PC_TIERS;
// 휴대폰은 저전력 모드에서 30fps로 묶이므로 그 정도로는 단계를 내리지 않음
const LOW_FPS = MOBILE ? 24 : 34;
export class Quality {
  constructor(apply, forced) {
    const cores = navigator.hardwareConcurrency || 4;
    this.tier = forced ?? 1;   // 중간 단계로 시작: 높은 단계로 시작했다가 비눗방울이 많아지는 순간 단계가 내려가며 멈칫하던 문제 방지
    void cores;
    this.locked = forced != null; this.apply = apply; this.acc = 0; this.n = 0; this.good = 0; this.raises = 0; this.fps = 60;
    apply(TIERS[this.tier]);
  }
  get t() { return TIERS[this.tier]; }
  frame(dt) {
    if (dt > .5) return;                     // 탭 전환 등은 무시
    this.acc += dt; this.n++;
    if (this.acc < 2) return;
    const fps = this.fps = this.n / this.acc; this.acc = 0; this.n = 0;
    if (this.locked) return;
    if (fps < LOW_FPS && this.tier > 0) { this.tier--; this.good = 0; this.dropped = true; this.apply(this.t); }
    else if (fps > 57 && this.tier < 2 && this.raises < 1 && !this.dropped) {   // 한 번 내려간 뒤엔 다시 올리지 않음 (오르내리며 멈칫하지 않게)
       if (++this.good >= 6) { this.tier++; this.raises++; this.good = 0; this.apply(this.t); } }
    else this.good = 0;
  }
}
