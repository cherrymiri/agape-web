// 모바일 점검: iPhone 에뮬레이션(실제 iOS Safari는 아님). 단독 페이지 + 통합 갤러리 경유(세로·가로)
const {serve,launch}=require('./lib.cjs');const {devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const O='/home/claude/agape-web/export/mobile/',G='/home/claude/when-love-responds';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'};
(async()=>{const s=serve();
const g=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=G+p;if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))}).listen(8767);
const b=await launch(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']);
const dev=devices['iPhone 13'];const out={};
// 1) 단독
{const c=await b.newContext({...dev,permissions:['microphone']});const pg=await c.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.setDefaultTimeout(240000);
 await pg.goto('http://localhost:8766/?debug');await pg.waitForFunction('window.__ready');
 await pg.evaluate(()=>__agape.toggleWand());await pg.waitForTimeout(1500);
 const vis=await pg.evaluate(()=>({mic:!document.getElementById('micBtn').hidden}));
 if(vis.mic)await pg.tap('#micBtn');await pg.waitForTimeout(2500);
 out.standalone=await pg.evaluate(()=>{const A=__agape,m=A.mic(),r=A.renderer,cv=r.domElement;return{dpr:devicePixelRatio,pixelRatio:r.getPixelRatio(),css:[innerWidth,innerHeight],buffer:[cv.width,cv.height],tier:A.quality.t.name,samples:A.quality.t.samples,micReady:!!m?.ready,ctx:m?.ctx?.state,mute:!!m?.mute,setBtnLive:document.getElementById('setBtn').className}});
 await pg.screenshot({path:O+'standalone.png'});out.standalone.errs=errs;await c.close()}
// 2) 갤러리 경유: 작품 주소를 로컬 빌드로 연결
for(const [name,land] of [['portrait',false],['landscape',true]]){
 const vp=land?{width:dev.viewport.height,height:dev.viewport.width}:dev.viewport;
 const c=await b.newContext({...dev,viewport:vp,permissions:['microphone']});const pg=await c.newPage();pg.setDefaultTimeout(240000);
 await pg.route('https://agape-web-rouge.vercel.app/**',rt=>{const u=new URL(rt.request().url());let p=u.pathname==='/'?'/index.html':u.pathname;const f='/home/claude/agape-web/dist'+p;
  if(!fs.existsSync(f))return rt.fulfill({status:404});rt.fulfill({path:f,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.woff2':'font/woff2','.woff':'font/woff'})[path.extname(f)]||'application/octet-stream'})});
 await pg.route('http://localhost:8767/works.js',async rt=>rt.fulfill({contentType:'text/javascript',body:fs.readFileSync(G+'/works.js','utf8').replace("'https://agape-web-rouge.vercel.app'","'https://agape-web-rouge.vercel.app/?debug'")}));
 await pg.goto('http://localhost:8767/');await pg.waitForTimeout(800);
 await pg.click('a[data-id="agape"]');await pg.waitForTimeout(1500);
 const f=pg.frames().find(x=>x.url().includes('agape-web-rouge'));await f.waitForFunction('window.__ready');
 await f.evaluate(()=>{window.AGAPE_NO_MIC=0});
 // 막대 들기 → 마이크 켜기 → (가짜 마이크) / 길게 눌러 불기 버튼도 표시해 겹침 확인
 await f.evaluate(()=>document.getElementById('wandBtn').click());await pg.waitForTimeout(1200);
 const mb=await f.$('#micBtn:not([hidden])');if(mb)await mb.tap();await pg.waitForTimeout(2500);
 const micInFrame=await f.evaluate(()=>{const m=__agape.mic();return{ready:!!m?.ready,ctx:m?.ctx?.state}});
 await f.evaluate(()=>{document.getElementById('noMic').click();});await pg.waitForTimeout(600);  // 마이크 없이 → 길게 눌러 불기 표시
 const box=async(fr,sel)=>{const e=await fr.$(sel);if(!e)return null;const bb=await e.boundingBox();return bb&&{x:Math.round(bb.x),y:Math.round(bb.y),w:Math.round(bb.width),h:Math.round(bb.height)}};
 const r={back:await box(pg,'#back'),iframe:await box(pg,'#viewer iframe'),hold:await box(f,'#holdBtn'),set:await box(f,'#setBtn'),micInFrame};
 const ov=(a,b2)=>a&&b2&&a.x<b2.x+b2.w&&b2.x<a.x+a.w&&a.y<b2.y+b2.h&&b2.y<a.y+a.h;
 r.backOverHold=ov(r.back,r.hold);r.backOverSet=ov(r.back,r.set);r.backAboveFrame=r.back&&r.iframe?r.back.y+r.back.h<=r.iframe.y:null;
 // 길게 누르기: 1.5초 동안 유지되는지
 const hb=await f.$('#holdBtn');const hbb=await hb.boundingBox();const cx=hbb.x+hbb.width/2,cy=hbb.y+hbb.height/2;
 const cdp=await c.newCDPSession(pg);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy}]});await pg.waitForTimeout(1500);
 r.holdingAfter1_5s=await f.evaluate(()=>__agape.S.hold);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pg.waitForTimeout(300);
 r.releasedAfterLift=!(await f.evaluate(()=>__agape.S.hold));r.bubblesBorn=await f.evaluate(()=>__agape.bubbles.stats.born);
 await pg.screenshot({path:O+'gallery_'+name+'.png'});out[name]=r;await c.close()}
console.log(JSON.stringify(out,null,1));await b.close();s.close();g.close()})();
