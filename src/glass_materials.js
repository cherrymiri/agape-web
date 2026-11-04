// AGAPE 빛의 정원 — Three.js 재질 프리셋 (r170 기준)
// 모든 꽃 파츠는 같은 UV 규칙을 씁니다: Blender V=0 중심부(가장 밝음) → V=1 꽃잎 끝, 줄기는 .55~.80
// transmission(실제 굴절)은 꽃 수가 많으면 무거워서 쓰지 않고, 반투명 + 환경반사 + 발광맵으로 유리감을 만듭니다.
import * as THREE from 'three';

export const GLASS_KEYS = ['aurora', 'pearl', 'milky', 'glow'];
export const GLASS_LABELS = { aurora: '3 오로라 유리', pearl: '4 진주광 유리', milky: '5 뽀얀 유리', glow: '6 은은한 발광 유리' };

function canvasTex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;                // glTF UV 규칙. 캔버스 맨 위 = 꽃잎 끝, 맨 아래 = 중심부
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// stops: [Blender V, css색] — V값 기준 세로 그라데이션
function radialMap(stops) {
  return canvasTex(4, 256, (g, w, h) => {
    const l = g.createLinearGradient(0, h, 0, 0);
    stops.forEach(([v, c]) => l.addColorStop(v, c));
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  });
}

function auroraMap() {
  const stops = [[.74, .64, 1], [.58, .82, 1], [.68, 1, .86], [1, .93, .68], [1, .68, .84], [.74, .64, 1]];
  return canvasTex(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = 1 - y / h;
      const wob = .16 * Math.sin(u * 7 + v * 5) + .10 * Math.sin(v * 9 - u * 4);
      const p = ((u * .55 + v * .85 + wob + .3) % 1 + 1) % 1 * (stops.length - 1);
      const i = Math.floor(p), f = p - i, a = stops[i], b = stops[i + 1];
      const k = (x + y * w) * 4;
      for (let c = 0; c < 3; c++) img.data[k + c] = 255 * (a[c] * (1 - f) + b[c] * f);
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

export function createGlassMaterials() {
  const base = { transparent: true, side: THREE.FrontSide, depthWrite: true };
  return {
    aurora: new THREE.MeshPhysicalMaterial({
      ...base, name: 'GLASS_3_Aurora', color: 0xd9d0fa, opacity: .72, roughness: .08, metalness: 0,
      clearcoat: 1, clearcoatRoughness: .05, iridescence: 1, iridescenceIOR: 1.45, iridescenceThicknessRange: [420, 620],
      emissive: 0xffffff, emissiveMap: auroraMap(), emissiveIntensity: .30, envMapIntensity: 1.3,
    }),
    pearl: new THREE.MeshPhysicalMaterial({
      ...base, name: 'GLASS_4_Pearl', color: 0xfae6f2, opacity: .90, roughness: .24, metalness: 0,
      clearcoat: 1, clearcoatRoughness: .08, sheen: 1, sheenRoughness: .4, sheenColor: 0xffdcef,
      iridescence: .45, iridescenceIOR: 1.5, iridescenceThicknessRange: [280, 340],
      emissive: 0xffffff, emissiveMap: radialMap([[0, '#ffe4ee'], [.3, '#e2c8ec'], [1, '#c4b4e0']]), emissiveIntensity: .30, envMapIntensity: 1.1,
    }),
    milky: new THREE.MeshPhysicalMaterial({
      ...base, name: 'GLASS_5_Milky', color: 0xf4f2fb, opacity: .88, roughness: .55, metalness: 0,
      emissive: 0xffffff, emissiveMap: radialMap([[0, '#ffffff'], [.35, '#d8d8f0'], [1, '#c4c4e4']]), emissiveIntensity: .38, envMapIntensity: .7,
    }),
    glow: new THREE.MeshPhysicalMaterial({
      ...base, name: 'GLASS_6_Glow', color: 0xffefd8, opacity: .90, roughness: .15, metalness: 0,
      clearcoat: .7, clearcoatRoughness: .1,
      emissive: 0xffffff, emissiveMap: radialMap([[0, '#ffe2a8'], [.18, '#ffb878'], [.55, '#d99468'], [1, '#70504e']]), emissiveIntensity: 1.25, envMapIntensity: .8,
    }),
  };
}

export function createWandMaterial() {
  return new THREE.MeshPhysicalMaterial({
    name: 'WAND_MilkyAurora', color: 0xf0ecf8, transparent: true, opacity: .82, roughness: .30,
    clearcoat: .6, clearcoatRoughness: .15, iridescence: .7, iridescenceIOR: 1.42, iridescenceThicknessRange: [380, 460],
    emissive: 0xe8e0f4, emissiveIntensity: .22, envMapIntensity: 1,
  });
}

// 꽃 하나(또는 clone)의 모든 파츠에 재질 적용. 같은 재질 객체를 공유해야 드로우 비용이 줄어듭니다.
export function applyGlass(root, material) {
  root.traverse(o => { if (o.isMesh) o.material = material; });
}

export function randomGlass(materials) {
  return materials[GLASS_KEYS[Math.floor(Math.random() * GLASS_KEYS.length)]];
}

// 유리 반사용 소프트박스 환경. scene.environment에 넣어 쓰고, 화면 배경은 별도로 검게 둡니다.
export function createGlassEnvironment(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x07060e);
  const box = (w, h, col, i, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  box(4, 2.4, '#fff4fb', 7, [-4, 4, 5]);
  box(7, .6, '#e9e0ff', 3, [0, .6, 8]);
  box(3, 3, '#b8a8ff', 5, [6, 1, -3]);
  box(3, 2, '#ffc8e6', 3.5, [5, -2, 5]);
  box(10, 3, '#4a3a86', 1, [0, -6, 0]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, .03).texture;
  pm.dispose();
  return tex;
}
