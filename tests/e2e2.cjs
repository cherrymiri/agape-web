const {serve,launch}=require('./lib.cjs');const fs=require('fs'),crypto=require('crypto'),{execSync}=require('child_process');
const R=[];const ok=(n,c,x='')=>{R.push(c);console.log(c?'PASS':'FAIL',n,typeof x=='string'?x:JSON.stringify(x))};
const proj=`(()=>{const A=__agape,v=new A.THREE.Vector3(0,-.75,0).applyMatrix4(A.wand.matrixWorld).project(A.camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}})()`;
(async()=>{const s=serve();const D='/home/claude/agape-web';
for(const f of fs.readdirSync(D+'/dist/glb')){const h=p=>crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');ok('GLB 원본 동일 '+f,h(D+'/dist/glb/'+f)===h('/tmp/agz/AGAPE_LightGarden/glb/'+f))}
ok('glass_materials.js 불변',fs.readFileSync(D+'/src/glass_materials.js','utf8')===fs.readFileSync('/tmp/agz/AGAPE_LightGarden/web/glass_materials.js','utf8'));
const b=await launch(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+D+'/tests/mic.wav']);
for(const [n,w,h,touch] of [['PC',1280,720,false],['모바일',390,844,true]]){
 const c=await b.newContext({viewport:{width:w,height:h},hasTouch:touch});const pg=await c.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error')errs.push(m.text())});
 await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
 const click=async()=>{await pg.evaluate(()=>{__agape.step(4);__agape.draw()});const p=await pg.evaluate(proj);if(touch)await pg.touchscreen.tap(p.x,p.y);else await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(350);return pg.evaluate(()=>__agape.S.up)};
 ok(n+' 클릭 들기',await click()===true);ok(n+' 내려놓기',await click()===false);ok(n+' 다시 들기',await click()===true);
 await pg.evaluate(()=>{__agape.step(3);__agape.draw()});await pg.screenshot({path:`/home/claude/agape-web/tests/f_${n}_up.png`});
 const wp=await pg.evaluate(()=>{const A=__agape,T=A.THREE,p=q=>new T.Vector3(...q).applyMatrix4(A.wand.matrixWorld).project(A.camera);const r=p([0,0,0]),l=p([-.4,0,0]),rr=p([.4,0,0]),top=p([0,.4,0]),bot=p([0,-1.6,0]);return{ringX:(r.x+1)/2,minX:(Math.min(l.x,rr.x,bot.x)+1)/2,maxX:(Math.max(l.x,rr.x,bot.x)+1)/2,top:top.y,bot:bot.y}});
 ok(n+' 막대 오른쪽 65~75%',wp.ringX>=.64&&wp.ringX<=.76,wp.ringX.toFixed(3));ok(n+' 막대 안 잘림',wp.maxX<.99&&wp.minX>.01&&wp.top<.99&&wp.bot>-.99,wp);
 const bh=await pg.evaluateHandle(()=>(st,len)=>{const A=__agape,dt=1/30;for(let t=0;t<len;t+=dt){const e=Math.min(t/.25,1)*Math.min((len-t)/.35,1);A.breathe(Math.max(.05,st*e*(1+.2*Math.sin(t*5))));A.step(dt)}A.breathe(0)});
 const st=await pg.evaluate(b=>{const A=__agape,B=A.bubbles;let mx=0,seenFast=0,seenLong=0,maxL=0;for(let i=0;i<70;i++){b(.3+Math.random()*.65,.5+Math.random()*2.4);for(let k=0;k<4;k++){A.step(.25);for(const o of B.list){if(o.fate==='pop'){const v=o.p.clone();v.x+=Math.sign(v.x)*o.r;v.project(A.camera);mx=Math.max(mx,Math.abs(v.x))}maxL=Math.max(maxL,B.list.length)}}}const before=B.stats.born;A.step(40);const S=B.stats;return{born:S.born,afterStop:S.born-before,popped:S.popped,flew:S.flew,sizes:S.sizes,lives:S.lives,times:S.times,mx,maxL,total:A.garden.total+A.garden.seeds.length,recycled:0,left:B.list.length,buds:B.buds.length,c:A.garden.counts}},bh);
 const sz=[...st.sizes].sort((a,b)=>a-b);const gaps=st.times.slice(1).map((t,i)=>t-st.times[i]).filter(g=>g<1.2);const gm=gaps.reduce((a,c)=>a+c,0)/gaps.length,cv=Math.sqrt(gaps.reduce((a,c)=>a+(c-gm)**2,0)/gaps.length)/gm;
 const lv=st.lives.filter(x=>x>0),ratio=st.popped/(st.popped+st.flew);
 ok(n+' 크기 범위 넓음',sz.at(-1)/sz[0]>8,{min:sz[0],med:sz[sz.length>>1],max:sz.at(-1)});
 ok(n+' 간격 불규칙',cv>.8&&gaps.some(g=>g<.12)&&gaps.some(g=>g>.2&&g<.5)&&gaps.some(g=>g>.6),{cv:+cv.toFixed(2)});
 ok(n+' 빠른/오래 공존',lv.some(x=>x<2)&&lv.some(x=>x>3&&x<6)&&lv.some(x=>x>7),{빠름:lv.filter(x=>x<2).length,중간:lv.filter(x=>x>=2&&x<7).length,오래:lv.filter(x=>x>=7).length});
 ok(n+' 터짐 약 80%',ratio>.68&&ratio<.92,ratio.toFixed(2));ok(n+' 일부 날아감',st.flew>0,'날아감 '+st.flew);
 ok(n+' 터진 방울만 꽃',st.total===st.popped,[st.popped,st.total]);ok(n+' 숨 멈추면 생성 없음',st.afterStop===0&&st.buds===0);ok(n+' 사라진 방울 정리',st.left===0);
 ok(n+' 터질 방울 화면 안',st.mx<1.03,st.mx.toFixed(2));ok(n+' A~E·재질 4종',['A','B','C','D','E','aurora','pearl','milky','glow'].every(k=>st.c[k]>0));
 const inv=await pg.evaluate(()=>{const A=__agape;let worst=0,cnt=0;for(const m of A.garden.pools.map.values())for(const it of m.list){const f=it.owner;const o=A.P[f.key].scene.clone(true);o.position.set(f.slot.x,f.slot.y,f.slot.z);o.quaternion.copy(f.obj.quaternion);o.scale.setScalar(f.scale);o.updateMatrixWorld(true);let best=1e9;o.traverse(n=>{if(n.isMesh&&n.geometry===m.geometry){let d=0;for(let i=0;i<16;i++)d=Math.max(d,Math.abs(n.matrixWorld.elements[i]-it.e.elements[i]));best=Math.min(best,d)}});worst=Math.max(worst,best);cnt++}return{worst,cnt,calls:(A.draw(),A.calls()),flowers:A.garden.done.length}});
 ok(n+' 꽃 형태 원본 유지',inv.worst<1e-4,inv);
 await pg.evaluate(()=>{__agape.draw()});await pg.screenshot({path:`/home/claude/agape-web/tests/f_${n}_garden.png`});
 // 한도 초과: 강제로 터뜨리지 않음
 const cap=await pg.evaluate(b=>{const A=__agape,B=A.bubbles,Q=A.quality.t,o=Q.bubbles,p0=B.stats.popped;Q.bubbles=4;A.CONFIG.density=4;A.CONFIG.popRatio=1;B.list.forEach(x=>{});let ex=0;for(let i=0;i<6;i++){b(.95,2);A.step(.1)}ex=B.list.filter(x=>x.released).length;Q.bubbles=o;A.CONFIG.density=1;A.CONFIG.popRatio=.8;A.step(30);return{ex,left:B.list.length}},bh);ok(n+' 한도 초과는 화면 밖 퇴장',cap.ex>0&&cap.left===0,cap);
 await pg.evaluate(()=>__agape.resume());await pg.click('#gardenBtn');await pg.evaluate(()=>__agape.step(8));await pg.waitForSelector('#ending:not([hidden])');
 const t=await pg.evaluate(()=>[...document.querySelectorAll('#ending p')].map(e=>e.textContent));ok(n+' 엔딩 문구',t[0]==='사랑을 주는 데 이유가 필요해?'&&t[1]==='Do I need a reason to give love?'&&t.length===2);
 await pg.waitForTimeout(2600);await pg.click('#againBtn');
 ok(n+' 다시 하기',await pg.evaluate(()=>{const A=__agape;return A.S.phase==='play'&&!A.S.up&&A.bubbles.list.length===0&&A.garden.total===0&&A.bubbles.stats.born===0}));
 ok(n+' 콘솔 오류 없음',errs.length===0,errs.slice(0,2).join('|'));await c.close()}
// 마이크 경로 (합성 소리)
{const c=await b.newContext({viewport:{width:1000,height:640},permissions:['microphone']});const pg=await c.newPage();await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});await pg.evaluate(()=>__agape.toggleWand());await pg.waitForFunction(()=>__agape.mic()?.ready,{timeout:15000});await pg.waitForTimeout(16000);const m=await pg.evaluate(()=>({born:__agape.bubbles.stats.born,sz:__agape.bubbles.stats.sizes}));ok('마이크 경로(합성 소리)→방울',m.born>=1,m);await c.close()}
// 대체 입력
{const c=await b.newContext({viewport:{width:1000,height:640}});const pg=await c.newPage();await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});await pg.evaluate(()=>{window.__a=1;__agape.toggleWand();__agape.step(4)});await pg.evaluate(()=>{__agape.resume();document.getElementById('setBtn').click()});await pg.click('#noMic');await pg.waitForSelector('#holdBtn:not([hidden])');const bx=await pg.locator('#holdBtn').boundingBox();await pg.mouse.move(bx.x+20,bx.y+15);await pg.mouse.down();await pg.waitForTimeout(150);await pg.evaluate(()=>__agape.step(3));const during=await pg.evaluate(()=>__agape.bubbles.stats.born);await pg.mouse.up();await pg.waitForTimeout(150);await pg.evaluate(()=>__agape.step(1));const S=await pg.evaluate(()=>__agape.bubbles.stats.sizes);ok('대체 입력 길게 누르기→여러 방울',during>=2,S);await c.close()}
await b.close();s.close();console.log('FAILS',R.filter(x=>!x).length,'/',R.length)})().catch(e=>{console.error(e);process.exit(1)});
