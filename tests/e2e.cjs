const {serve,launch}=require('./lib.cjs');const fs=require('fs'),crypto=require('crypto');
const R=[];const ok=(n,c,x='')=>{R.push([c?'PASS':'FAIL',n,x]);console.log(c?'PASS':'FAIL',n,x)};
const proj=`(()=>{const A=__agape,v=new A.THREE.Vector3(0,-.75,0).applyMatrix4(A.wand.matrixWorld).project(A.camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}})()`;
(async()=>{const s=serve();
// 파일 동일성
for(const f of fs.readdirSync('/home/claude/agape-web/dist/glb')){const h=p=>crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');ok('GLB 원본 동일 '+f,h('/home/claude/agape-web/dist/glb/'+f)===h('/tmp/agz/AGAPE_LightGarden/glb/'+f))}
const b=await launch(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/home/claude/agape-web/tests/mic.wav']);
for(const [n,w,h,touch] of [['PC',1280,720,false],['모바일',390,844,true]]){
 const c=await b.newContext({viewport:{width:w,height:h},hasTouch:touch,permissions:['microphone']});const pg=await c.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error')errs.push(m.text())});
 await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
 ok(n+' 모델 로딩',await pg.evaluate(()=>Object.keys(__agape.P).length===5&&__agape.P.A.animations[0].name==='Bloom'),await pg.evaluate(()=>__agape.P.A.animations[0].duration.toFixed(2)+'s'));
 const click=async()=>{await pg.evaluate(()=>{__agape.step(4);__agape.draw()});const p=await pg.evaluate(proj);if(touch)await pg.touchscreen.tap(p.x,p.y);else await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(350);return pg.evaluate(()=>__agape.S.up)};
 ok(n+' 클릭→들기',await click()===true);ok(n+' 다시→내려놓기',await click()===false);ok(n+' 다시→들기',await click()===true);
 await pg.evaluate(()=>{__agape.step(1.5);__agape.mic()?.stop()});
 ok(n+' 비눗막 형성',await pg.evaluate(()=>__agape.S.form>=1&&!!__agape.S.film));
 // 크기
 const blow=(st,t)=>pg.evaluate(([st,t])=>{const A=__agape;const before=A.S.bubbles.length,sp=A.S.spawned;A.breathe(st);A.step(t);A.breathe(0);A.step(.4);const nw=A.S.bubbles.slice(before);return{n:A.S.spawned-sp,r:nw.map(b=>+b.r.toFixed(2))}},[st,t]);
 const small=await blow(.25,.6),big=await blow(.9,.95);ok(n+' 약한 숨<강한 숨',small.n>=1&&big.n>=1&&Math.max(...small.r)<Math.max(...big.r),JSON.stringify({small,big}));
 const none=await blow(.1,.1);ok(n+' 아주 짧은 숨은 생성 안 됨',none.n===0);
 const sp=await pg.evaluate(()=>{const A=__agape,a=A.S.spawned;A.step(6);return A.S.spawned-a});ok(n+' 숨 멈추면 추가 생성 없음',sp===0);
 const cont=await blow(.9,5);ok(n+' 계속 불면 여러 개',cont.n>=2,'n='+cont.n);
 // 화면 안 + 위치
 const out=await pg.evaluate(()=>{const A=__agape;let mx=0,seed=0,rise=true;for(let i=0;i<30;i++){A.breathe(i%3==0?.8:0);A.step(.5);seed=Math.max(seed,A.garden.seeds.length);A.camera.updateMatrixWorld();for(const b of A.S.bubbles){const v=b.m.getWorldPosition(new A.THREE.Vector3());const u=b.u;const e=v.clone();e.x+=Math.sign(v.x)*b.r;e.project(A.camera);mx=Math.max(mx,Math.abs(e.x))}}A.breathe(0);return{mx,seed}});ok(n+' 비눗방울 화면 안',out.mx<1.02,out.mx.toFixed(2));ok(n+' 씨앗 생성',out.seed>0,'동시 최대 '+out.seed);
 const pre=await pg.evaluate(()=>{const A=__agape;for(let i=0;i<34;i++){A.breathe(.75);A.step(.9);A.breathe(0);A.step(.9)}A.step(16);return{pop:A.S.popped,tot:A.garden.total,done:A.garden.done.length,sd:A.garden.seeds.length,gr:A.garden.growing.length,c:A.garden.counts,calls:(A.draw(),A.calls()),b:A.S.bubbles.length}});
 ok(n+' 터질 때마다 꽃 1송이',pre.pop===pre.tot+pre.sd,JSON.stringify([pre.pop,pre.tot,pre.sd]));
 ok(n+' A~E 모두',['A','B','C','D','E'].every(k=>pre.c[k]>0),JSON.stringify(pre.c));ok(n+' 재질 4종 모두',['aurora','pearl','milky','glow'].every(k=>pre.c[k]>0));
 ok(n+' 드로우콜',pre.calls<80,pre.tot+'송이 '+pre.calls+'콜');
 // 모델 불변: 최종 인스턴스 = 원본 레스트 × 슬롯 변환
 const inv=await pg.evaluate(()=>{const A=__agape,T=A.THREE;let worst=0,cnt=0;for(const m of A.garden.pools.map.values())for(const it of m.list){const f=it.owner;const o=A.P[f.key].scene.clone(true);o.position.set(f.slot.x,f.slot.y,f.slot.z);o.quaternion.copy(f.obj.quaternion);o.scale.setScalar(f.scale);o.updateMatrixWorld(true);let best=1e9;o.traverse(n=>{if(n.isMesh&&n.geometry===m.geometry){let d=0;for(let i=0;i<16;i++)d=Math.max(d,Math.abs(n.matrixWorld.elements[i]-it.e.elements[i]));best=Math.min(best,d)}});worst=Math.max(worst,best);cnt++}const sc=A.garden.done.map(f=>f.scale);return{worst,cnt,min:Math.min(...sc),max:Math.max(...sc)}});
 ok(n+' 개화 후 형태 = 원본 (균일배율만)',inv.worst<1e-4,JSON.stringify(inv));
 // 실제 버튼으로 엔딩
 ok(n+' 정원 보기 버튼',await pg.isVisible('#gardenBtn'));await pg.evaluate(()=>__agape.resume());await pg.click('#gardenBtn');await pg.evaluate(()=>__agape.step(8));await pg.waitForTimeout(300);await pg.evaluate(()=>{__agape.step(.1)});await pg.waitForSelector('#ending:not([hidden])');
 const t=await pg.evaluate(()=>[...document.querySelectorAll('#ending p')].map(e=>e.textContent));ok(n+' 엔딩 문구 정확',t[0]==='사랑을 주는 데 이유가 필요해?'&&t[1]==='Do I need a reason to give love?'&&t.length===2);
 await pg.evaluate(()=>__agape.resume());await pg.waitForTimeout(2600);await pg.click('#againBtn');
 const st=await pg.evaluate(()=>{const A=__agape,g=A.garden;return{ph:A.S.phase,up:A.S.up,b:A.S.bubbles.length,t:g.total,d:g.done.length,inst:[...g.pools.map.values()].length,ls:Object.keys(localStorage),end:document.getElementById('ending').hidden}});
 ok(n+' 다시 하기 초기화',st.ph==='play'&&!st.up&&st.b===0&&st.t===0&&st.d===0&&st.inst===0&&st.end,JSON.stringify(st));
 await pg.reload();await pg.waitForFunction('window.__ready',{timeout:90000});ok(n+' 새로고침 후 빈 정원',await pg.evaluate(()=>__agape.garden.total===0));
 ok(n+' 콘솔 오류 없음',errs.length===0,errs.slice(0,2).join(' | '));
 if(n=='PC'){// 실제 오디오 경로: 가짜 마이크 wav
  await pg.evaluate(()=>{__agape.resume();__agape.toggleWand()});await pg.waitForTimeout(300);
  await pg.waitForFunction(()=>__agape.mic()?.ready,{timeout:15000});
  const tl=await pg.evaluate(()=>new Promise(r=>{const out=[];const t0=performance.now();const iv=setInterval(()=>{const g=__agape.mic().gate;out.push([+((performance.now()-t0)/1000).toFixed(2),g.on?1:0,+g.level.toFixed(1),+g.strength.toFixed(2)]);if(performance.now()-t0>13000){clearInterval(iv);r({out,sp:__agape.S.spawned})}},80)}));
  fs.writeFileSync('/home/claude/agape-web/tests/mic_timeline.json',JSON.stringify(tl));
  const on=[];let st=null;for(const [t,o] of tl.out){if(o&&st===null)st=t;if(!o&&st!==null){on.push([st,t]);st=null}}console.log('mic on-spans',JSON.stringify(on),'spawned',tl.sp);
 }
 await c.close();}
// 거부 시 대체 입력
{const c=await b.newContext({viewport:{width:1280,height:720}});await c.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('no','NotAllowedError'))});const pg=await c.newPage();await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
 await pg.evaluate(()=>__agape.toggleWand());await pg.evaluate(()=>__agape.step(4));await pg.evaluate(()=>__agape.resume());await pg.click('#micBtn');await pg.waitForSelector('#holdBtn:not([hidden])');ok('권한 거부→대체 버튼',true);
 const bx=await pg.locator('#holdBtn').boundingBox();await pg.mouse.move(bx.x+20,bx.y+15);await pg.mouse.down();await pg.waitForTimeout(100);await pg.evaluate(()=>__agape.step(1));await pg.mouse.up();await pg.waitForTimeout(100);await pg.evaluate(()=>__agape.step(.5));ok('버튼 누르기→비눗방울',await pg.evaluate(()=>__agape.S.spawned>=1));await c.close()}
// 자동 품질
{const c=await b.newContext({viewport:{width:1280,height:720}});const pg=await c.newPage();await pg.goto('http://localhost:8766/?debug');await pg.waitForFunction('window.__ready',{timeout:90000});const t0=await pg.evaluate(()=>__agape.quality.tier);await pg.waitForFunction(()=>__agape.quality.tier===0,{timeout:30000}).catch(()=>{});const q=await pg.evaluate(()=>[__agape.quality.tier,__agape.quality.fps,__agape.renderer.getPixelRatio()]);ok('느린 환경 자동 품질 저하',q[0]<t0||t0===0,JSON.stringify({t0,q}));await c.close()}
await b.close();s.close();console.log('FAILS',R.filter(r=>r[0]=='FAIL').length,'/',R.length)})().catch(e=>{console.error(e);process.exit(1)});
