const {serve,launch}=require('./lib.cjs');const fs=require('fs');
(async()=>{const s=serve(),b=await launch();
const pg=await b.newPage({viewport:{width:1280,height:720}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8766/?debug&tier=0');await pg.waitForFunction('window.__ready',{timeout:90000});
const shot=async n=>{await pg.evaluate(()=>__agape.draw());await pg.waitForTimeout(200);await pg.screenshot({path:`tests/n_${n}.png`})};
await pg.evaluate(()=>__agape.step(.2));await shot('1rest');
await pg.evaluate(()=>{__agape.toggleWand();__agape.step(3)});await shot('2up');
// 자연스러운 숨 곡선
const breath=await pg.evaluateHandle(()=>(st,len)=>{const A=__agape;const dt=1/30;for(let t=0;t<len;t+=dt){const e=Math.min(t/.25,1)*Math.min((len-t)/.35,1);A.breathe(Math.max(.05,st*e*(1+.2*Math.sin(t*5+Math.random()))));A.step(dt)}A.breathe(0)});
await pg.evaluate(b=>{b(.85,1.5)},breath);await shot('3burst');
await pg.evaluate(b=>{__agape.step(.8);b(.9,2.6)},breath);await shot('4mix');
await pg.evaluate(()=>__agape.step(1.5));await shot('5float');
const one=async(st,len)=>pg.evaluate(([b,st,len])=>{const A=__agape;A.step(14);const B=A.bubbles,s0=B.stats.born;b(st,len);A.step(.5);return{n:B.stats.born-s0,sz:B.stats.sizes.slice(s0)}},[breath,st,len]);
const rows=[];for(const [st,len] of [[.25,.5],[.25,.5],[.25,.5],[.85,2.5],[.85,2.5],[.85,2.5],[.5,1.5],[.5,1.5]])rows.push({st,len,...await one(st,len)});
console.log(rows.map(r=>`${r.st}/${r.len}s n=${r.n} [${r.sz.map(x=>x.toFixed(2)).join(' ')}]`).join('\n'));
// 대량 통계
const st=await pg.evaluate(b=>{const A=__agape;A.step(14);const B=A.bubbles;for(let i=0;i<60;i++){b(.35+Math.random()*.6,.6+Math.random()*2.6);A.step(.4+Math.random()*2)}A.step(30);const S=B.stats;return{...S,flowers:A.garden.total,seeds:A.garden.seeds.length,left:B.list.length,live:0}},breath);
const sz=[...st.sizes].sort((a,b)=>a-b),q=p=>sz[Math.floor(p*(sz.length-1))];
const gaps=[];for(let i=1;i<st.times.length;i++){const g=st.times[i]-st.times[i-1];if(g<1.2)gaps.push(g)}
const m=gaps.reduce((a,c)=>a+c,0)/gaps.length,sd=Math.sqrt(gaps.reduce((a,c)=>a+(c-m)**2,0)/gaps.length);
const lv=st.lives.filter(x=>x>0);
console.log({born:st.born,popped:st.popped,flew:st.flew,popRate:(st.popped/(st.popped+st.flew)).toFixed(2),left:st.left,flowersPlusLive:st.flowers,sizeQ:[q(0),q(.1),q(.5),q(.9),q(1)],gapMean:m.toFixed(3),gapCV:(sd/m).toFixed(2),under15:gaps.filter(g=>g<.15).length/gaps.length,mid:gaps.filter(g=>g>=.2&&g<.5).length/gaps.length,lifeQuick:lv.filter(x=>x<2.2).length/lv.length,lifeLong:lv.filter(x=>x>7).length/lv.length});
console.log('errs',errs);await b.close();s.close()})();
