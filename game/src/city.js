// city.js — the procedural city: ground, avenues, sidewalks, the beach and
// the sea, then a tower or two per block with canvas window textures, plus
// rooftop props, neon signage, lamps, palms and street furniture. Building
// footprints double as the collision boxes every other system tests
// against. All of it is generated from the world's seeded RNG.

import * as THREE from 'three';
import { WORLD, DISTRICTS, DEFAULT_DISTRICT, PALETTE } from './config.js';
import { clamp } from './random.js';

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  }
  return DEFAULT_DISTRICT;
}

// Eight window-texture variants: different grids, lit ratios, light warmth
// and base tones, so neighbouring towers stop looking like clones.
const WINDOW_BASES = ['#3a4356', '#4a3f33', '#37424a', '#51443a', '#3d3a4d', '#463a30', '#39424e', '#503f36'];
const WINDOW_LIGHTS = ['#ffd98a', '#fff3cf', '#ffb35c', '#cfe4ff'];

export function makeWindowTexture(rng, variant) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = WINDOW_BASES[variant % WINDOW_BASES.length];
  g.fillRect(0, 0, 128, 256);
  const cols = 5 + (variant % 4); // 5..8 columns
  const rows = 11 + ((variant * 2) % 6); // 11..16 rows
  const litRatio = 0.3 + (variant % 4) * 0.07; // ~42% lit on average
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      if (lit) {
        g.fillStyle = WINDOW_LIGHTS[Math.floor(rng() * WINDOW_LIGHTS.length)];
        g.globalAlpha = rng.range(0.55, 1);
      } else {
        g.fillStyle = '#141a24';
        g.globalAlpha = rng.range(0.7, 1);
      }
      g.fillRect(x * cw + 2, y * ch + 3, cw - 4, ch - 6);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3c4148';
  g.fillRect(0, 0, 128, 256);
  // Asphalt speckle.
  for (let i = 0; i < 500; i++) {
    const s = 40 + Math.floor(Math.random() * 30);
    g.fillStyle = `rgb(${s},${s + 3},${s + 7})`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // Edge lines and a dashed centre line.
  g.fillStyle = '#d8d8ce';
  g.fillRect(4, 0, 3, 256);
  g.fillRect(121, 0, 3, 256);
  g.fillStyle = '#f5d76a';
  g.fillRect(61, 12, 6, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function flat(w, l, color, x, y, z, roughTex) {
  const mat = roughTex
    ? new THREE.MeshLambertMaterial({ map: roughTex })
    : new THREE.MeshLambertMaterial({ color });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export function createCity(world) {
  const rng = world.rng;
  const scene = world.render.scene;
  const group = new THREE.Group();
  scene.add(group);
  const size = WORLD.half * 2;

  group.add(flat(size + 60, size + 60, PALETTE.ground, 0, 0, 0));
  // Sand strip, then the sea, on the south edge.
  group.add(flat(size + 60, 36, PALETTE.sand, 0, 0.012, WORLD.beachZ + 14));
  const sea = flat(size + 320, 320, PALETTE.sea, 0, 0.02, WORLD.seaZ + 150);
  group.add(sea);

  const roadTex = makeRoadTexture();
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const walkGeoV = new THREE.PlaneGeometry(WORLD.roadHalf * 2 + WORLD.sidewalk * 2, size);
  const walkGeoH = new THREE.PlaneGeometry(size, WORLD.roadHalf * 2 + WORLD.sidewalk * 2);
  for (const c of WORLD.roads) {
    const wv = new THREE.Mesh(walkGeoV, walkMat);
    wv.rotation.x = -Math.PI / 2;
    wv.position.set(c, 0.01, 0);
    wv.receiveShadow = true;
    group.add(wv);
    const wh = new THREE.Mesh(walkGeoH, walkMat);
    wh.rotation.x = -Math.PI / 2;
    wh.position.set(0, 0.014, c);
    wh.receiveShadow = true;
    group.add(wh);
    const rvTex = roadTex.clone();
    rvTex.repeat.set(1, 30);
    rvTex.needsUpdate = true;
    const rv = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.roadHalf * 2, size),
      new THREE.MeshLambertMaterial({ map: rvTex })
    );
    rv.rotation.x = -Math.PI / 2;
    rv.position.set(c, 0.02, 0);
    rv.receiveShadow = true;
    group.add(rv);
    const rhTex = roadTex.clone();
    rhTex.center.set(0.5, 0.5);
    rhTex.rotation = Math.PI / 2;
    rhTex.repeat.set(1, 30);
    rhTex.needsUpdate = true;
    const rh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, WORLD.roadHalf * 2),
      new THREE.MeshLambertMaterial({ map: rhTex })
    );
    rh.rotation.x = -Math.PI / 2;
    rh.position.set(0, 0.026, c);
    rh.receiveShadow = true;
    group.add(rh);
  }

  // ---- Buildings -------------------------------------------------------
  // Land segments between the avenue bands (avenue half width + sidewalk).
  const edge = WORLD.roadHalf + WORLD.sidewalk; // 12.5
  const segs = [[-WORLD.half, -150 - edge]];
  for (let i = 0; i < WORLD.roads.length - 1; i++) {
    segs.push([WORLD.roads[i] + edge, WORLD.roads[i + 1] - edge]);
  }
  segs.push([150 + edge, WORLD.half]);

  const textures = [];
  for (let v = 0; v < 8; v++) textures.push(makeWindowTexture(rng, v));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b6257 });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const NEON = [0xff2d95, 0x00e5ff, 0xffe93d, 0x7cff2d, 0xff7b2d];
  const AWNING = [0xe8452c, 0x2c8ae8, 0x2ecc71, 0xf5b921, 0x9b59d0];
  const acGeo = new THREE.BoxGeometry(1.7, 0.8, 1.3);
  const tankGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.3, 10);
  const colliders = [];
  // Spots the screenshots look at: rooftop props get denser near them.
  const hotSpots = [
    { x: 0, z: 40 },
    { x: 20, z: 150 },
    { x: 90, z: 60 },
    { x: 150, z: -150 },
  ];
  const nearHot = (x, z) => hotSpots.some((h) => Math.hypot(h.x - x, h.z - z) < 85);

  for (const [sx0, sx1] of segs) {
    for (const [sz0, sz1] of segs) {
      const towers = rng.chance(0.55) ? 2 : 1;
      for (let t = 0; t < towers; t++) {
        const w = rng.range(12, 20);
        const d = rng.range(12, 20);
        const x = rng.range(sx0 + w / 2 + 2, sx1 - w / 2 - 2);
        const z = rng.range(sz0 + d / 2 + 2, sz1 - d / 2 - 2);
        if (z + d / 2 > WORLD.beachZ - 2) continue; // keep the beach clear
        const district = districtAt(x, z);
        const h = rng.range(district.minH, district.maxH);
        const tex = textures[rng.int(0, textures.length - 1)];
        tex.wrapS = THREE.RepeatWrapping;
        const wallMat = new THREE.MeshLambertMaterial({
          map: tex,
          emissive: 0xffffff,
          emissiveMap: tex,
          emissiveIntensity: 0.25,
          color: district.tint,
        });
        const geo = new THREE.BoxGeometry(w, h, d);
        const b = new THREE.Mesh(geo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

        // Rooftop props: AC units, antennas, water tanks.
        const bonus = nearHot(x, z) ? 0.25 : 0;
        if (rng.chance(0.7 + bonus)) {
          const ac = new THREE.Mesh(acGeo, acMat);
          ac.position.set(x + rng.range(-w / 4, w / 4), h + 0.4, z + rng.range(-d / 4, d / 4));
          ac.castShadow = true;
          group.add(ac);
        }
        if (rng.chance(0.5 + bonus)) {
          const ah = rng.range(4, 9);
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, ah, 5), darkMat);
          ant.position.set(x + rng.range(-w / 3, w / 3), h + ah / 2, z + rng.range(-d / 3, d / 3));
          group.add(ant);
        }
        if (rng.chance(0.3 + bonus * 0.5)) {
          const tank = new THREE.Mesh(tankGeo, tankMat);
          tank.position.set(x + rng.range(-w / 4, w / 4), h + 1.15, z + rng.range(-d / 4, d / 4));
          tank.castShadow = true;
          group.add(tank);
        }

        // Downtown dressing: neon signage and coloured awnings.
        if (district.name === 'DOWNTOWN') {
          if (rng.chance(0.6)) {
            const sign = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.55, 1.3, 0.3),
              new THREE.MeshBasicMaterial({ color: NEON[rng.int(0, NEON.length - 1)] })
            );
            sign.position.set(x, h * rng.range(0.45, 0.7), z - d / 2 - 0.2);
            group.add(sign);
          }
          if (rng.chance(0.55)) {
            const awn = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.6, 0.14, 2.3),
              new THREE.MeshLambertMaterial({ color: AWNING[rng.int(0, AWNING.length - 1)] })
            );
            awn.position.set(x, 3.1, z + d / 2 + 1);
            awn.rotation.x = 0.32;
            group.add(awn);
          }
        }
      }
    }
  }

  // ---- Street furniture --------------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 7, 6);
  const bulbGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const c of WORLD.roads) {
    for (let t = -198; t <= 198; t += 36) {
      for (const s of [-1, 1]) {
        const off = s * (WORLD.roadHalf + 1.6);
        const pole = new THREE.Mesh(poleGeo, darkMat);
        pole.position.set(c + off, 3.5, t);
        group.add(pole);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(c + off, 7.1, t);
        group.add(bulb);
        const pole2 = new THREE.Mesh(poleGeo, darkMat);
        pole2.position.set(t, 3.5, c + off);
        group.add(pole2);
        const bulb2 = new THREE.Mesh(bulbGeo, bulbMat);
        bulb2.position.set(t, 7.1, c + off);
        group.add(bulb2);
      }
    }
  }

  // Palms along the beach and around the marina.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 6, 6);
  const frondGeo = new THREE.ConeGeometry(0.5, 4.4, 5);
  const addPalm = (x, z) => {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3;
    trunk.rotation.z = rng.range(-0.06, 0.06);
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 5; i++) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const a = (i / 5) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1, 6.4, Math.sin(a) * 1.1);
      frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
  };
  for (let i = 0; i < 16; i++) addPalm(rng.range(-200, 200), rng.range(184, 196));
  for (let i = 0; i < 10; i++) addPalm(rng.range(110, 200), rng.range(80, 170));

  // Hydrants and benches at intersections, beach umbrellas on the sand.
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xd23b2e });
  const hydGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.8, 8);
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const benchGeo = new THREE.BoxGeometry(2, 0.18, 0.6);
  for (const cx of WORLD.roads) {
    for (const cz of WORLD.roads) {
      if (rng.chance(0.5)) {
        const hyd = new THREE.Mesh(hydGeo, hydMat);
        hyd.position.set(cx + 9.6, 0.4, cz + 9.6);
        group.add(hyd);
      }
      if (rng.chance(0.4)) {
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.set(cx - 9.8, 0.5, cz + 9.8);
        group.add(bench);
      }
    }
  }
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xe8452c });
  for (let i = 0; i < 8; i++) {
    const ux = rng.range(-190, 190);
    const uz = rng.range(186, 198);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), darkMat);
    pole.position.set(ux, 1.3, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 10), umbMat);
    top.position.set(ux, 2.8, uz);
    top.castShadow = true;
    group.add(top);
  }

  return { group, colliders };
}

// Is (x, z) inside any building footprint, expanded by pad metres?
export function pointInBuilding(city, x, z, pad = 0) {
  for (const b of city.colliders) {
    if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return b;
  }
  return null;
}

// Keep a position inside the city square.
export function clampToCity(pos, margin = 2) {
  const lim = WORLD.half - margin;
  pos.x = clamp(pos.x, -lim, lim);
  pos.z = clamp(pos.z, -lim, lim);
  return pos;
}
