const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h] of [['PC',1280,720],['모바일',390,844]]){
const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:n=='PC'?1:1});const pg=await c.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error'&&!/ERR_/.test(m.text()))errs.push(m.text().slice(0,300))});
await pg.goto('http://localhost:8766/?debug&tier='+(process.argv[2]||1));await pg.waitForFunction('window.__ready',{timeout:90000});
const ss=async t=>{await pg.evaluate(t=>{const A=__agape;A.draw();if(t!=='1_시작'){document.getElementById('hint').classList.remove('on')}},t);await pg.waitForTimeout(300);await pg.evaluate(()=>__agape.draw());await pg.screenshot({path:`shots/t9_${t}_${n}.png`})};
await pg.evaluate(()=>{__agape.step(.2)});await pg.waitForTimeout(1700);await ss('1_시작');
await pg.evaluate(()=>{const A=__agape,G=A.garden;A.toggleWand();A.S.blown=true;A.step(3);A.breathe(.6);let t=0;while(t<30&&G.flowers.filter(f=>f.g>=1).length<9){A.step(1/30);t+=1/30}window.__t=t});await pg.waitForTimeout(100);await pg.evaluate(()=>{document.getElementById('hint').classList.remove('on');document.getElementById('micBtn').hidden=true});await pg.waitForTimeout(1500);await ss('2_개화중');
const r=await pg.evaluate(()=>{const A=__agape,G=A.garden;A.breathe(.6);let t=window.__t;while(t<120&&G.opened<30&&A.S.phase==='play'){if(G.opened>=29.5)break;A.step(1/30);t+=1/30;if(G.flowers.every(f=>f.opening||f.g>=1)){A.breathe(0);break}}const k=G.opened;A.__t=t;return{t,opened:k,hits:A.bubbles.stats.hits,flew:A.bubbles.stats.flew,born:A.bubbles.stats.born,ph:A.S.phase,avg:G.avg}});console.log(n,JSON.stringify(r),errs);
await pg.evaluate(()=>{const A=__agape,G=A.garden;const N=()=>G.flowers.filter(f=>f.g<1);while(N().length>0&&G.flowers.filter(f=>f.g>=1).length<29){A.step(1/30)}});
await pg.evaluate(()=>{const A=__agape,G=A.garden;/* 마지막 꽃 직전: 완성 정원 */let i=0;while(G.flowers.filter(f=>f.g<1).length>1&&i++<200)A.step(1/30);A.draw()});await ss('3_완성정원');
await pg.evaluate(()=>{const A=__agape;let i=0;while(A.S.phase==='play'&&i++<300)A.step(1/30);A.step(7);A.draw();A.resume()});await pg.waitForTimeout(3000);await pg.screenshot({path:`shots/t9_4_엔딩_${n}.png`});console.log(errs);await c.close()}
await b.close();s.close()})();
