const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h] of [['pc',1280,720],['mo',390,844]]){
const pg=await b.newPage({viewport:{width:w,height:h}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error'&&!/ERR_/.test(m.text()))errs.push(m.text().slice(0,300))});
await pg.goto('http://localhost:8766/?debug&tier=1');await pg.waitForFunction('window.__ready',{timeout:90000});
const ss=async t=>{await pg.evaluate(()=>__agape.draw());await pg.waitForTimeout(300);await pg.screenshot({path:`tests/c_${n}_${t}.png`})};
await pg.evaluate(()=>__agape.step(.2));await pg.waitForTimeout(1600);await ss('1start');
await pg.evaluate(()=>{__agape.toggleWand();__agape.step(3)});
for(const [mode,tag] of [['hold','연속'],['breath','끊어 불기']]){
 const r=await pg.evaluate(mode=>{const A=__agape,G=A.garden,B=A.bubbles;let t=0,log=[],phase=0,next=0;A.bubbles.fit;const dt=1/30;let shot=false;
  while(t<140&&!G.ready){let st=.65;if(mode==='breath'){const c=(t%4.5);st=c<3?.45+.4*Math.sin(c/3*3.14):0}A.breathe(st);A.step(dt);t+=dt;if(Math.round(t*30)%(30*8)==0)log.push([Math.round(t),+G.avg.toFixed(2),+G.fullShare.toFixed(2),B.stats.hits,B.stats.flew,B.list.length]);if(!shot&&G.avg>.28&&mode=='hold'){shot=true;A.breathe(0);break}}
  return{t:+t.toFixed(1),log,ready:G.ready,fs:G.fullShare,hits:B.stats.hits,flew:B.stats.flew,born:B.stats.born}},mode);
 console.log(n,tag,JSON.stringify(r));
 if(mode==='hold'){await ss('3water');const r2=await pg.evaluate(()=>{const A=__agape,G=A.garden;let t=0;A.breathe(.65);while(t<140&&!G.ready){A.step(.2);t+=.2}A.breathe(.0);return{t,hits:A.bubbles.stats.hits,flew:A.bubbles.stats.flew,born:A.bubbles.stats.born}});console.log(n,'연속 이어서',JSON.stringify(r2));await ss('4full');
  await pg.evaluate(()=>{const A=__agape;A.resetAll();A.toggleWand();A.step(3)})}
}
await pg.evaluate(()=>{__agape.breathe(0);__agape.step(2.2);__agape.step(6)});await pg.waitForTimeout(2200);await ss('5end');
console.log(errs,await pg.evaluate(()=>__agape.S.phase));await pg.close()}
await b.close();s.close()})();
