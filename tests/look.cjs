const {serve,launch}=require('./lib.cjs');
(async()=>{const s=serve(),b=await launch();
for(const [n,w,h] of [['pc',1280,720],['mo',390,844]]){
const pg=await b.newPage({viewport:{width:w,height:h}});
pg.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(n,m.text().slice(0,160))});pg.on('pageerror',e=>console.log('PE',e.message));
await pg.goto('http://localhost:8766/?debug&tier=1');await pg.waitForFunction('window.__ready',{timeout:90000});
const ss=async t=>{await pg.evaluate(()=>__agape.draw());await pg.waitForTimeout(250);await pg.screenshot({path:`/home/claude/agape-web/tests/s_${n}_${t}.png`})};
await pg.evaluate(()=>__agape.step(.1));await ss('1start');
await pg.evaluate(()=>{__agape.toggleWand();__agape.step(3)});await ss('2up');
await pg.evaluate(()=>{__agape.breathe(.7);__agape.step(.55)});await ss('3inflate');
await pg.evaluate(()=>{__agape.step(1.1);__agape.breathe(0);__agape.step(2)});await ss('4float');
await pg.evaluate(()=>{for(let i=0;i<14;i++){__agape.breathe(.4+.5*Math.random());__agape.step(.9);__agape.breathe(0);__agape.step(1.2)}__agape.step(4)});await ss('5mid');
await pg.evaluate(()=>{for(let i=0;i<30;i++){__agape.breathe(.8);__agape.step(.8);__agape.breathe(0);__agape.step(.8)}__agape.step(16)});await ss('6garden');
console.log(n,await pg.evaluate(()=>({popped:__agape.S.popped,total:__agape.garden.total,done:__agape.garden.done.length,slots:__agape.garden.slots.length,counts:__agape.garden.counts})));
await pg.evaluate(()=>{__agape.startEnding();__agape.step(8)});await pg.waitForTimeout(3000);await ss('7end');await pg.close()}
await b.close();s.close()})();
