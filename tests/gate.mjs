import {BreathGate} from '../src/breath.js';
const g=new BreathGate(.5),dt=1/60;const fr=(db,per=.2,fl=.3)=>({db,periodicity:per,flatness:fl});
const run=(sec,f)=>{let on=0,n=0;for(let t=0;t<sec;t+=dt){g.push(f(t),dt);n++;if(g.on)on++}return on/n};
run(1,()=>fr(-60));const a=run(14,t=>fr(-30+3*Math.sin(t*3)));console.log('14초 연속 숨 유지율',a.toFixed(3),'floor',g.floor.toFixed(1));
const off=run(1,()=>fr(-60));let t0=null;let tt=0;for(;tt<1;tt+=dt){g.push(fr(-32),dt);if(g.on&&t0===null)t0=tt}console.log('멈춘 뒤 비율',off.toFixed(2),'재개 지연',t0?.toFixed(3));g.push(fr(-60),dt);
