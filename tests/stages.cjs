const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();const pg=await (await b.newContext({viewport:{width:420,height:420}})).newPage();await pg.goto('http://localhost:8766/?debug&tier=1&count=6');await pg.waitForFunction('window.__ready',{timeout:90000});
await pg.evaluate(()=>{const A=__agape,G=A.garden,T=A.THREE;const gs=[0,.1,.22,.34,.48,.62,.8,1];
 document.querySelectorAll('#title,#hint').forEach(e=>e.style.display='none');
 G.flowers.forEach(f=>{f.obj.position.set(0,0,0)});
 window.__show=(ki)=>{const f=G.flowers[ki];};
});
for(let k=0;k<3;k++){const r=await pg.evaluate(k=>{const A=__agape,G=A.garden,f=G.flowers[k];A.wand.visible=false;G.flowers.forEach((x,i)=>{x.obj.visible=false});f.obj.visible=true;A.step(.01);return f.key},k);
 for(const [i,g] of [0,.1,.22,.34,.48,.62,.8,1].entries()){await pg.evaluate(([k,g])=>{const A=__agape,G=A.garden,f=G.flowers[k];G.flowers.forEach(x=>{x.bt=0;x.opening=false});f.g=g;f.shown=-1;f.wet=0;f.bloom=1e9;f.bt=g>0?g*1e9:0;f.opening=g>0;G.flowers.forEach(x=>{if(x!==f){x.g=0}});G.update(1e-4);G.pearls.mesh.count=1;const P=G.pearls;P.q.identity();const q=f.headPos;P.m.compose(q,P.q,P.s.setScalar(Math.max((g<=0?1:g<.14?1.25+g*.9:Math.max(0,1.38*(1-(g-.14)/.46)))*f.pr,1e-4)));P.mesh.setMatrixAt(0,P.m);P.mesh.instanceMatrix.needsUpdate=true;const c=A.camera;c.position.set(.6,.5,3.4);c.lookAt(0,.42,0);c.updateMatrixWorld();c.aspect=1;c.updateProjectionMatrix();A.draw()},[k,g]);await pg.waitForTimeout(150);await pg.screenshot({path:`tests/st_${k}_${i}.png`,clip:{x:60,y:60,width:300,height:300}})}}
await b.close();s.close()})();
