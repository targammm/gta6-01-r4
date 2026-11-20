// combat.js — pistol fire with a fat muzzle flash, Viper enemy AI, punches and player damage.
import * as THREE from 'three';
import { COMBAT, PALETTE, WANTED } from './config.js';
import { clamp, dist2D, angleDiff } from './random.js';
import { pointInBuilding } from './city.js';
import { burstSparks, muzzleFlash } from './effects.js';
import { addWanted } from './vehicles.js';

export function createCombat(state) {
  state.enemies = [];
  state.fireCooldown = 0;
  return state;
}

export function spawnEnemy(state, x, z) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.viper });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.8, 3, 8), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72),
    new THREE.MeshLambertMaterial({ color: PALETTE.viperBand }));
  band.position.y = 1.15;
  group.add(band);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  head.position.y = 1.74;
  group.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x0c0d10 }));
  gun.position.set(0.3, 1.05, -0.35);
  group.add(gun);
  group.position.set(x, 0, z);
  state.render.scene.add(group);
  const enemy = {
    mesh: group, x, z, angle: 0, health: COMBAT.enemyHealth,
    fireTimer: state.rng.range(0.8, 1.8), strafeDir: state.rng.chance(0.5) ? 1 : -1,
    dead: false, muzzle: { x: 0, y: 1.05, z: 0 },
  };
  state.enemies.push(enemy);
  return enemy;
}

function sphereHit(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const t = lx * dx + ly * dy + lz * dz;
  if (t < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - t * t;
  if (d2 > radius * radius) return -1;
  return t;
}

export function rayHit(state, origin, dir) {
  let best = null;
  let bestT = COMBAT.range;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const t = sphereHit(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, e.x, 1.3, e.z, 1.1);
    if (t > 0 && t < bestT) {
      bestT = t;
      best = { kind: 'enemy', target: e, t };
    }
  }
  for (const car of state.allCars()) {
    const t = sphereHit(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, car.x, 1.0, car.z, 2.2);
    if (t > 0 && t < bestT) {
      bestT = t;
      best = { kind: 'car', target: car, t };
    }
  }
  return best;
}

export function playerShoot(state) {
  if (state.fireCooldown > 0 || state.player.inCar) return false;
  state.fireCooldown = COMBAT.fireRate;
  const cam = state.render.camera;
  const origin = cam.position.clone();
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const p = state.player;
  const muzzleX = p.x - Math.sin(p.heading) * 0.55;
  const muzzleZ = p.z - Math.cos(p.heading) * 0.55;
  muzzleFlash(state.effects, state.rng, muzzleX, 1.25, muzzleZ, true);
  if (state.audio) state.audioGunshot = true;
  if (state.wanted.level < 1) addWanted(state, WANTED.gains.shoot);
  else state.wanted.heat = 0;
  const hit = rayHit(state, origin, dir);
  if (hit && hit.kind === 'enemy') {
    const e = hit.target;
    e.health -= COMBAT.damage;
    burstSparks(state.effects, state.rng, e.x, 1.3, e.z, 10);
    if (e.health <= 0) killEnemy(state, e);
  } else if (hit && hit.kind === 'car') {
    hit.target.speed *= 0.4;
    burstSparks(state.effects, state.rng, hit.target.x, 1, hit.target.z, 6);
  }
  return true;
}

export function killEnemy(state, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.mesh.rotation.x = Math.PI / 2;
  enemy.mesh.position.y = 0.3;
  burstSparks(state.effects, state.rng, enemy.x, 1, enemy.z, 16);
  state.xp += COMBAT.killXp;
  state.showMessage('Viper down! +25 XP', 3);
  addWanted(state, WANTED.gains.kill);
}

export function updateEnemies(state, dt) {
  const p = state.player;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2D(e.x, e.z, p.x, p.z);
    const desired = Math.atan2(-(p.x - e.x), -(p.z - e.z));
    e.angle += clamp(angleDiff(e.angle, desired), -3 * dt, 3 * dt);
    if (d > 10) {
      e.x += -Math.sin(e.angle) * COMBAT.enemySpeed * dt;
      e.z += -Math.cos(e.angle) * COMBAT.enemySpeed * dt;
    } else {
      const sx = -Math.cos(e.angle) * e.strafeDir;
      const sz = Math.sin(e.angle) * e.strafeDir;
      e.x += sx * COMBAT.enemyStrafe * dt;
      e.z += sz * COMBAT.enemyStrafe * dt;
      if (state.rng.chance(0.005)) e.strafeDir *= -1;
    }
    if (pointInBuilding(state.city, e.x, e.z, 0.5)) {
      e.x -= -Math.sin(e.angle) * 1.5;
      e.z -= -Math.cos(e.angle) * 1.5;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.angle;
    e.fireTimer -= dt;
    if (d < COMBAT.enemyRange && e.fireTimer <= 0 && state.phase === 'play') {
      e.fireTimer = COMBAT.enemyFireRate * state.rng.range(0.8, 1.5);
      const mx = e.x - Math.sin(e.angle) * 0.55;
      const mz = e.z - Math.cos(e.angle) * 0.55;
      muzzleFlash(state.effects, state.rng, mx, 1.15, mz, false);
      if (state.audio) state.audioGunshot = true;
      if (state.rng.chance(0.45) && !p.inCar) {
        p.health -= COMBAT.enemyDamage;
        if (p.health <= 0) {
          p.health = 0;
          state.phase = 'dead';
        }
      } else if (state.rng.chance(0.3) && p.inCar) {
        p.health -= 3;
        if (p.health <= 0) {
          p.health = 0;
          state.phase = 'dead';
        }
      }
    }
  }
}

export function playerPunch(state) {
  const p = state.player;
  if (p.inCar) return false;
  let hitAny = false;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (dist2D(p.x, p.z, e.x, e.z) < 2.4) {
      e.health -= 12;
      burstSparks(state.effects, state.rng, e.x, 1.2, e.z, 5);
      hitAny = true;
      if (e.health <= 0) killEnemy(state, e);
    }
  }
  return hitAny;
}
