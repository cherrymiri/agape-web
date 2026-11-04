const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h,run] of [['pc',1280,720,1],['mo',390,844,0]]){
const pg=await b.newPage({viewport:{width:w,height:h}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error'&&!/ERR_/.test(m.text()))errs.push(m.text().slice(0,300))});
await pg.goto('http://localhost:8766/?debug&tier=1');await pg.waitForFunction('window.__ready',{timeout:90000});
const ss=async t=>{await pg.evaluate(()=>__agape.draw());await pg.waitForTimeout(300);await pg.screenshot({path:`tests/c_${n}_${t}.png`})};
await pg.evaluate(()=>__agape.step(.2));await ss('1start');
await pg.evaluate(()=>{__agape.toggleWand();__agape.step(3)});await ss('2up');
const r=await pg.evaluate(()=>{const A=__agape;A.breathe(.65);let t=0,log=[];const G=A.garden;while(t<120&&!(G.ready)){A.step(1);t+=1;if(t%6==0)log.push([t,+G.avg.toFixed(2),+G.fullShare.toFixed(2),A.bubbles.stats.hits,A.bubbles.stats.flew,A.bubbles.list.length]);if(t==10)break}return{t,log}});
await ss('3water');console.log(n,JSON.stringify(r),errs);
await pg.close()}
await b.close();s.close()})();
