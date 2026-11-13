// 띠부스티커 PNG v2: 비눗방울은 웹 시뮬레이션을 여러 번 돌려 가장 고르게 퍼진 순간, 꽃은 재질 후보 렌더
const {serve,launch}=require('./lib.cjs');const fs=require('fs');const OUT='/home/claude/agape-web/export/';
(async()=>{const s=serve(),b=await launch();
const pg=await (await b.newContext({viewport:{width:1280,height:720}})).newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
await pg.evaluate(()=>{const A=__agape,G=A.garden;A.renderer.setAnimationLoop(null);
 window.__shot=(W,H,bg)=>{A.scene.background=new A.THREE.Color(bg);A.renderer.setPixelRatio(1);A.renderer.setSize(W,H,false);A.renderer.render(A.scene,A.camera);return A.renderer.domElement.toDataURL('image/png')};
 window.__hide=()=>{G.group.visible=false;G.pearls.mesh.visible=false;G.lights.pts.visible=false;G.drops.mesh.visible=false};
 window.__seed=n=>{let a=n*2654435761>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
 window.__frame=(pts,m,long)=>{const c=A.camera,xs=pts.map(v=>(v.x+1)/2*1280),ys=pts.map(v=>(1-v.y)/2*720);let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const p=m*Math.max(x1-x0,y1-y0);x0-=p;x1+=p;y0-=p;y1+=p;const k=long/Math.max(x1-x0,y1-y0);c.setViewOffset(1280,720,x0,y0,x1-x0,y1-y0);c.updateProjectionMatrix();return{W:Math.round((x1-x0)*k),H:Math.round((y1-y0)*k)}};
 window.__trial=seed=>{const T=A.THREE;__seed(seed);A.camera.clearViewOffset();A.camera.updateProjectionMatrix();A.resetAll();__hide();A.CONFIG.driftRatio=1;A.toggleWand();A.step(3);
  let t=0,lim=3+Math.random()*2;while(t<lim){const d=.2+Math.random()*.7,st=Math.random()<.2?0:.35+Math.random()*.6;A.breathe(st);A.step(d);t+=d}A.breathe(0);A.step(.05);
  const c=A.camera;c.updateMatrixWorld();const L=A.bubbles.list;
  const P=L.map(o=>{const q=o.m.getWorldPosition(new T.Vector3()),v=q.clone().project(c),e=q.clone().add(new T.Vector3(o.r,0,0)).project(c);return{x:v.x,y:v.y*.5625,r:Math.abs(e.x-v.x),q,o}});
  return{L,P}};
});
const best=await pg.evaluate(()=>{let top=null;
 for(let seed=1;seed<=60;seed++){const {P}=__trial(seed);if(P.length<11||P.length>18)continue;
  const xs=P.map(p=>p.x),ys=P.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),w=x1-x0,h=y1-y0;
  const cells=new Set(P.map(p=>Math.min(2,Math.floor((p.x-x0)/(w+1e-6)*3))+','+Math.min(2,Math.floor((p.y-y0)/(h+1e-6)*3)))).size;
  let ov=0,nn=[];for(const a of P){let m=9;for(const b of P)if(a!==b){const d=Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;m=Math.min(m,d);if(d<0)ov+=.5}nn.push(m)}
  const mean=nn.reduce((s,x)=>s+x,0)/nn.length,cv=Math.sqrt(nn.reduce((s,x)=>s+(x-mean)**2,0)/nn.length)/(Math.abs(mean)+1e-6);
  const big=P.filter(p=>p.r>.05).length;
  const score=cells*2-ov*2-cv*2-Math.abs(Math.log((w+.01)/(h+.01)))*2+(big>=2&&big<=5?2:0);
  if(!top||score>top.score)top={seed,score:+score.toFixed(2),n:P.length,cells,ov,cv:+cv.toFixed(2),big}}
 return top});
console.log('best',JSON.stringify(best));
const save=(n,d)=>fs.writeFileSync(OUT+n,Buffer.from(d.split(',')[1],'base64'));
const wr=await pg.evaluate(seed=>{const A=__agape,T=A.THREE,{P}=__trial(seed);const c=A.camera;const pts=[];
 // 겹친 방울만 화면과 평행하게 살짝 밀어 고르게 펼침 (모양·재질은 그대로)
 const right=new T.Vector3(1,0,0).applyQuaternion(c.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(c.quaternion);
 const ring=new T.Vector3().setFromMatrixPosition(A.wand.matrixWorld);
 for(let it=0;it<160;it++)for(const a of P){const pa=a.o.m.position;
  for(const b of P){if(a===b)continue;const pb=b.o.m.position,d=pa.clone().sub(pb);d.addScaledVector(c.getWorldDirection(new T.Vector3()),-d.dot(c.getWorldDirection(new T.Vector3())));const L=d.length(),need=(a.o.r+b.o.r)*1.45+.22;if(L<need){pa.addScaledVector(d.normalize(),(need-L)*.25)}}
  const dr=pa.clone().sub(ring);const Lr=dr.length();if(Lr<a.o.r+.55)pa.addScaledVector(dr.normalize(),(a.o.r+.55-Lr)*.3);
  if(pa.clone().sub(ring).dot(right)>-.1)pa.addScaledVector(right,-.03)}
 for(const p of P){p.q.copy(p.o.m.getWorldPosition(new T.Vector3()));p.o.close=1;p.o.u.uClose.value=1;p.o.u.uPop.value=0}
 const B=A.bubbles;for(const bd of B.buds){A.wand.remove(bd.m)}B.buds.length=0;if(B.ring){const u=B.ring.material.uniforms;u.uForm.value=1;u.uH.value=.0025;u.uWob.value=0;u.uAlpha.value=1}
 A.wand.updateMatrixWorld(true);const box=new T.Box3().setFromObject(A.wand.children.find(o=>o.isGroup||o.type==='Object3D')||A.wand);
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(new T.Vector3(x,y,z).project(c));
 for(const p of P)for(const d of [[1,0],[-1,0],[0,1],[0,-1]])pts.push(p.q.clone().add(new T.Vector3(d[0]*p.o.r,d[1]*p.o.r,0)).project(c));
 return __frame(pts,.07,4200)},best.seed);
for(const [bg,t] of [[0,'k'],[0xffffff,'w']])save(`w2_${t}.png`,await pg.evaluate(([W,H,bg])=>__shot(W,H,bg),[wr.W,wr.H,bg]));
// 꽃 후보: 3 오로라 / 4 진주광 / 1.35배 발광 오로라
for(const [name,mat,boost] of []){
 const f=await pg.evaluate(([mat,boost])=>{const A=__agape,T=A.THREE;A.camera.clearViewOffset();A.resetAll();__hide();A.wand.visible=false;A.bubbles.clear();
  A.scene.children.filter(o=>o.userData.sticker).forEach(o=>A.scene.remove(o));
  const m=A.garden.mats[mat].clone();m.emissiveIntensity*=boost;
  const o=A.P.A.scene.clone(true);o.userData.sticker=1;o.rotation.y=.28;o.traverse(n=>{if(n.isMesh)n.material=m});A.scene.add(o);
  const c=A.camera;c.position.set(.5,1.35,4.4);c.lookAt(0,.6,0);c.updateMatrixWorld();o.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(o),pts=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(new T.Vector3(x,y,z).project(c));
  return __frame(pts,.1,3950)},[mat,boost]);
 for(const [bg,t] of [[0,'k'],[0xffffff,'w']])save(`f2_${name}_${t}.png`,await pg.evaluate(([W,H,bg])=>__shot(W,H,bg),[f.W,f.H,bg]));}
console.log(errs);await b.close();s.close()})();
