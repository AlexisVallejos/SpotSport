import * as T from 'three';
import type { Figure, Limbs, Pt } from './demo';

// Depth of each joint, so the flat figure reads as a body when the camera orbits it.
const DEPTH = { shoulder: 0.17, elbow: 0.2, wrist: 0.2, hip: 0.1, knee: 0.11, ankle: 0.11, toe: 0.11 } as const;

const ORANGE = 0xff7900;
const ORANGE_FAR = 0xa84f00;
const WHITE = 0xf1f1ee;
const UP = new T.Vector3(0, 1, 0);

type Bone = { a: string; b: string; mesh: T.Mesh };
export type DemoScene = {
  /** Poses the mannequin. */
  show: (figure: Figure) => void;
  /** Frames the camera so every given pose fits. */
  fit: (figures: Figure[]) => void;
  /** Camera angle around the figure (0 = from the side, PI/2 = from the front) and height. */
  setView: (azimuth: number, elevation: number) => void;
  render: () => void;
  dispose: () => void;
};

function sidePoints(prefix: 'l' | 'r', limbs: Limbs, sign: 1 | -1): Record<string, T.Vector3> {
  const at = (name: keyof typeof DEPTH) => new T.Vector3(limbs[name].x, limbs[name].y, DEPTH[name] * sign);
  return {
    [`${prefix}Sh`]: at('shoulder'),
    [`${prefix}El`]: at('elbow'),
    [`${prefix}Wr`]: at('wrist'),
    [`${prefix}Hp`]: at('hip'),
    [`${prefix}Kn`]: at('knee'),
    [`${prefix}An`]: at('ankle'),
    [`${prefix}To`]: at('toe'),
  };
}

function points(figure: Figure): Record<string, T.Vector3> {
  const all = { ...sidePoints('l', figure.left, 1), ...sidePoints('r', figure.right, -1) };
  const chest = all.lSh.clone().lerp(all.rSh, 0.5);
  const head = new T.Vector3(figure.head.x, figure.head.y, 0);
  return { ...all, pelvis: all.lHp.clone().lerp(all.rHp, 0.5), chest, head, neck: chest.clone().lerp(head, 0.45) };
}

/** Returns null when WebGL is not available, so the page can show the written cues instead. */
export function createDemoScene(host: HTMLElement): DemoScene | null {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 50);
  scene.add(new T.HemisphereLight(0xffffff, 0x666660, 2.3));
  const key = new T.DirectionalLight(0xffffff, 3);
  key.position.set(-2, 4, 4);
  scene.add(key);
  const rim = new T.DirectionalLight(0xffb875, 1.4);
  rim.position.set(3, 2, -3);
  scene.add(rim);

  const floor = new T.Group();
  const disc = new T.Mesh(new T.CircleGeometry(2.4, 56), new T.MeshBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.9 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.002;
  floor.add(disc, new T.GridHelper(4.8, 24, 0x3b3b3b, 0x252525));
  scene.add(floor);

  const figureGroup = new T.Group();
  scene.add(figureGroup);

  const materials = {
    near: new T.MeshStandardMaterial({ color: ORANGE, roughness: 0.55 }),
    far: new T.MeshStandardMaterial({ color: ORANGE_FAR, roughness: 0.6 }),
    body: new T.MeshStandardMaterial({ color: WHITE, roughness: 0.65 }),
  };
  const cylinder = new T.CylinderGeometry(1, 1, 1, 14);
  const ball = new T.SphereGeometry(1, 18, 14);

  const bones: Bone[] = [];
  const balls: { at: string; radius: number; mesh: T.Mesh }[] = [];
  const bone = (a: string, b: string, radius: number, material: T.Material) => {
    const mesh = new T.Mesh(cylinder, material);
    mesh.userData.radius = radius;
    figureGroup.add(mesh);
    bones.push({ a, b, mesh });
  };
  const joint = (at: string, radius: number, material: T.Material) => {
    const mesh = new T.Mesh(ball, material);
    mesh.scale.setScalar(radius);
    figureGroup.add(mesh);
    balls.push({ at, radius, mesh });
  };

  for (const [side, material] of [['l', materials.near], ['r', materials.far]] as const) {
    bone(`${side}Sh`, `${side}El`, 0.04, material);
    bone(`${side}El`, `${side}Wr`, 0.035, material);
    bone(`${side}Hp`, `${side}Kn`, 0.055, material);
    bone(`${side}Kn`, `${side}An`, 0.045, material);
    bone(`${side}An`, `${side}To`, 0.035, material);
    for (const name of ['El', 'Wr', 'Kn', 'An', 'To']) joint(`${side}${name}`, name === 'To' ? 0.035 : 0.05, material);
  }
  bone('pelvis', 'chest', 0.12, materials.body);
  bone('lSh', 'rSh', 0.055, materials.body);
  bone('lHp', 'rHp', 0.065, materials.body);
  bone('chest', 'head', 0.035, materials.body);
  for (const name of ['lSh', 'rSh', 'lHp', 'rHp', 'pelvis', 'chest']) joint(name, 0.08, materials.body);
  joint('head', 0.115, materials.body);

  const target = new T.Vector3(0, 0.5, 0);
  let distance = 3.6;
  let azimuth = 0;
  let elevation = 0.2;

  function show(figure: Figure) {
    const p = points(figure);
    const direction = new T.Vector3();
    for (const { a, b, mesh } of bones) {
      const from = p[a];
      const to = p[b];
      direction.subVectors(to, from);
      const length = Math.max(direction.length(), 1e-4);
      mesh.position.copy(from).addScaledVector(direction, 0.5);
      mesh.scale.set(mesh.userData.radius, length, mesh.userData.radius);
      mesh.quaternion.setFromUnitVectors(UP, direction.divideScalar(length));
    }
    for (const { at, mesh } of balls) mesh.position.copy(p[at]);
  }

  function fit(figures: Figure[]) {
    const box = new T.Box3();
    for (const figure of figures) for (const point of Object.values(points(figure))) box.expandByPoint(point);
    box.expandByVector(new T.Vector3(0.15, 0.1, 0.15));
    box.min.y = Math.min(box.min.y, 0);
    const size = box.getSize(new T.Vector3());
    box.getCenter(target);
    const radius = Math.max(size.x * 0.9, size.y * 1.25, 1.3) / 2;
    distance = radius * 2.9;
    // Looking a little above the figure leaves room under the cue text at the top of the stage.
    target.y += radius * 0.22;
    floor.position.set(target.x, 0, 0);
  }

  function setView(az: number, el: number) {
    azimuth = az;
    elevation = el;
  }

  function render() {
    const { width, height } = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const size = renderer.getSize(new T.Vector2());
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    camera.position.set(target.x + distance * Math.sin(azimuth) * Math.cos(elevation), target.y + distance * Math.sin(elevation), target.z + distance * Math.cos(azimuth) * Math.cos(elevation));
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  function dispose() {
    cylinder.dispose();
    ball.dispose();
    disc.geometry.dispose();
    (disc.material as T.Material).dispose();
    Object.values(materials).forEach((material) => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { show, fit, setView, render, dispose };
}

export type { Pt };
