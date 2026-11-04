const {serve,launch}=require('./lib.cjs');const R=[];const ok=(n,c,x='')=>{R.push(c);console.log(c?'PASS':'FAIL',n,typeof x=='string'?x:JSON.stringify(x))};
(async()=>{const s=serve(),b=await launch();
const open=async(q,w=1280,h=720,t=false)=>{const c=await b.newContext({viewport:{width:w,height:h},hasTouch:t});const pg=await c.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8766/?debug&tier=0'+q);await pg.waitForFunction('window.__ready',{timeout:90000});await pg.evaluate(()=>{__agape.toggleWand();__agape.step(4);__agape.resume();document.getElementById('setBtn').click()});await pg.click('#noMic');await pg.waitForSelector('#holdBtn:not([hidden])');return pg};
const press=async pg=>{const bx=await pg.locator('#holdBtn').boundingBox();await pg.mouse.move(bx.x+20,bx.y+15);await pg.mouse.down();await pg.waitForTimeout(120)};
// 1. 12초 연속 누르기
{const pg=await open('&goal=99999');await press(pg);
 const r=await pg.evaluate(()=>{const A=__agape,B=A.bubbles;const t0=B.t;A.step(12);const T=B.stats.times.filter(x=>x>=t0),gaps=T.slice(1).map((x,i)=>x-T[i]);return{n:T.length,maxGap:Math.max(...gaps),last:T.at(-1)-t0,sz:B.stats.sizes.slice(-T.length),gaps,hold:A.S.hold}});
 const m=r.gaps.reduce((a,c)=>a+c,0)/r.gaps.length,cv=Math.sqrt(r.gaps.reduce((a,c)=>a+(c-m)**2,0)/r.gaps.length)/m,sz=[...r.sz].sort((a,b)=>a-b);
 ok('12초 누르기: 입력 유지',r.hold);ok('12초 누르기: 끊김 없이 생성',r.maxGap<2&&r.last>10.5,{n:r.n,최대간격:+r.maxGap.toFixed(2),마지막:+r.last.toFixed(1)});ok('지속 중 간격 불규칙',cv>.6,{cv:+cv.toFixed(2)});ok('지속 중 크기 다양',sz.at(-1)/sz[0]>6,{min:sz[0],max:sz.at(-1)});
 const seg=await pg.evaluate(()=>{const A=__agape,B=A.bubbles,t0=B.t;A.step(12);const T=B.stats.times.filter(x=>x>=t0);return[0,1,2,3].map(i=>T.filter(x=>x-t0>=i*3&&x-t0<(i+1)*3).length)});ok('후반에도 생성량 유지',seg.every(x=>x>=2),seg);
 await pg.evaluate(()=>__agape.resume());await pg.mouse.up();await pg.waitForTimeout(150);
 const st=await pg.evaluate(()=>{const A=__agape,B=A.bubbles;A.step(.5);const n=B.stats.born;A.step(5);return{hold:A.S.hold,d:B.stats.born-n,buds:B.buds.length}});ok('놓으면 생성 중단',!st.hold&&st.d===0&&st.buds===0,st);
 await pg.evaluate(()=>__agape.resume());await press(pg);const re=await pg.evaluate(()=>{const A=__agape,B=A.bubbles,n=B.stats.born;A.step(.05);const bud=B.buds.length;A.step(1.5);return{bud,d:B.stats.born-n}});ok('다시 누르면 즉시 재개',re.bud>=1&&re.d>=1,re);await pg.evaluate(()=>__agape.resume());await pg.mouse.up();
 // 포인터 이벤트 안정성
 await press(pg);await pg.evaluate(()=>{const h=document.getElementById('holdBtn');h.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:1,bubbles:true}));h.dispatchEvent(new PointerEvent('pointerleave',{pointerId:1}));h.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,bubbles:true}))});ok('캡처 풀림·이탈에도 입력 유지',await pg.evaluate(()=>__agape.S.hold));await pg.mouse.up();await pg.waitForTimeout(100);ok('실제 놓으면 해제',!(await pg.evaluate(()=>__agape.S.hold)));ok('오류 없음',!pg.errs.length,pg.errs.join('|'));await pg.context().close()}
