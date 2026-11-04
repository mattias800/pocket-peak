import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNCE, COINS, ENEMIES, FRAGMENTS, SUMMIT } from './level';
import type { Platform } from './level';

const palette = {
  grass: '#90bd69',
  grassTop: '#a7cd7e',
  grassDark: '#6e9f59',
  earth: '#d5aa7c',
  rock: '#c6956b',
  cream: '#fff3ce',
  teal: '#37786c',
  dark: '#244b3f',
  gold: '#ffd15f',
  red: '#e77d58',
  blue: '#4d9c9c',
};
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string, metalness = 0): THREE.MeshStandardMaterial {
  const key = color + metalness;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness, flatShading: true }),
    );
  return materials.get(key)!;
}
function mesh(
  geometry: THREE.BufferGeometry,
  color: string,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material(color));
  object.position.set(x, y, z);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}
function ball(
  parent: THREE.Object3D,
  color: string,
  x: number,
  y: number,
  z: number,
  radius: number,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Mesh {
  const object = mesh(new THREE.IcosahedronGeometry(radius, 2), color, parent, x, y, z);
  object.scale.set(sx, sy, sz);
  return object;
}
function box(
  parent: THREE.Object3D,
  color: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  radius = 0.07,
): THREE.Mesh {
  return mesh(
    new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)),
    color,
    parent,
    x,
    y,
    z,
  );
}
function cylinder(
  parent: THREE.Object3D,
  color: string,
  x: number,
  y: number,
  z: number,
  top: number,
  bottom: number,
  height: number,
  sides = 10,
): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(top, bottom, height, sides), color, parent, x, y, z);
}
function seeded(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function starGeometry(radius: number, points = 5): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points + Math.PI / 2,
      r = i % 2 ? radius * 0.46 : radius;
    const x = Math.cos(angle) * r,
      y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: radius * 0.25,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: radius * 0.07,
    bevelThickness: radius * 0.07,
  });
}
export interface HeroVisual {
  group: THREE.Group;
  model: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  shadow: THREE.Mesh;
}
export interface WorldVisuals {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hero: HeroVisual;
  coins: THREE.Group[];
  fragments: THREE.Group[];
  star: THREE.Group;
  enemies: THREE.Group[];
  platforms: Map<string, THREE.Group>;
  bounce: THREE.Group;
  clouds: THREE.Group[];
  flag: THREE.Group;
  dustGeometry: THREE.IcosahedronGeometry;
}

