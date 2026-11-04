const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h] of [['PC',1280,720],['모바일',390,844]]){const c=await b.newContext({viewport:{width:w,height:h}});const pg=await c.newPage();await pg.goto('http://localhost:8766/?debug&tier=1');await pg.waitForFunction('window.__ready',{timeout:90000});
await pg.evaluate(()=>{const A=__agape;A.toggleWand();A.step(3);A.breathe(.7);let i=0;while(A.S.phase==='play'&&i++<2400)A.step(1/30);A.breathe(0);A.step(8);A.draw();A.resume()});await pg.waitForTimeout(3200);await pg.screenshot({path:`shots/t9_4_엔딩_${n}.png`});
console.log(n,await pg.evaluate(()=>{const A=__agape,p=new A.THREE.Vector3();let hi=-9,lo=9,mx=0;for(const f of A.garden.flowers){p.copy(f.headPos);p.y+=.3;p.project(A.camera);hi=Math.max(hi,p.y);mx=Math.max(mx,Math.abs(p.x));p.copy(f.obj.position).project(A.camera);lo=Math.min(lo,p.y)}const k=document.querySelector('#ending .ko').getBoundingClientRect(),r=document.querySelector('#ending button').getBoundingClientRect();return{koY:(k.top+k.bottom)/2/innerHeight,hi,lo,mx,btn:1-2*r.bottom/innerHeight}}));await c.close()}
await b.close();s.close()})();
