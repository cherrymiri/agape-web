const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const D='/home/claude/agape-web/dist',mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.woff2':'font/woff2'};
exports.serve=(dir=D)=>http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=dir+p;if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))}).listen(8766);
exports.launch=(a=[])=>chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader',...a]});