function makeHero(scene: THREE.Scene): HeroVisual {
  const group = new THREE.Group(),
    model = new THREE.Group();
  group.add(model);
  scene.add(group);
  const leg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42, 0);
    model.add(pivot);
    box(pivot, palette.teal, 0, -0.12, 0, 0.21, 0.3, 0.24);
    box(pivot, '#815840', 0, -0.32, 0.07, 0.25, 0.18, 0.37);
    return pivot;
  };
  const leftLeg = leg(-0.14),
    rightLeg = leg(0.14);
  ball(model, palette.blue, 0, 0.65, 0, 0.34, 0.95, 1, 0.72);
  box(model, palette.teal, 0, 0.63, 0.24, 0.3, 0.24, 0.08, 0.025);
  for (const x of [-0.105, 0.105]) ball(model, palette.gold, x, 0.71, 0.29, 0.032);
  const arm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.78, 0);
    model.add(pivot);
    ball(pivot, palette.blue, 0, -0.12, 0, 0.13, 0.85, 1.5, 0.85);
    ball(pivot, palette.cream, 0, -0.29, 0.015, 0.13);
    return pivot;
  };
  const leftArm = arm(-0.34),
    rightArm = arm(0.34);
  ball(model, '#f6d0a2', 0, 1.04, 0.01, 0.29, 1, 1.05, 0.94);
  ball(model, '#d69e70', -0.27, 1.05, 0.01, 0.065);
  ball(model, '#d69e70', 0.27, 1.05, 0.01, 0.065);
  for (const x of [-0.1, 0.1]) {
    ball(model, '#fff9e5', x, 1.08, 0.254, 0.072, 0.78, 1.1, 0.3);
    ball(model, palette.dark, x, 1.08, 0.277, 0.04, 0.7, 1.25, 0.4);
  }
  ball(model, '#edb78b', 0, 1.0, 0.29, 0.075, 1, 0.8, 0.8);
  ball(model, '#865635', 0, 1.2, -0.12, 0.25, 1, 0.6, 0.8);
  ball(model, palette.red, 0, 1.27, -0.015, 0.33, 1, 0.6, 1);
  box(model, palette.red, 0, 1.23, 0.24, 0.45, 0.07, 0.33);
  ball(model, palette.cream, 0, 1.32, 0.266, 0.078, 1, 1, 0.25);
  const scarf = box(model, palette.gold, 0, 0.85, 0, 0.42, 0.1, 0.32, 0.025);
  scarf.rotation.z = 0.05;
  const tail = box(model, palette.gold, 0.16, 0.73, -0.19, 0.12, 0.26, 0.06, 0.025);
  tail.rotation.z = -0.25;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 24),
    new THREE.MeshBasicMaterial({
      color: '#264a35',
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return { group, model, leftLeg, rightLeg, leftArm, rightArm, shadow };
}
function tree(parent: THREE.Object3D, x: number, y: number, z: number, scale = 1): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  cylinder(group, '#947653', 0, 0.75, 0, 0.14, 0.22, 1.5, 8);
  for (const [py, r] of [
    [1.2, 0.85],
    [1.8, 0.7],
    [2.3, 0.5],
  ])
    cylinder(group, py === 1.8 ? '#568b68' : '#619b72', 0, py, 0, 0, r, 1.3, 7);
}
function flower(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  size: number,
): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  cylinder(group, palette.grassDark, 0, size * 0.8, 0, 0.018, 0.025, size * 1.6, 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ball(
      group,
      color,
      Math.cos(a) * size * 0.5,
      size * 1.7,
      Math.sin(a) * size * 0.5,
      size * 0.45,
      1,
      0.5,
      1,
    );
  }
  ball(group, palette.gold, 0, size * 1.8, 0, size * 0.3);
}
function makePlatform(parent: THREE.Scene, platform: Platform): THREE.Group {
  const group = new THREE.Group();
  group.position.set(platform.x, platform.y, platform.z);
  parent.add(group);
  const { width: w, depth: d, thickness: h } = platform;
  if (platform.radius) {
    const r = platform.radius;
    cylinder(group, palette.earth, 0, -h * 0.48, 0, r * 0.98, r * 0.75, h * 0.9, 14);
    cylinder(group, palette.rock, 0, -h * 0.89, 0, r * 0.75, r * 0.22, h * 0.5, 14);
    cylinder(group, palette.grassDark, 0, -0.18, 0, r, r * 0.98, 0.3, 48);
    cylinder(group, palette.grassTop, 0, -0.025, 0, r * 0.997, r, 0.05, 64);
    const random = seeded(r * 100);
    for (let i = 0; i < (r > 3 ? 50 : 5); i++) {
      const angle = random() * Math.PI * 2,
        radius = Math.sqrt(random()) * r * 0.92;
      const patch = mesh(
        new THREE.CircleGeometry(0.3 + random() * 0.7, 6),
        i % 2 ? '#9fc878' : '#afd18a',
        group,
        Math.cos(angle) * radius,
        0.006,
        Math.sin(angle) * radius,
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = angle;
      patch.receiveShadow = true;
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ball(
        group,
        i % 2 ? '#bb8b64' : '#e3bd8d',
        Math.cos(a) * r * 0.9,
        -0.7 - random() * (h * 0.45),
        Math.sin(a) * r * 0.9,
        r > 3 ? 0.3 : 0.12,
        1.4,
        0.5,
        0.7,
      );
    }
  } else if (platform.kind === 'block') {
    box(group, '#dda54b', 0, -h / 2, 0, w, h, d, 0.08);
    for (const axis of ['z', 'x'])
      for (const sign of [-1, 1]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ecc166';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#fff0ba';
        ctx.font = 'bold 100px Trebuchet MS';
        ctx.textAlign = 'center';
        ctx.fillText('?', 64, 101);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(0.83, 0.83),
          new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 1 }),
        );
        face.position.set(axis === 'x' ? sign * 0.506 : 0, -0.5, axis === 'z' ? sign * 0.506 : 0);
        face.rotation.y = axis === 'x' ? (sign * Math.PI) / 2 : sign === 1 ? 0 : Math.PI;
        group.add(face);
      }
  } else {
    box(
      group,
      platform.kind === 'moving' ? '#b6a06a' : palette.earth,
      0,
      -h / 2 - 0.08,
      0,
      w,
      h,
      d,
      0.12,
    );
    box(group, palette.grassDark, 0, -0.17, 0, w + 0.05, 0.28, d + 0.05, 0.1);
    box(
      group,
      platform.kind === 'moving' ? '#c4d98a' : palette.grassTop,
      0,
      -0.015,
      0,
      w + 0.04,
      0.03,
      d + 0.04,
      0.01,
    );
    if (platform.kind !== 'moving') {
      for (let i = 0; i < 4; i++)
        box(
          group,
          i % 2 ? '#e3ba8a' : '#bd8e64',
          -w / 2 + 0.45 + (i * (w - 0.9)) / 3,
          -0.5 - (i % 2) * 0.35,
          d / 2 + 0.005,
          0.42,
          0.16,
          0.025,
          0.01,
        );
    }
  }
  return group;
}

