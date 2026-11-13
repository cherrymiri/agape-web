// A0 판넬용 엔딩 캡처: 배포 빌드 그대로 (웹 코드 변경 없음). SCALE=2 → 3840×2160, SCALE=4 → 7680×4320
const {serve,launch}=require('./lib.cjs');const O='/home/claude/agape-web/export/panel/';const K=+(process.env.SCALE||2);
(async()=>{const s=serve(),b=await launch();
const pg=await (await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:K})).newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
pg.setDefaultTimeout(900000);
await pg.goto('http://localhost:8766/?debug&tier=2');await pg.waitForFunction('window.__ready');
await pg.evaluate(K=>{const A=__agape;A.renderer.setAnimationLoop(null);
 // 최고 품질 단계에 픽셀 배율만 화면 배율까지 허용 (웹의 품질 전환 함수 그대로 사용)
 A.quality.apply({...A.quality.t,pixel:K});
 window.__seed=n=>{let a=n>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
 // 관람객이 막대를 들고 계속 불어 30송이를 모두 피우는 과정 그대로
 window.__run=seed=>{__seed(seed);A.resetAll();A.toggleWand();A.S.blown=true;A.step(3);A.breathe(.7);let t=0;while(A.S.phase==='play'&&t<180){A.step(1/30);t+=1/30}A.breathe(0);return t};
},K);
// 1차: 엔딩 비눗방울이 화면에 고르게 떠 있는 순간 찾기 (연출은 그대로, 시점만 고름)
const pick=await pg.evaluate(()=>{const A=__agape,T=A.THREE,c=A.camera;__run(7);let best=null,f=0;
 while(A.S.endT<40){A.step(1/30);if(++f%10||A.S.endT<4)continue;c.updateMatrixWorld();
  let n=0,big=0,edge=0;for(const b of A.bubbles.list){const v=b.m.getWorldPosition(new T.Vector3()).project(c);if(Math.abs(v.x)<.88&&Math.abs(v.y)<.9){n++;if(b.r>.1)big++}else if(Math.abs(v.x)<1.15)edge++}
  const sc=Math.min(n,8)+Math.min(big,2)*.7-edge*.4;if(!best||sc>best.sc)best={sc:+sc.toFixed(1),t:A.S.endT,n,big}}
 return best});
console.log('pick',JSON.stringify(pick));
const shot=async n=>{await pg.evaluate(()=>{document.getElementById('hint').classList.remove('on');__agape.draw()});await pg.waitForTimeout(400);await pg.screenshot({path:O+n,type:'png'});console.log('saved',n)};
const tag=K===2?'4K':'8K';
// 2차: 같은 난수로 다시 진행 → 문구 직전 장면
const t=await pg.evaluate(()=>{const t=__run(7);const A=__agape;while(A.S.endT<2.7)A.step(1/30);return{t,opened:A.garden.opened,phase:A.S.phase}});
console.log(JSON.stringify(t));await pg.waitForTimeout(3000);   // 제목·안내 문구가 실제처럼 사라지는 CSS 전환 대기
await shot(`agape_ending_before_text_${tag}.png`);
// 고른 순간 → 문구 있음 / 문구 없음
await pg.evaluate(t=>{const A=__agape;while(A.S.endT<t-1e-6)A.step(1/30)},pick.t);await pg.waitForTimeout(2600);
await shot(`agape_ending_with_text_${tag}.png`);
await pg.evaluate(()=>{document.getElementById('ending').style.visibility='hidden'});await shot(`agape_ending_no_text_${tag}.png`);
console.log(errs);await b.close();s.close()})();