// 2. 자동 엔딩: PC·모바일, 품질 무관
for(const [n,q,w,h] of [['PC 저품질','',1280,720],['PC 고품질 설정','&tier=2',1280,720],['모바일','',390,844]]){
 const pg=await open(q,w,h);
 ok(n+' 정원 보기 버튼 없음',await pg.evaluate(()=>!document.getElementById('gardenBtn')));
 await press(pg);
 const log=await pg.evaluate(()=>{const A=__agape,B=A.bubbles,G=A.garden;let peak=0,finAt=null,endAt=null,atEnd=null,textEarly=false,grew=0,bornAtFin=null,t=0;
  for(let i=0;i<3600;i++){A.step(1/30);t+=1/30;peak=Math.max(peak,G.committed+B.popping);
   if(!finAt&&A.S.phase==='finishing'){finAt=t;bornAtFin=null;A.S._c=1}
   if(finAt&&bornAtFin===null&&A.S.phase!=='play'){bornAtFin=B.stats.born+B.buds.length}
   if(!endAt&&A.S.phase==='ending'){endAt=t;atEnd={done:G.done.length,grow:G.growing.length,seed:G.seeds.length,pop:B.popping}}
   if(!document.getElementById('ending').hidden){if(!A.S.textAt)A.S.textAt=t;break}}
  return{peak,finAt,endAt,atEnd,textAt:A.S.textAt,done:G.done.length,total:G.total,born:B.stats.born,popped:B.stats.popped,flew:B.stats.flew,bornAtFin,up:A.S.up,hold:A.S.hold,c:G.counts,left:B.list.length,wandX:A.wand.position.x}});
 console.log(n,JSON.stringify(log));
 ok(n+' 자동 엔딩 실행',log.finAt&&log.endAt&&log.textAt);ok(n+' 꽃 정확히 20',log.done===20&&log.total===20&&log.peak<=20,{done:log.done,peak:log.peak});
 ok(n+' 터진 수=꽃 수',log.popped===20,log.popped);ok(n+' 마지막 개화 후 전환',log.atEnd.done===20&&log.atEnd.grow===0&&log.atEnd.seed===0&&log.atEnd.pop===0,log.atEnd);ok(n+' 감상 시간',log.textAt-log.endAt>=9.5,+(log.textAt-log.endAt).toFixed(1));ok(n+' 목표 후 새 방울 없음',log.born<=log.bornAtFin,[log.bornAtFin,log.born]);
 await pg.evaluate(()=>{__agape.draw()});await pg.waitForTimeout(100);await pg.mouse.up();await pg.evaluate(()=>{__agape.step(.1);__agape.resume()});await pg.waitForTimeout(3000);await pg.screenshot({path:`tests/g_${n}.png`});
 const vis=await pg.evaluate(()=>document.body.innerText.split('\n').map(x=>x.trim()).filter(Boolean).filter(x=>{return true}));
 const shown=await pg.evaluate(()=>[...document.querySelectorAll('button,p,h1')].filter(e=>e.offsetParent!==null&&!e.classList.contains('sr')&&getComputedStyle(e).opacity!=='0').map(e=>e.textContent.trim()).filter(Boolean));console.log(n,'표시',shown);
 ok(n+' 엔딩 문구·버튼만',shown.includes('사랑을 주는 데 이유가 필요해?')&&shown.includes('Do I need a reason to give love?')&&shown.includes('다시 하기')&&shown.filter(x=>!/AGAPE|무조건적|사랑을 주는|Do I need|다시 하기/.test(x)).length===0,shown);
 await pg.click('#againBtn');await pg.waitForTimeout(300);
 const st=await pg.evaluate(()=>{const A=__agape,g=A.garden,B=A.bubbles;return{ph:A.S.phase,up:A.S.up,hold:A.S.hold,lift:A.S.lift,cam:A.S.camT,b:B.list.length,buds:B.buds.length,ring:!!B.ring,born:B.stats.born,t:g.total,d:g.done.length,seed:g.seeds.length,inst:g.pools.map.size,end:document.getElementById('ending').hidden}});
 ok(n+' 다시 하기 초기화',st.ph==='play'&&!st.up&&!st.hold&&st.b===0&&!st.ring&&st.born===0&&st.t===0&&st.seed===0&&st.inst===0&&st.end&&st.cam===0,st);
 // 두 번째 관람객
 const two=await pg.evaluate(()=>{const A=__agape;A.toggleWand();A.step(4);A.S.noMic=true;A.breathe(.8);for(let i=0;i<3000&&A.S.phase==='play';i++)A.step(1/30);A.breathe(0);for(let i=0;i<1200&&A.S.phase!=='ending';i++)A.step(1/30);return{ph:A.S.phase,done:A.garden.done.length}});ok(n+' 두 번째 체험도 20송이',two.ph==='ending'&&two.done===20,two);ok(n+' 오류 없음',!pg.errs.length,pg.errs.join('|'));await pg.context().close()}
// 3. 목표 상수 변경
{const pg=await open('&goal=5');const r=await pg.evaluate(()=>{const A=__agape;A.breathe(.8);for(let i=0;i<2400&&A.S.phase==='play';i++)A.step(1/30);A.breathe(0);for(let i=0;i<900&&A.S.phase!=='ending';i++)A.step(1/30);return{ph:A.S.phase,d:A.garden.done.length}});ok('목표 5송이로 변경 동작',r.ph==='ending'&&r.d===5,r);await pg.context().close()}
await b.close();s.close();console.log('FAILS',R.filter(x=>!x).length,'/',R.length)})().catch(e=>{console.error(e);process.exit(1)});
