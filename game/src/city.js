// city.js — procedural Solmar Bay: textured towers with real variety, neon, awnings, props, colliders.
import * as THREE from 'three';
import { WORLD, PALETTE, DISTRICTS } from './config.js';
import { clamp } from './random.js';

const NEON_COLORS = ['#ff2e88', '#22d3ee', '#ffe93f', '#7cff4f', '#ff7a2e'];
const AWNING_COLORS = [0xd94f30, 0x1f8a70, 0x2456c8, 0xe8b93b, 0x8e44ad, 0x159a8c];

// Six window looks: grid density, lit ratio and light temperature all differ per variant.
const WINDOW_VARIANTS = [
  { cols: 6, rows: 12, lit: 0.42, warm: '#ffd9a0', cool: '#bcd8ff', base: '#5a6068' },
  { cols: 8, rows: 16, lit: 0.55, warm: '#ffe9c4', cool: '#d6ecff', base: '#4c5258' },
  { cols: 5, rows: 9, lit: 0.3, warm: '#ffc98a', cool: '#a8c8f0', base: '#66605c' },
  { cols: 10, rows: 20, lit: 0.48, warm: '#fff0d0', cool: '#c4e2ff', base: '#3f464e' },
  { cols: 7, rows: 14, lit: 0.62, warm: '#ffca7a', cool: '#9fd0ff', base: '#565064' },
  { cols: 4, rows: 8, lit: 0.36, warm: '#ffe2ae', cool: '#cfe6ff', base: '#6b6259' },
];

