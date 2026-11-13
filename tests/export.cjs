// 띠부스티커용 PNG: 배포된 웹과 같은 빌드·렌더러로 검정/흰 배경 두 번 렌더 → 알파 추출 (웹 코드는 변경 없음)
const {serve,launch}=require('./lib.cjs');const fs=require('fs');
const OUT='/home/claude/agape-web/export/';
(async()=>{const s=serve(),b=await launch(['--use-gl=angle','--use-angle=swiftshader']);
const pg=await (await b.newContext({viewport:{width:1280,height:720}})).newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
await pg.evaluate(()=>{const A=__agape;A.renderer.setAnimationLoop(null);window.__shot=(W,H,bg)=>{A.scene.background=new A.THREE.Color(bg);A.renderer.setPixelRatio(1);A.renderer.setSize(W,H,false);A.renderer.render(A.scene,A.camera);return A.renderer.domElement.toDataURL('image/png')};
 const G=A.garden;window.__hideGarden=()=>{G.group.visible=false;G.pearls.mesh.visible=false;G.lights.pts.visible=false;G.drops.mesh.visible=false}});
const save=(n,d)=>fs.writeFileSync(OUT+n,Buffer.from(d.split(',')[1],'base64'));
// 1) 막대 + 비눗방울: 웹의 시뮬레이션을 여러 번 돌려 가장 고르게 퍼진 순간을 고름
{const best=await pg.evaluate(()=>{const A=__agape,T=A.THREE;let top=null;
 for(let seed=0;seed<40;seed++){A.resetAll();__hideGarden();A.CONFIG.driftRatio=1;A.toggleWand();A.step(3);
  const plan=[];let t=0;while(t<3.2+Math.random()*1.5){const d=.2+Math.random()*.7,st=Math.random()<.2?0:.35+Math.random()*.6;plan.push([st,d]);t+=d}
  for(const [st,d] of plan){A.breathe(st);A.step(d)}A.breathe(0);A.step(.05);
  const c=A.camera,L=A.bubbles.list;if(L.length<10||L.length>20)continue;
  const wp=new T.Vector3().setFromMatrixPosition(A.wand.matrixWorld).project(c);
  const P=L.map(o=>{const q=o.m.getWorldPosition(new T.Vector3());const v=q.clone().project(c);const e=q.clone().add(new T.Vector3(o.r,0,0)).project(c);return{x:v.x,y:v.y,r:Math.abs(e.x-v.x)}});
  const xs=P.map(p=>p.x),ys=P.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  // 점수: 3x3 칸이 얼마나 고르게 차는지 + 겹침이 적은지 + 막대에서 왼쪽으로 퍼지는지
  const cells=new Set(P.map(p=>Math.min(2,Math.floor((p.x-x0)/(x1-x0+1e-6)*3))+','+Math.min(2,Math.floor((p.y-y0)/(y1-y0+1e-6)*3))));
  let ov=0;for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const d=Math.hypot(P[i].x-P[j].x,(P[i].y-P[j].y)*.56);if(d<(P[i].r+P[j].r)*1.05)ov++}
  const aspect=(x1-x0)/((y1-y0)*.56+1e-6),score=cells.size*2-ov*1.5-Math.abs(Math.log(aspect))*2+(wp.x>x1?2:0);
  if(!top||score>top.score){top={score,seed,plan,n:L.length,cells:cells.size,ov}}}
 window.__plan=top;return top});
 console.log('best',JSON.stringify(best));
 const r=await pg.evaluate(()=>{const A=__agape,T=A.THREE;A.resetAll();__hideGarden();A.CONFIG.driftRatio=1;A.toggleWand();A.step(3);
  return 0});
}
// 2) 유리꽃 한 송이: 웹과 같은 GLB·재질, 다 핀 상태 (웹 정원처럼 살짝 돌린 각도)
for(const mat of ['milky']){
const f=await pg.evaluate(mat=>{const A=__agape,T=A.THREE;A.resetAll();__hideGarden();A.wand.visible=false;A.bubbles.clear();
 A.scene.children.filter(o=>o.userData.sticker).forEach(o=>A.scene.remove(o));
 const o=A.P.A.scene.clone(true);o.userData.sticker=1;o.rotation.y=.28;o.traverse(n=>{if(n.isMesh)n.material=A.garden.mats[mat]});A.scene.add(o);
 const c=A.camera;c.clearViewOffset();c.position.set(.5,1.35,4.4);c.lookAt(0,.6,0);c.updateMatrixWorld();o.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(o),pts=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(new T.Vector3(x,y,z).project(c));
 const xs=pts.map(v=>(v.x+1)/2*1280),ys=pts.map(v=>(1-v.y)/2*720);let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const m=.1*Math.max(x1-x0,y1-y0);x0-=m;x1+=m;y0-=m;y1+=m;
 const k=3950/Math.max(x1-x0,y1-y0);c.setViewOffset(1280,720,x0,y0,x1-x0,y1-y0);c.updateProjectionMatrix();return{W:Math.round((x1-x0)*k),H:Math.round((y1-y0)*k)}},mat);
for(const [bg,t] of [[0x000000,'k'],[0xffffff,'w']])save(`flower_${mat}_${t}.png`,await pg.evaluate(([W,H,bg])=>__shot(W,H,bg),[f.W,f.H,bg]));
console.log(mat,f)}
console.log(errs);await b.close();s.close()})();
