// combat.js — pistol hitscan, Viper enemy AI (approach, strafe, return
// fire), punching and death handling. Shots are rays from the camera
// through the crosshair, tested against spheres around each target.

import * as THREE from 'three';
import { COMBAT, WANTED } from './config.js';
import { angleDamp } from './random.js';
import { burstSparks, muzzleFlash } from './effects.js';
import { addWanted } from './vehicles.js';
import { showMessage } from './hud.js';
import { playGunshot, noiseBurst } from './audio.js';
import { pointInBuilding } from './city.js';

export function createCombat(world) {
  return { shotsFired: 0 };
}

export function spawnEnemy(world, x, z) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.66, 4, 10), bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  // The Vipers' red chest band.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.56),
    new THREE.MeshLambertMaterial({ color: 0xd21f2c })
  );
  band.position.y = 1.28;
  g.add(band);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98d64 })
  );
  head.position.y = 1.82;
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), bodyMat);
  gun.position.set(0.42, 1.15, -0.3);
  g.add(gun);
  g.position.set(x, 0, z);
  world.render.scene.add(g);
  const enemy = {
    x,
    z,
    health: COMBAT.enemyHealth,
    dead: false,
    mesh: g,
    angle: 0,
    fireTimer: world.rng.range(0.6, 1.4),
    strafeDir: world.rng.chance(0.5) ? 1 : -1,
    strafeTimer: world.rng.range(1, 2),
    hold: false,
  };
  world.enemies.push(enemy);
  return enemy;
}

// Distance along the ray to a sphere hit, or -1 for a miss.
export function rayHit(origin, dir, cx, cy, cz, radius) {
  const ox = cx - origin.x;
  const oy = cy - origin.y;
  const oz = cz - origin.z;
  const t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t < 0) return -1;
  const d2 = ox * ox + oy * oy + oz * oz - t * t;
  if (d2 > radius * radius) return -1;
  return t;
}

const _dir = new THREE.Vector3();

export function playerShoot(world) {
  const p = world.player;
  if (world.phase !== 'play' || p.inCar || world.fireCooldown > 0) return;
  world.fireCooldown = COMBAT.fireRate;
  world.combat.shotsFired++;
  const cam = world.render.camera;
  const origin = cam.position;
  cam.getWorldDirection(_dir);

  // The player's own flash: big star, hot light.
  const fx = -Math.sin(p.heading);
  const fz = -Math.cos(p.heading);
  muzzleFlash(world, p.x + fx * 0.5, 1.35, p.z + fz * 0.5, 3.0, 130);
  playGunshot(world);
  if (world.wanted.level === 0) addWanted(world, WANTED.shoot);

  let bestT = COMBAT.pistolRange;
  let bestEnemy = null;
  let bestCar = null;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const t = rayHit(origin, _dir, e.x, 1.3, e.z, 1.1);
    if (t > 0 && t < bestT) {
      bestT = t;
      bestEnemy = e;
      bestCar = null;
    }
  }
  for (const car of world.cars) {
    if (car === p.inCar) continue;
    const t = rayHit(origin, _dir, car.x, 1.0, car.z, 2.2);
    if (t > 0 && t < bestT) {
      bestT = t;
      bestCar = car;
      bestEnemy = null;
    }
  }
  if (bestEnemy) {
    bestEnemy.health -= COMBAT.pistolDamage;
    burstSparks(world, bestEnemy.x, 1.3, bestEnemy.z, 10, 7);
    if (bestEnemy.health <= 0) killEnemy(world, bestEnemy);
  } else if (bestCar) {
    bestCar.speed *= 0.4;
    burstSparks(world, bestCar.x, 1, bestCar.z, 6, 6);
    if (bestCar.isPolice) world.wanted.heat = 0;
  }
}

export function killEnemy(world, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.health = 0;
  world.render.scene.remove(enemy.mesh);
  burstSparks(world, enemy.x, 1.2, enemy.z, 16, 10);
  world.xp += COMBAT.killXp;
  addWanted(world, WANTED.kill);
  showMessage(world, 'Viper down! +25 XP');
}

export function playerPunch(world) {
  const p = world.player;
  if (world.phase !== 'play' || p.inCar || world.punchCooldown > 0) return;
  world.punchCooldown = 0.35;
  noiseBurst(world, 0.06, 900, 0.15);
  let best = null;
  let bestD = 2.4;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) {
    best.health -= 12;
    burstSparks(world, best.x, 1.3, best.z, 4, 5);
    if (best.health <= 0) killEnemy(world, best);
  }
}

export function updateEnemies(world, dt) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const dist = Math.hypot(dx, dz);
    const targetAngle = Math.atan2(-dx, -dz);
    e.angle = angleDamp(e.angle, targetAngle, 3, dt);

    if (!e.hold && dist > 0.01) {
      let mx = 0;
      let mz = 0;
      if (dist > 10) {
        mx = (dx / dist) * COMBAT.enemySpeed;
        mz = (dz / dist) * COMBAT.enemySpeed;
      } else {
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeDir *= -1;
          e.strafeTimer = world.rng.range(1, 2);
        }
        mx = (-dz / dist) * 1.6 * e.strafeDir;
        mz = (dx / dist) * 1.6 * e.strafeDir;
      }
      const nx = e.x + mx * dt;
      const nz = e.z + mz * dt;
      if (!pointInBuilding(world.city, nx, nz, 0.5)) {
        e.x = nx;
        e.z = nz;
      }
    }

    e.fireTimer -= dt;
    if (dist < COMBAT.enemyRange && e.fireTimer <= 0) {
      e.fireTimer = COMBAT.enemyFireRate * world.rng.range(0.8, 1.5);
      const fx = -Math.sin(e.angle);
      const fz = -Math.cos(e.angle);
      muzzleFlash(world, e.x + fx * 0.5, 1.3, e.z + fz * 0.5, 1.8, 65);
      playGunshot(world);
      if (world.rng.chance(0.45)) {
        p.health = Math.max(0, p.health - COMBAT.enemyDamage);
        world.shake = Math.max(world.shake, 0.12);
      }
    }

    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.angle;
  }
}
