const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h] of [['PC',1280,720],['모바일',390,844]]){const c=await b.newContext({viewport:{width:w,height:h}});const pg=await c.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://localhost:8766/?debug&tier=1');await pg.waitForFunction('window.__ready',{timeout:90000});
await pg.evaluate(()=>{__agape.toggleWand()});await pg.waitForTimeout(300);
const r=await pg.evaluate(()=>{const A=__agape,B=A.bubbles;A.step(3);A.breathe(.7);let i=0;while(A.S.phase==='play'&&i++<2400)A.step(1/30);A.breathe(0);A.step(12);const ct=[];let seen=0,mxText=0;for(let k=0;k<12;k++){A.step(10);ct.push(B.list.length)}A.draw();A.resume();const G=A.garden;return{ct,opened:G.opened,flew:B.stats.flew,buds:B.buds.length}});
await pg.waitForTimeout(3200);await pg.screenshot({path:`shots/t9_4_엔딩_${n}.png`});
await pg.click('#againBtn');await pg.waitForTimeout(250);const z=await pg.evaluate(()=>{__agape.step(.05);__agape.step(6);return{list:__agape.bubbles.list.length,ph:__agape.S.phase}});console.log(n,JSON.stringify(r),JSON.stringify(z),errs);await c.close()}
await b.close();s.close()})();