/** Bake static scenery by material, keeping actors and interactive objects separate. */
function batchScenery(scene: THREE.Scene, excluded: Set<THREE.Object3D>): void {
  scene.updateMatrixWorld(true);
  const batches = new Map<
    string,
    {
      material: THREE.Material;
      geometries: THREE.BufferGeometry[];
      cast: boolean;
      receive: boolean;
    }
  >();
  const originals: THREE.Mesh[] = [];
  const collect = (object: THREE.Object3D) => {
    if (excluded.has(object)) return;
    if (object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.map) {
      const key = `${object.material.id}-${object.castShadow}-${object.receiveShadow}`;
      if (!batches.has(key))
        batches.set(key, {
          material: object.material,
          geometries: [],
          cast: object.castShadow,
          receive: object.receiveShadow,
        });
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      batches.get(key)!.geometries.push(geometry);
      originals.push(object);
    }
    for (const child of object.children) collect(child);
  };
  collect(scene);
  for (const object of originals) object.removeFromParent();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    if (!geometry) throw new Error('Could not batch scenery geometry');
    const combined = new THREE.Mesh(geometry, batch.material);
    combined.castShadow = batch.cast;
    combined.receiveShadow = batch.receive;
    scene.add(combined);
    for (const source of batch.geometries) source.dispose();
  }
}

