// effects.js — pooled particles (dust, smoke, sparks), a dedicated additive
// muzzle-flash pool with a flash sprite and light, and pooled skid marks.
// Nothing here allocates per frame; every pool is created up front.

import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_FLASH = 160;
const MAX_SKIDS = 90;

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.25, 'rgba(255,230,150,0.95)');
  grad.addColorStop(0.6, 'rgba(255,180,60,0.45)');
  grad.addColorStop(1, 'rgba(255,150,30,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // Four spikes turn the glow into a star burst.
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,240,190,0.85)';
  g.beginPath();
  g.moveTo(64, 2);
  g.lineTo(70, 58);
  g.lineTo(126, 64);
  g.lineTo(70, 70);
  g.lineTo(64, 126);
  g.lineTo(58, 70);
  g.lineTo(2, 64);
  g.lineTo(58, 58);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePool(scene, max, size, additive) {
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const items = [];
  for (let i = 0; i < max; i++) {
    positions[i * 3 + 1] = -60;
    items.push({ alive: false, x: 0, y: -60, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: additive ? 1 : 0.9,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { items, positions, colors, geo, points, cursor: 0, max };
}

export function createEffects(world) {
  const scene = world.render.scene;
  const pool = makePool(scene, MAX_PARTICLES, 0.55, false);
  const flashPool = makePool(scene, MAX_FLASH, 1.05, true);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeFlashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  sprite.visible = false;
  scene.add(sprite);
  const light = new THREE.PointLight(0xffdf9a, 0, 30, 1.8);
  scene.add(light);
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.4);
  skidGeo.rotateX(-Math.PI / 2);
  const skids = [];
  return {
    particles: pool.items,
    pool,
    flashPool,
    sprite,
    light,
    flashTimer: 0,
    skids,
    skidGeo,
    skidCursor: 0,
  };
}

export function spawnParticle(pool, x, y, z, vx, vy, vz, life, r, g, b) {
  const p = pool.items[pool.cursor];
  pool.cursor = (pool.cursor + 1) % pool.max;
  p.alive = true;
  p.x = x;
  p.y = y;
  p.z = z;
  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.life = life;
  p.maxLife = life;
  p.r = r;
  p.g = g;
  p.b = b;
}

// Tan dust kicked up by tyres and footsteps.
export function burstDust(world, x, y, z, count = 8, spread = 1.8) {
  const rng = world.rng;
  const pool = world.effects.pool;
  for (let i = 0; i < count; i++) {
    const shade = rng.range(0.8, 1.05);
    spawnParticle(
      pool, x + rng.range(-0.4, 0.4), y + rng.range(0, 0.3), z + rng.range(-0.4, 0.4),
      rng.range(-spread, spread), rng.range(0.4, 1.6), rng.range(-spread, spread),
      rng.range(0.5, 1), 0.76 * shade, 0.66 * shade, 0.5 * shade
    );
  }
}

// Dark smoke, slower and longer-lived than dust.
export function burstSmoke(world, x, y, z, count = 6, spread = 1) {
  const rng = world.rng;
  const pool = world.effects.pool;
  for (let i = 0; i < count; i++) {
    const shade = rng.range(0.1, 0.22);
    spawnParticle(
      pool, x + rng.range(-0.3, 0.3), y + rng.range(0, 0.4), z + rng.range(-0.3, 0.3),
      rng.range(-spread, spread), rng.range(0.8, 1.8), rng.range(-spread, spread),
      rng.range(0.8, 1.6), shade, shade, shade
    );
  }
}

// Hot yellow-orange sparks from impacts and gunfire.
export function burstSparks(world, x, y, z, count = 10, speed = 9) {
  const rng = world.rng;
  const pool = world.effects.pool;
  for (let i = 0; i < count; i++) {
    spawnParticle(
      pool, x, y, z,
      rng.range(-speed, speed), rng.range(-speed * 0.5, speed), rng.range(-speed, speed),
      rng.range(0.25, 0.55), 1, rng.range(0.55, 0.8), 0.15
    );
  }
}

// The muzzle flash: a bright star sprite, a point light and a burst from the
// additive flash pool. scale 3.0 / intensity 130 for the player's pistol,
// 1.8 / 65 for a Viper's. The flash lives 0.09 s — long enough to be caught
// by a screenshot staged on the final step.
export function muzzleFlash(world, x, y, z, scale = 3, intensity = 130) {
  const fx = world.effects;
  const rng = world.rng;
  fx.sprite.position.set(x, y, z);
  fx.sprite.scale.set(scale, scale, 1);
  fx.sprite.visible = true;
  fx.light.position.set(x, y + 0.2, z);
  fx.light.intensity = intensity;
  fx.flashTimer = 0.09;
  const n = scale >= 3 ? 26 : 12;
  for (let i = 0; i < n; i++) {
    spawnParticle(
      fx.flashPool, x, y, z,
      rng.range(-3.4, 3.4), rng.range(-2.4, 3.2), rng.range(-3.4, 3.4),
      rng.range(0.05, 0.11), 1, rng.range(0.82, 0.95), rng.range(0.45, 0.65)
    );
  }
  burstSparks(world, x, y, z, 8, 6);
}

// One pooled skid mark, aligned with the car's heading.
export function dropSkid(world, x, z, angle) {
  const fx = world.effects;
  let s = fx.skids[fx.skidCursor];
  if (!s) {
    if (fx.skids.length >= MAX_SKIDS) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c, transparent: true, opacity: 0.55, depthWrite: false });
    s = { mesh: new THREE.Mesh(fx.skidGeo, mat), life: 0 };
    fx.skids.push(s);
    world.render.scene.add(s.mesh);
  }
  fx.skidCursor = (fx.skidCursor + 1) % MAX_SKIDS;
  s.mesh.position.set(x, 0.03, z);
  s.mesh.rotation.y = angle;
  s.mesh.visible = true;
  s.life = 6;
}

function updatePool(pool, dt, gravity) {
  const { items, positions, colors } = pool;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (p.alive) {
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        p.y = -60;
      } else {
        p.vy -= gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.03) p.y = 0.03;
      }
    }
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    const f = p.alive ? Math.min(1, (p.life / p.maxLife) * 1.6) : 0;
    colors[i * 3] = p.r * f;
    colors[i * 3 + 1] = p.g * f;
    colors[i * 3 + 2] = p.b * f;
  }
  pool.geo.attributes.position.needsUpdate = true;
  pool.geo.attributes.color.needsUpdate = true;
}

export function updateEffects(world, dt) {
  const fx = world.effects;
  updatePool(fx.pool, dt, 1.5);
  updatePool(fx.flashPool, dt, 0.4);
  if (fx.flashTimer > 0) {
    fx.flashTimer -= dt;
    if (fx.flashTimer <= 0) {
      fx.sprite.visible = false;
      fx.light.intensity = 0;
    }
  }
  for (const s of fx.skids) {
    if (s.life > 0) {
      s.life -= dt;
      s.mesh.material.opacity = 0.55 * Math.min(1, s.life / 1.5);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}
