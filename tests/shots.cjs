const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h] of [['PC',1280,720],['모바일',390,844]]){
const c=await b.newContext({viewport:{width:w,height:h}});const pg=await c.newPage();await pg.goto('http://localhost:8766/?debug&tier=1');await pg.waitForFunction('window.__ready',{timeout:90000});
const ss=async t=>{await pg.evaluate(t=>{const A=__agape;if(t!=='1_꽃봉오리'){document.getElementById('hint').classList.remove('on')}A.draw()},t);await pg.waitForTimeout(350);await pg.screenshot({path:`shots/콘셉트_${t}_${n}.png`})};
await pg.evaluate(()=>{__agape.step(.2)});await pg.waitForTimeout(1700);await ss('1_꽃봉오리');
await pg.evaluate(()=>{const A=__agape,G=A.garden;A.toggleWand();A.S.blown=true;A.step(3);A.S.noMic=true;A.breathe(.55);let t=0;while(t<50&&G.avg<.3){A.step(1/30);t+=1/30}A.breathe(.3);t=0;while(t<8&&!(G.drops.list.length>=11)){A.step(1/30);t+=1/30}document.getElementById('hint').classList.remove('on');document.getElementById('micBtn').hidden=true});await pg.waitForTimeout(1600);await ss('2_수분전달');
await pg.evaluate(()=>{const A=__agape,G=A.garden;A.breathe(.7);let t=0;while(t<120&&!G.ready){A.step(1/30);t+=1/30}A.breathe(0);G.flowers.forEach(f=>f.target=1);A.S.readyT=0;A.S.quietT=-30;A.step(5);document.getElementById('note').classList.remove('on');});await pg.evaluate(()=>{const A=__agape;for(const f of A.garden.flowers){f.g=1;f.wet=0;A.garden.apply(f)}A.step(.1)});await pg.waitForTimeout(2000);await ss('3_활짝핀정원');
await pg.evaluate(()=>{const A=__agape;A.S.quietT=9;A.step(10)});await pg.evaluate(()=>{__agape.resume()});await pg.waitForTimeout(3400);await pg.screenshot({path:`shots/콘셉트_4_엔딩_${n}.png`});await c.close()}
await b.close();s.close()})();