export function createWorld(canvas: HTMLCanvasElement, platforms: Platform[]): WorldVisuals {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c8e7db');
  scene.fog = new THREE.Fog('#c8e7db', 55, 105);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 160);
  scene.add(new THREE.HemisphereLight('#fff8db', '#779f91', 2.4));
  const sun = new THREE.DirectionalLight('#fff0cc', 3);
  sun.position.set(-10, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -19,
    right: 19,
    top: 19,
    bottom: -19,
    near: 1,
    far: 60,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  scene.add(sun);
  const platformMeshes = new Map<string, THREE.Group>();
  for (const platform of platforms) platformMeshes.set(platform.id, makePlatform(scene, platform));

  tree(scene, -6.9, 0, -3.4, 1.15);
  tree(scene, 5.3, 0, -4.4, 0.95);
  tree(scene, -3.4, 1.15, -2.5, 0.75);
  tree(scene, -7.2, 0, 0.3, 0.65);
  tree(scene, 4.5, 0, 5.6, 0.8);
  tree(scene, 11.7, 1.4, -3.1, 0.47);
  const random = seeded(42);
  for (let i = 0; i < 62; i++) {
    const angle = random() * Math.PI * 2,
      radius = 3.6 + random() * 5;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    if ((z < -0.6 && Math.abs(x) < 5.8) || Math.hypot(x + 5.9, z - 1.5) < 1) continue;
    flower(scene, x, 0.04, z, ['#fff3ce', '#e99e87', '#f6d779'][i % 3], 0.09 + random() * 0.07);
  }
  for (let i = 0; i < 24; i++) {
    const angle = random() * Math.PI * 2,
      radius = 6 + random() * 2.6;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    if (z < -1 && Math.abs(x) < 5.5) continue;
    for (let j = 0; j < 3; j++) {
      const grass = mesh(
        new THREE.ConeGeometry(0.035, 0.22 + random() * 0.15, 3),
        '#739e5d',
        scene,
        x + j * 0.06,
        0.13,
        z,
      );
      grass.rotation.z = (j - 1) * 0.35;
    }
  }
  // A winding line of stepping stones hints at the first climb.
  for (const [x, z, angle] of [
    [-0.3, 4.1, 0.1],
    [-1, 3.3, -0.3],
    [-1.8, 2.4, 0.2],
    [-2.7, 1.5, -0.2],
  ]) {
    const stone = cylinder(scene, '#e1d3a6', x, 0.045, z, 0.33, 0.35, 0.09, 7);
    stone.scale.z = 0.7;
    stone.rotation.y = angle;
  }
  // Welcome sign: purely decorative and out of the player's path.
  const sign = new THREE.Group();
  sign.position.set(1.4, 0, 5.3);
  sign.rotation.y = 0.35;
  scene.add(sign);
  cylinder(sign, '#9d7950', 0, 0.45, 0, 0.055, 0.07, 0.9, 6);
  box(sign, '#f3dbaa', 0, 0.93, 0, 1.1, 0.55, 0.1, 0.04);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.3, -0.06);
  arrowShape.lineTo(0.05, -0.06);
  arrowShape.lineTo(0.05, -0.17);
  arrowShape.lineTo(0.32, 0);
  arrowShape.lineTo(0.05, 0.17);
  arrowShape.lineTo(0.05, 0.06);
  arrowShape.lineTo(-0.3, 0.06);
  arrowShape.closePath();
  mesh(new THREE.ShapeGeometry(arrowShape), palette.teal, sign, 0, 0.93, 0.06).rotation.z = Math.PI;
  const flag = new THREE.Group();
  flag.position.set(SUMMIT.x - 0.8, 5.55, SUMMIT.z + 0.3);
  scene.add(flag);
  cylinder(flag, palette.cream, 0, 1.15, 0, 0.035, 0.045, 2.3, 8);
  ball(flag, palette.gold, 0, 2.33, 0, 0.09);
  const flagMesh = mesh(new THREE.PlaneGeometry(0.7, 0.4), palette.red, flag, 0.36, 1.98, 0);
  (flagMesh.material as THREE.Material).side = THREE.DoubleSide;
  const bounce = new THREE.Group();
  bounce.position.set(BOUNCE.x, BOUNCE.y, BOUNCE.z);
  scene.add(bounce);
  cylinder(bounce, palette.cream, 0, 0.08, 0, 0.7, 0.78, 0.16, 16);
  const cap = ball(bounce, palette.red, 0, 0.22, 0, 0.65, 1, 0.35, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ball(bounce, palette.cream, Math.cos(a) * 0.38, 0.4, Math.sin(a) * 0.38, 0.11, 1, 0.3, 1);
  }
  cap.name = 'bounce-cap';

  const coins = COINS.map((point) => {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, point.z);
    scene.add(group);
    const coin = cylinder(group, palette.gold, 0, 0, 0, 0.24, 0.24, 0.09, 24);
    coin.rotation.x = Math.PI / 2;
    const inset = cylinder(group, '#e4a440', 0, 0, 0.051, 0.17, 0.17, 0.012, 24);
    inset.rotation.x = Math.PI / 2;
    box(group, '#ffe9a0', 0, 0, 0.065, 0.045, 0.2, 0.015, 0.006);
    return group;
  });
  const fragments = FRAGMENTS.map((point) => {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, point.z);
    scene.add(group);
    mesh(starGeometry(0.38, 4), palette.gold, group);
    const ring = mesh(new THREE.TorusGeometry(0.58, 0.018, 5, 32), '#fff2bc', group);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.35;
    return group;
  });
  const star = new THREE.Group();
  star.position.set(SUMMIT.x, SUMMIT.y, SUMMIT.z);
  scene.add(star);
  mesh(starGeometry(0.65), palette.gold, star);
  for (const x of [-0.16, 0.16]) ball(star, palette.dark, x, 0.04, 0.2, 0.06, 0.7, 1.6, 0.4);
  const starRing = mesh(new THREE.TorusGeometry(1, 0.025, 6, 64), '#fff5cd', star);
  starRing.rotation.x = Math.PI / 2;
  starRing.position.y = -0.75;
  star.visible = false;
  const enemies = ENEMIES.map((enemy) => {
    const group = new THREE.Group();
    group.position.set(enemy.x, enemy.y, enemy.z);
    scene.add(group);
    ball(group, '#c98353', 0, 0.34, 0, 0.48, 1, 0.77, 0.86);
    ball(group, '#e0a268', 0, 0.6, -0.05, 0.32, 1.1, 0.5, 1);
    cylinder(group, '#65925f', 0, 0.79, -0.05, 0.05, 0.07, 0.19, 5);
    for (const x of [-0.18, 0.18]) {
      box(group, '#7e5a40', x, 0.08, 0.1, 0.25, 0.15, 0.33);
      ball(group, '#fff2cd', x * 0.8, 0.43, 0.34, 0.1, 1, 1, 0.3);
      ball(group, palette.dark, x * 0.8, 0.42, 0.37, 0.045, 0.8, 1.2, 0.4);
      const brow = box(group, '#7e5a40', x * 0.8, 0.54, 0.36, 0.17, 0.04, 0.04, 0.01);
      brow.rotation.z = x > 0 ? 0.25 : -0.25;
    }
    return group;
  });
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 15; i++) {
    const group = new THREE.Group();
    const angle = (i / 15) * Math.PI * 2;
    group.position.set(
      Math.cos(angle) * (18 + random() * 11),
      -5 + random() * 5,
      Math.sin(angle) * (18 + random() * 11),
    );
    group.scale.setScalar(1.3 + random() * 1.3);
    scene.add(group);
    clouds.push(group);
    for (let j = 0; j < 4; j++) {
      const cloud = ball(
        group,
        '#f0f3df',
        j * 0.9 - 1.3,
        Math.sin(j) * 0.3,
        0,
        0.95,
        1.1,
        0.65,
        0.8,
      );
      cloud.castShadow = false;
      cloud.receiveShadow = false;
    }
  }
  // Floating pebbles make the whole world feel like a miniature diorama.
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4;
    const pebble = ball(
      scene,
      '#cda879',
      Math.sin(a) * 8,
      -4.8 - random() * 2,
      Math.cos(a) * 7,
      0.18 + random() * 0.25,
      1,
      1.4,
      1,
    );
    pebble.rotation.z = a;
  }
  const hero = makeHero(scene);
  batchScenery(
    scene,
    new Set<THREE.Object3D>([
      hero.group,
      hero.shadow,
      ...coins,
      ...fragments,
      star,
      ...enemies,
      bounce,
      ...clouds,
      platformMeshes.get('ferry')!,
      platformMeshes.get('surprise')!,
    ]),
  );
  return {
    renderer,
    scene,
    camera,
    hero,
    coins,
    fragments,
    star,
    enemies,
    platforms: platformMeshes,
    bounce,
    clouds,
    flag,
    dustGeometry: new THREE.IcosahedronGeometry(0.07, 0),
  };
}

export function animateHero(
  hero: HeroVisual,
  speed: number,
  time: number,
  grounded: boolean,
  vertical: number,
): void {
  const stride = Math.sin(time * Math.min(20, speed * 3.3));
  hero.leftLeg.rotation.x = grounded ? stride * Math.min(0.8, speed * 0.12) : -0.35;
  hero.rightLeg.rotation.x = grounded ? -stride * Math.min(0.8, speed * 0.12) : 0.35;
  hero.leftArm.rotation.x = grounded ? -hero.leftLeg.rotation.x * 0.8 : -1.6;
  hero.rightArm.rotation.x = grounded ? -hero.rightLeg.rotation.x * 0.8 : -1.6;
  hero.leftArm.rotation.z = grounded ? -0.08 : -0.45;
  hero.rightArm.rotation.z = grounded ? 0.08 : 0.45;
  hero.model.position.y = grounded ? Math.abs(stride) * speed * 0.008 : 0;
  hero.model.rotation.x = grounded
    ? speed * 0.018
    : Math.max(-0.15, Math.min(0.15, vertical * 0.012));
}
