// 띠부스티커용 PNG: 배포된 웹과 같은 빌드·렌더러로 검정/흰 배경 두 번 렌더 → 알파 추출 (웹 코드는 변경 없음)
const {serve,launch}=require('./lib.cjs');const fs=require('fs');
const OUT='/home/claude/agape-web/export/';
(async()=>{const s=serve(),b=await launch(['--use-gl=angle','--use-angle=swiftshader']);
const pg=await (await b.newContext({viewport:{width:1280,height:720}})).newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
await pg.evaluate(()=>{const A=__agape;A.renderer.setAnimationLoop(null);window.__shot=(W,H,bg)=>{A.scene.background=new A.THREE.Color(bg);A.renderer.setPixelRatio(1);A.renderer.setSize(W,H,false);A.renderer.render(A.scene,A.camera);return A.renderer.domElement.toDataURL('image/png')};
 const G=A.garden;window.__hideGarden=()=>{G.group.visible=false;G.pearls.mesh.visible=false;G.lights.pts.visible=false;G.drops.mesh.visible=false}});
const save=(n,d)=>fs.writeFileSync(OUT+n,Buffer.from(d.split(',')[1],'base64'));
// 1) 막대 + 비눗방울: 실제 웹의 숨→비눗방울 시뮬레이션을 그대로 돌려 한 순간을 정지
for(const seed of []){
 const r=await pg.evaluate(seed=>{const A=__agape,T=A.THREE;A.resetAll();__hideGarden();A.CONFIG.driftRatio=1;A.toggleWand();A.step(3);
  A.breathe(.75);A.step(1.5+seed*.25);A.breathe(.4);A.step(.5);A.breathe(.85);A.step(.7);A.breathe(0);A.step(.05);
  const c=A.camera;c.updateMatrixWorld();const pts=[];const p=new T.Vector3();
  A.wand.updateMatrixWorld(true);const box=new T.Box3().setFromObject(A.wand.children.find(o=>o.type!=='Mesh'||o.geometry.type!=='CapsuleGeometry')||A.wand);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(p.set(x,y,z).clone().project(c));
  for(const o of A.bubbles.list){const q=o.m.getWorldPosition(new T.Vector3()).clone();for(const d of [[1,0],[-1,0],[0,1],[0,-1]])pts.push(q.clone().add(new T.Vector3(d[0]*o.r,d[1]*o.r,0)).project(c))}
  const xs=pts.map(v=>(v.x+1)/2*1280),ys=pts.map(v=>(1-v.y)/2*720);
  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const m=.08*Math.max(x1-x0,y1-y0);x0-=m;x1+=m;y0-=m;y1+=m;
  const k=4200/Math.max(x1-x0,y1-y0);c.setViewOffset(1280,720,x0,y0,x1-x0,y1-y0);c.updateProjectionMatrix();
  return{W:Math.round((x1-x0)*k),H:Math.round((y1-y0)*k),n:A.bubbles.list.length}},seed);
 for(const [bg,t] of [[0x000000,'k'],[0xffffff,'w']])save(`wand${seed}_${t}.png`,await pg.evaluate(([W,H,bg])=>__shot(W,H,bg),[r.W,r.H,bg]));
 await pg.evaluate(()=>{__agape.camera.clearViewOffset();__agape.camera.updateProjectionMatrix()});console.log('wand',seed,r);
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
