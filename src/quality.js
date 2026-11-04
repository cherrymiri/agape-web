// 렌더 품질 3단계. 프레임이 떨어지면 자동으로 낮추고, 넉넉하면 한 단계까지 되돌립니다.
export const TIERS = [
  { name: 'low', pixel: 1, bloom: false, samples: 0, bubbles: 7, flowers: 54 },
  { name: 'mid', pixel: 1.25, bloom: true, samples: 0, bubbles: 10, flowers: 80 },
  { name: 'high', pixel: 2, bloom: true, samples: 4, bubbles: 14, flowers: 110 },
];
export class Quality {
  constructor(apply, forced) {
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    this.tier = forced ?? (mobile || cores <= 4 ? 1 : 2);
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
    if (fps < 34 && this.tier > 0) { this.tier--; this.good = 0; this.apply(this.t); }
    else if (fps > 57 && this.tier < 2 && this.raises < 1) { if (++this.good >= 6) { this.tier++; this.raises++; this.good = 0; this.apply(this.t); } }
    else this.good = 0;
  }
}