export function makeWindowTexture(rng, variantIndex) {
  const v = WINDOW_VARIANTS[variantIndex % WINDOW_VARIANTS.length];
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = v.base;
  ctx.fillRect(0, 0, 128, 256);
  const cw = 128 / v.cols;
  const ch = 256 / v.rows;
  for (let x = 0; x < v.cols; x++) {
    for (let y = 0; y < v.rows; y++) {
      const lit = rng.next() < v.lit;
      if (lit) {
        ctx.fillStyle = rng.next() < 0.62 ? v.warm : v.cool;
      } else {
        const shade = 30 + Math.floor(rng.next() * 26);
        ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 12})`;
      }
      ctx.fillRect(x * cw + 1.5, y * ch + 1.5, cw - 3, ch - 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c3f45';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    const g = 52 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${g},${g},${g + 4})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.fillStyle = '#f5d76e';
  for (let y = 0; y < 128; y += 32) ctx.fillRect(62, y, 4, 18);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
  }
  return { name: 'MIDTOWN', tint: 0xd8cfc0, minH: 10, maxH: 30 };
}

function addGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.seaZ - WORLD.beachZ + 30),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, (WORLD.beachZ + WORLD.seaZ) / 2 + 6);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 200),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.25, WORLD.seaZ + 95);
  scene.add(sea);
}

function addRoads(scene) {
  const roadTex = makeRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const span = WORLD.half * 2 + 40;
  for (const r of WORLD.roads) {
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 14 : span, vertical ? span : 14), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(vertical ? r : 0, 0.02, vertical ? 0 : r);
      road.receiveShadow = true;
      scene.add(road);
      for (const side of [-1, 1]) {
        const off = side * (WORLD.roadHalf + WORLD.sidewalk / 2);
        const walk = new THREE.Mesh(
          new THREE.PlaneGeometry(vertical ? WORLD.sidewalk : span, vertical ? span : WORLD.sidewalk),
          walkMat
        );
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(vertical ? r + off : 0, 0.04, vertical ? 0 : r + off);
        walk.receiveShadow = true;
        scene.add(walk);
      }
    }
  }
}

function addBuilding(scene, buildings, rng, textures, cx, cz, w, d, district) {
  const h = rng.range(district.minH, district.maxH);
  const tex = textures[rng.int(0, textures.length - 1)];
  const tint = new THREE.Color(district.tint).offsetHSL(rng.range(-0.015, 0.015), rng.range(-0.04, 0.04), rng.range(-0.05, 0.05));
  const bodyMat = new THREE.MeshLambertMaterial({ map: tex, color: tint, emissive: 0x222222, emissiveIntensity: 0.25 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  buildings.push({ x: cx, z: cz, hw: w / 2, hd: d / 2, h });

  // Rooftop props — denser on the towers a street-level camera actually sees.
  const roof = new THREE.Group();
  if (rng.chance(0.85)) {
    const acCount = rng.int(1, 3);
    for (let i = 0; i < acCount; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.8),
        new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }));
      ac.position.set(cx + rng.range(-w / 4, w / 4), h + 0.55, cz + rng.range(-d / 4, d / 4));
      ac.castShadow = true;
      roof.add(ac);
    }
  }
  if (rng.chance(0.65)) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, rng.range(4, 9), 5),
      new THREE.MeshLambertMaterial({ color: 0x555b63 }));
    mast.position.set(cx + rng.range(-w / 5, w / 5), h + 3, cz + rng.range(-d / 5, d / 5));
    roof.add(mast);
  }
  if (rng.chance(0.4)) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10),
      new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
    tank.position.set(cx + rng.range(-w / 4, w / 4), h + 1.3, cz + rng.range(-d / 4, d / 4));
    tank.castShadow = true;
    roof.add(tank);
  }
  scene.add(roof);

  if (district.name === 'DOWNTOWN') {
    // Neon signage: a glowing panel on a random face, sized to read from the street.
    if (rng.chance(0.75)) {
      const neon = new THREE.Mesh(
        new THREE.PlaneGeometry(rng.range(4, 8), rng.range(1.2, 2)),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(rng.pick(NEON_COLORS)) })
      );
      const face = rng.int(0, 3);
      const ny = rng.range(5, Math.max(6, h - 4));
      if (face === 0) { neon.position.set(cx, ny, cz + d / 2 + 0.06); }
      if (face === 1) { neon.position.set(cx, ny, cz - d / 2 - 0.06); neon.rotation.y = Math.PI; }
      if (face === 2) { neon.position.set(cx + w / 2 + 0.06, ny, cz); neon.rotation.y = Math.PI / 2; }
      if (face === 3) { neon.position.set(cx - w / 2 - 0.06, ny, cz); neon.rotation.y = -Math.PI / 2; }
      scene.add(neon);
    }
    // Colored shop awnings ringing the ground floor.
    if (rng.chance(0.8)) {
      const awnMat = new THREE.MeshLambertMaterial({ color: rng.pick(AWNING_COLORS) });
      for (const side of [-1, 1]) {
        const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.18, 2), awnMat);
        awn.position.set(cx, 3.1, cz + side * (d / 2 + 0.9));
        awn.rotation.x = side * 0.35;
        scene.add(awn);
        const awn2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.18, d * 0.8), awnMat);
        awn2.position.set(cx + side * (w / 2 + 0.9), 3.1, cz);
        awn2.rotation.z = -side * 0.35;
        scene.add(awn2);
      }
    }
  }
}

function addProps(scene, rng) {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const r of WORLD.roads) {
    for (let t = -198; t <= 198; t += 36) {
      for (const vertical of [true, false]) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.y = 3.5;
        lamp.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), bulbMat);
        bulb.position.y = 7;
        lamp.add(bulb);
        lamp.position.set(vertical ? r + 8.6 : t, 0, vertical ? t : r + 8.6);
        scene.add(lamp);
      }
    }
  }
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3d });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 26; i++) {
    const palm = new THREE.Group();
    const px = -190 + i * 15 + rng.range(-3, 3);
    const pz = i % 3 === 0 ? rng.range(60, 120) : rng.range(168, 176);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6, 6), trunkMat);
    trunk.position.y = 3;
    trunk.rotation.z = rng.range(-0.08, 0.08);
    palm.add(trunk);
    for (let j = 0; j < 5; j++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 5), leafMat);
      const a = (j / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.1, 6.3, Math.sin(a) * 1.1);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      palm.add(leaf);
    }
    palm.position.set(px, 0, pz);
    scene.add(palm);
  }
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xc22727 });
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4f35 });
  for (const rx of WORLD.roads) {
    for (const rz of WORLD.roads) {
      if (rng.chance(0.5)) {
        const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.8, 8), hydMat);
        hyd.position.set(rx + 9.4, 0.4, rz + 9.4);
        scene.add(hyd);
      }
      if (rng.chance(0.4)) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), benchMat);
        bench.position.set(rx - 9.6, 0.35, rz + 8.8);
        scene.add(bench);
      }
    }
  }
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xd93b3b });
  for (let i = 0; i < 8; i++) {
    const umb = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), poleMat);
    pole.position.y = 1.3;
    umb.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 8), umbMat);
    top.position.y = 2.7;
    umb.add(top);
    umb.position.set(-140 + i * 38, 0, 186 + (i % 2) * 6);
    scene.add(umb);
  }
}

export function createCity(scene, rng) {
  addGround(scene);
  addRoads(scene);
  const textures = [];
  for (let i = 0; i < WINDOW_VARIANTS.length; i++) textures.push(makeWindowTexture(rng, i));
  const buildings = [];
  const half = WORLD.half;
  for (let bx = -half + 30; bx < half; bx += WORLD.block) {
    for (let bz = -half + 30; bz < half; bz += WORLD.block) {
      if (bz > 168) continue;
      const district = districtAt(bx, bz);
      const towers = rng.chance(0.55) ? 2 : 1;
      for (let t = 0; t < towers; t++) {
        const w = rng.range(13, 20);
        const d = rng.range(13, 20);
        const ox = towers === 1 ? 0 : (t === 0 ? -11 : 11);
        const oz = towers === 1 ? 0 : (t === 0 ? -9 : 10);
        addBuilding(scene, buildings, rng, textures, bx + ox, bz + oz, w, d, district);
      }
    }
  }
  addProps(scene, rng);
  return { buildings };
}

export function pointInBuilding(city, x, z, pad) {
  const p = pad || 0;
  for (const b of city.buildings) {
    if (x > b.x - b.hw - p && x < b.x + b.hw + p && z > b.z - b.hd - p && z < b.z + b.hd + p) return b;
  }
  return null;
}

export function clampToCity(pos, margin) {
  const lim = WORLD.half - (margin || 2);
  pos.x = clamp(pos.x, -lim, lim);
  pos.z = clamp(pos.z, -lim, Math.min(lim, WORLD.seaZ - 2));
  return pos;
}
