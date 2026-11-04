// 비눗막과 비눗방울은 같은 메쉬입니다. 고리의 평평한 막 → 부푼 구면 → 입구가 닫힌 구.
import * as THREE from 'three';

const R = 18, A = 36;
function grid() {
  const p = [], uv = [], ix = [];
  for (let i = 0; i <= R; i++) for (let j = 0; j <= A; j++) { p.push(0, 0, 0); uv.push(i / R, j / A); }
  for (let i = 0; i < R; i++) for (let j = 0; j < A; j++) {
    const a = i * (A + 1) + j, b = a + A + 1;
    ix.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  return g;
}

const vert = /* glsl */`
uniform float uH, uA, uClose, uTime, uWob, uSeed;
varying vec3 vN, vV, vP; varying vec2 vUv;
const float PI = 3.14159265;
void main(){
  float s = uv.x, ph = uv.y * 2. * PI;
  float h = max(uH, .0025);
  float Rs = (uA*uA + h*h) / (2.*h);
  float tmax = mix(2.*atan(h, uA), PI, uClose);
  float th = s * tmax;
  vec3 n = vec3(sin(th)*cos(ph), sin(th)*sin(ph), cos(th));
  float w = uWob * (sin(ph*2. + uTime*3.1 + uSeed) * .6 + sin(ph*3. - uTime*2.3) * .4) * sin(min(s*1.2,1.)*PI*.5);
  vec3 p = vec3(0., 0., h - Rs) + (Rs + w * min(Rs, .6)) * n;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz); vP = p / min(Rs, 1.); vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */`
uniform float uTime, uAlpha, uPop, uForm, uSeed;
varying vec3 vN, vV, vP; varying vec2 vUv;
float n3(vec3 p){ return .5 + .25*(sin(p.x*2.1+sin(p.y*1.7)) + sin(p.y*2.6+sin(p.z*1.9+1.3))) ; }
void main(){
  vec3 N = normalize(vN); float c = abs(dot(N, vV));
  float fres = pow(1. - c, 2.4);
  float flow = n3(vP*1.6 + vec3(uSeed, uTime*.22, uTime*.13)) + .35*vP.y;
  float phase = (.9 + 1.25*flow) * (.55 + .45*c);
  vec3 film = .5 + .5*cos(6.2832*(phase*vec3(1.,1.22,1.5) + vec3(.02,.13,.28)));
  film.g *= .8; film.b = min(film.b*1.1, 1.);
  vec3 col = mix(vec3(.95,.93,1.), film, .52);
  vec3 R = reflect(-vV, N * (gl_FrontFacing ? 1. : -1.));
  float s1 = pow(max(dot(R, normalize(vec3(-.5,.65,.55))), 0.), 90.);
  float s2 = pow(max(dot(R, normalize(vec3(.55,-.35,.6))), 0.), 40.) * .28;
  float a = (.016 + .08*fres + .50*pow(fres,1.6)) * uAlpha;
  // 막이 고리 위쪽에서 아래로 덮이며 형성
  float sw = uForm*2.4 - 1.2; a *= smoothstep(sw+.12, sw-.12, -vUv.x*sin(vUv.y*6.2832)) ; 
  a *= smoothstep(0., .4, uForm);
  vec3 emit = col * a;
  float spec = (s1 + s2) * uAlpha * smoothstep(.3,1.,uForm);
  if(uPop > 0.){
    float d = n3(vP*3.4 + uSeed) + .25*vP.y;
    float m = smoothstep(uPop*1.5-.25, uPop*1.5, d + .1);
    float rimFlash = smoothstep(.16,.0,abs(d + .1 - uPop*1.5 + .1)) * (1.-uPop);
    a *= m; spec *= m * (1.-uPop); emit = col*a + vec3(.9,.86,1.)*rimFlash*.55;
    a += rimFlash*.3;
  }
  gl_FragColor = vec4(emit + spec, clamp(a + spec, 0., 1.));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const geo = grid();
const baseMat = new THREE.ShaderMaterial({
  vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  uniforms: {},
});
baseMat.toneMapped = true;

export function createFilm(radius) {
  const m = baseMat.clone();
  m.uniforms = {
    uH: { value: .0025 }, uA: { value: radius }, uClose: { value: 0 }, uTime: { value: 0 }, uWob: { value: 0 },
    uSeed: { value: Math.random() * 20 }, uAlpha: { value: 1 }, uPop: { value: 0 }, uForm: { value: 0 },
  };
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  return mesh;
}
export const filmRadius = u => (u.uA.value ** 2 + Math.max(u.uH.value, .0025) ** 2) / (2 * Math.max(u.uH.value, .0025));
