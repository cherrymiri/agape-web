const {launch}=require('./lib.cjs');
(async()=>{const b=await launch(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/home/claude/agape-web/tests/mic.wav','--allow-file-access-from-files']);
for(const [n,f] of [['artifact','artifact.html'],['file','AGAPE_테스트3.html']]){
 const pg=await b.newPage({viewport:{width:1100,height:680}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error'&&!/ERR_|Failed to load/.test(m.text()))errs.push(m.text())});
 if(n=='artifact'){await pg.setContent('<!doctype html><meta charset=utf-8>'+require('fs').readFileSync('/home/claude/agape-web/single/'+f,'utf8'))}else await pg.goto('file:///home/claude/agape-web/single/'+encodeURIComponent(f));
 await pg.waitForFunction(()=>!document.getElementById('hint').textContent.includes('불러오지')&&document.getElementById('hint').textContent.length>0,{timeout:60000});
 await pg.waitForTimeout(4000);
 await pg.mouse.click(760,500);await pg.waitForTimeout(600);
 let hp=await pg.evaluate(()=>({up:!document.getElementById('setBtn').hidden,hold:!document.getElementById('holdBtn').hidden,mic:!document.getElementById('micBtn').hidden,hint:document.getElementById('hint').textContent}));
 console.log(n,hp,errs.slice(0,3));
 if(n=='file'&&hp.mic){await pg.click('#micBtn');await pg.waitForTimeout(1500);console.log(await pg.evaluate(()=>document.getElementById('micState').textContent))}
 await pg.waitForTimeout(5000);await pg.screenshot({path:`/home/claude/agape-web/tests/s_${n}.png`});await pg.close()}
await b.close()})();
