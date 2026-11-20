// effects.js — one pooled particle cloud, fading skid marks and a fat, bright muzzle flash.
import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_SKIDS = 90;

export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ alive: false, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1, drag: 0 });
    positions[i * 3 + 1] = -50;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // Muzzle flash: a camera-facing additive sprite with a star-burst gradient, plus a real light.
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = 128; flashCanvas.height = 128;
  const fx = flashCanvas.getContext('2d');
  const grad = fx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.25, 'rgba(255,214,90,0.95)');
  grad.addColorStop(0.6, 'rgba(255,130,30,0.45)');
  grad.addColorStop(1, 'rgba(255,90,10,0)');
  fx.fillStyle = grad;
  fx.fillRect(0, 0, 128, 128);
  fx.fillStyle = 'rgba(255,240,200,0.9)';
  fx.fillRect(58, 4, 12, 120);
  fx.fillRect(4, 58, 120, 12);
  const flashTex = new THREE.CanvasTexture(flashCanvas);
  const flashMat = new THREE.SpriteMaterial({ map: flashTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flashSprite = new THREE.Sprite(flashMat);
  flashSprite.scale.set(1.6, 1.6, 1);
  flashSprite.visible = false;
  scene.add(flashSprite);
  const flashLight = new THREE.PointLight(0xffc266, 0, 22, 1.6);
  scene.add(flashLight);

  const skidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false });
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.4);
  const skids = [];

  return {
    particles, positions, colors, geo, points,
    flashSprite, flashMat, flashLight, flashTimer: 0,
    skidMat, skidGeo, skids, scene,
    cursor: 0,
  };
}

export function spawnParticle(fx, x, y, z, vx, vy, vz, life, r, g, b, drag) {
  const p = fx.particles[fx.cursor];
  fx.cursor = (fx.cursor + 1) % MAX_PARTICLES;
  p.alive = true; p.x = x; p.y = y; p.z = z;
  p.vx = vx; p.vy = vy; p.vz = vz;
  p.life = life; p.maxLife = life;
  p.r = r; p.g = g; p.b = b; p.drag = drag || 0;
}

export function burstDust(fx, rng, x, y, z, count) {
  for (let i = 0; i < count; i++) {
    spawnParticle(fx, x + rng.range(-0.7, 0.7), y + rng.range(0, 0.4), z + rng.range(-0.7, 0.7),
      rng.range(-1.6, 1.6), rng.range(0.6, 2.2), rng.range(-1.6, 1.6),
      rng.range(0.5, 1), 0.82, 0.72, 0.55, 1.2);
  }
}

export function burstSmoke(fx, rng, x, y, z, count) {
  for (let i = 0; i < count; i++) {
    spawnParticle(fx, x + rng.range(-0.5, 0.5), y + rng.range(0, 0.5), z + rng.range(-0.5, 0.5),
      rng.range(-1, 1), rng.range(1, 2.6), rng.range(-1, 1),
      rng.range(0.8, 1.6), 0.32, 0.32, 0.34, 0.8);
  }
}

export function burstSparks(fx, rng, x, y, z, count) {
  for (let i = 0; i < count; i++) {
    spawnParticle(fx, x, y, z,
      rng.range(-9, 9), rng.range(-9, 9), rng.range(-9, 9),
      rng.range(0.25, 0.55), 1, 0.72, 0.2, 0);
  }
}

export function muzzleFlash(fx, rng, x, y, z, big) {
  const scale = big ? 2.1 : 1.1;
  fx.flashSprite.position.set(x, y, z);
  fx.flashSprite.scale.set(scale, scale, 1);
  fx.flashMat.opacity = 1;
  fx.flashSprite.visible = true;
  fx.flashLight.position.set(x, y, z);
  fx.flashLight.intensity = big ? 90 : 40;
  fx.flashTimer = 0.11;
  burstSparks(fx, rng, x, y, z, big ? 16 : 8);
}

export function dropSkid(fx, x, z, angle) {
  let skid = fx.skids.find((s) => !s.active);
  if (!skid) {
    if (fx.skids.length >= MAX_SKIDS) {
      skid = fx.skids.shift();
    } else {
      skid = { mesh: new THREE.Mesh(fx.skidGeo, fx.skidMat.clone()), active: false, life: 0 };
      fx.scene.add(skid.mesh);
      fx.skids.push(skid);
    }
  }
  skid.active = true;
  skid.life = 6;
  skid.mesh.visible = true;
  skid.mesh.position.set(x, 0.03, z);
  skid.mesh.rotation.set(-Math.PI / 2, 0, angle);
  skid.mesh.material.opacity = 0.55;
}

export function updateEffects(fx, dt) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = fx.particles[i];
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      p.y = -50;
    } else {
      const dragK = p.drag ? Math.max(0, 1 - p.drag * dt) : 1;
      p.vx *= dragK; p.vz *= dragK;
      p.vy = p.vy * dragK - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) p.y = 0.05;
    }
    fx.positions[i * 3] = p.x;
    fx.positions[i * 3 + 1] = p.y;
    fx.positions[i * 3 + 2] = p.z;
    const fade = p.alive ? Math.min(1, p.life / (p.maxLife * 0.5)) : 0;
    fx.colors[i * 3] = p.r * fade;
    fx.colors[i * 3 + 1] = p.g * fade;
    fx.colors[i * 3 + 2] = p.b * fade;
  }
  fx.geo.attributes.position.needsUpdate = true;
  fx.geo.attributes.color.needsUpdate = true;

  if (fx.flashTimer > 0) {
    fx.flashTimer -= dt;
    if (fx.flashTimer <= 0) {
      fx.flashSprite.visible = false;
      fx.flashMat.opacity = 0;
      fx.flashLight.intensity = 0;
    }
  }
  for (const skid of fx.skids) {
    if (!skid.active) continue;
    skid.life -= dt;
    if (skid.life <= 0) {
      skid.active = false;
      skid.mesh.visible = false;
    } else if (skid.life < 1.5) {
      skid.mesh.material.opacity = 0.55 * (skid.life / 1.5);
    }
  }
}
