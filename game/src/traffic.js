// traffic.js — ambient life: AI cars that cruise the avenues, stop for
// whatever is ahead and turn at intersections, and pedestrians who stroll
// the sidewalks and flee from the player's car. A shot-local density boost
// can pour extra actors around a point (used by screenshot staging).

import * as THREE from 'three';
import { WORLD, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { clamp, damp, angleDamp } from './random.js';
import { spawnRandomCar, syncCarMesh } from './vehicles.js';
import { pointInBuilding } from './city.js';

const LANE = 3.5; // right-hand lane offset from an avenue centre line
const WALK = 10.2; // sidewalk offset pedestrians walk along

// Pick a random avenue and a direction on it; returns a spawn pose already
// in the correct right-hand lane.
function avenuePose(rng) {
  const vertical = rng.chance(0.5);
  const line = rng.pick(WORLD.roads);
  const along = rng.range(-200, 200);
  const dirSign = rng.chance(0.5) ? 1 : -1;
  if (vertical) {
    // Travelling +z (angle PI) keeps the lane at line - LANE, and vice versa.
    const x = dirSign > 0 ? line - LANE : line + LANE;
    return { x, z: along, angle: dirSign > 0 ? Math.PI : 0 };
  }
  const z = dirSign > 0 ? line + LANE : line - LANE;
  return { x: along, z, angle: dirSign > 0 ? -Math.PI / 2 : Math.PI / 2 };
}

export function spawnTrafficCar(world, x, z, angle) {
  const car = spawnRandomCar(world, x, z, angle);
  car.driver = 'traffic';
  car.cruise = world.rng.range(9, 15);
  car.speed = car.cruise * 0.6;
  world.traffic.cars.push(car);
  return car;
}

const PED_COLORS = [0xe8452c, 0x2c8ae8, 0x2ecc71, 0xf5b921, 0x9b59d0, 0xff7b2d, 0xeeeeee, 0x34495e];

export function spawnPedestrian(world, x, z) {
  const rng = world.rng;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.62, 4, 8),
    new THREE.MeshLambertMaterial({ color: rng.pick(PED_COLORS) })
  );
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b08a })
  );
  head.position.y = 1.72;
  g.add(head);
  g.position.set(x, 0, z);
  world.render.scene.add(g);
  const vertical = rng.chance(0.5);
  const ped = {
    x,
    z,
    mesh: g,
    vertical,
    line: rng.pick(WORLD.roads),
    side: rng.chance(0.5) ? 1 : -1,
    dir: rng.chance(0.5) ? 1 : -1,
    speed: rng.range(1.1, 2.1),
    fear: 0,
    fearX: 0,
    fearZ: 0,
    angle: 0,
  };
  if (vertical) ped.x = ped.line + ped.side * WALK;
  else ped.z = ped.line + ped.side * WALK;
  ped.angle = ped.vertical ? (ped.dir > 0 ? Math.PI : 0) : ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  world.traffic.peds.push(ped);
  return ped;
}

export function createTraffic(world) {
  world.traffic = { cars: [], peds: [] };
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const pose = avenuePose(world.rng);
    spawnTrafficCar(world, pose.x, pose.z, pose.angle);
  }
  for (let i = 0; i < PED_COUNT; i++) {
    spawnPedestrian(world, world.rng.range(-190, 190), world.rng.range(-190, 190));
  }
  return world.traffic;
}

// Is anything solid within 9 m ahead of this car, inside its lane?
export function carAheadBlocked(world, car) {
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  const rx = -fz;
  const rz = fx;
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0.5 || ahead > 9) continue;
    if (Math.abs(dx * rx + dz * rz) < 2.4) return true;
  }
  const p = world.player;
  if (!p.inCar) {
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const ahead = dx * fx + dz * fz;
    if (ahead > 0.5 && ahead < 9 && Math.abs(dx * rx + dz * rz) < 2.2) return true;
  }
  return false;
}

export function updateTraffic(world, dt) {
  const rng = world.rng;
  for (const car of world.traffic.cars) {
    const blocked = carAheadBlocked(world, car);
    const target = blocked ? 0 : car.cruise;
    const delta = target - car.speed;
    car.speed += clamp(delta, -14 * dt, 8 * dt);

    // Occasionally turn at an intersection.
    const fx = -Math.sin(car.angle);
    const fz = -Math.cos(car.angle);
    const nearX = WORLD.roads.some((r) => Math.abs(car.x - r) < 1.4);
    const nearZ = WORLD.roads.some((r) => Math.abs(car.z - r) < 1.4);
    if (nearX && nearZ && rng.chance(0.012)) {
      car.targetAngle = car.angle + (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    }
    car.angle = angleDamp(car.angle, car.targetAngle, 3, dt);

    // Settle back into the right-hand lane of the avenue being travelled.
    if (Math.abs(fz) > Math.abs(fx)) {
      let bestLine = WORLD.roads[0];
      let bestD = Infinity;
      for (const r of WORLD.roads) {
        const d = Math.abs(car.x - r);
        if (d < bestD) {
          bestD = d;
          bestLine = r;
        }
      }
      const laneX = bestLine + (fz > 0 ? -LANE : LANE);
      car.x = damp(car.x, laneX, 3, dt);
    } else {
      let bestLine = WORLD.roads[0];
      let bestD = Infinity;
      for (const r of WORLD.roads) {
        const d = Math.abs(car.z - r);
        if (d < bestD) {
          bestD = d;
          bestLine = r;
        }
      }
      const laneZ = bestLine + (fx > 0 ? LANE : -LANE);
      car.z = damp(car.z, laneZ, 3, dt);
    }

    car.x += -Math.sin(car.angle) * car.speed * dt;
    car.z += -Math.cos(car.angle) * car.speed * dt;
    if (pointInBuilding(world.city, car.x, car.z, 1.2)) {
      car.x -= -Math.sin(car.angle) * car.speed * dt;
      car.z -= -Math.cos(car.angle) * car.speed * dt;
      car.speed = 0;
    }
    if (car.x > 205) car.x = -205;
    if (car.x < -205) car.x = 205;
    if (car.z > 205) car.z = -205;
    if (car.z < -205) car.z = 205;
    car.targetAngle = car.targetAngle ?? car.angle;
    syncCarMesh(car, dt);
  }
}

export function updatePedestrians(world, dt) {
  const rng = world.rng;
  const p = world.player;
  for (const ped of world.traffic.peds) {
    // Fear: run from the player's car when it gets close.
    if (p.inCar && Math.hypot(p.inCar.x - ped.x, p.inCar.z - ped.z) < 6) {
      ped.fear = 1.2;
      ped.fearX = ped.x - p.inCar.x;
      ped.fearZ = ped.z - p.inCar.z;
      const d = Math.hypot(ped.fearX, ped.fearZ) || 1;
      ped.fearX /= d;
      ped.fearZ /= d;
    }
    if (ped.fear > 0) {
      ped.fear -= dt;
      const nx = ped.x + ped.fearX * 3.4 * dt;
      const nz = ped.z + ped.fearZ * 3.4 * dt;
      if (!pointInBuilding(world.city, nx, nz, 0.4)) {
        ped.x = nx;
        ped.z = nz;
      }
      ped.angle = Math.atan2(-ped.fearX, -ped.fearZ);
    } else {
      // Stroll along the sidewalk; sometimes turn at an intersection.
      const crossNear = ped.vertical
        ? WORLD.roads.some((r) => Math.abs(ped.z - r) < 1.6)
        : WORLD.roads.some((r) => Math.abs(ped.x - r) < 1.6);
      if (crossNear && rng.chance(0.008)) {
        ped.vertical = !ped.vertical;
        ped.line = ped.vertical
          ? WORLD.roads.reduce((a, b) => (Math.abs(b - ped.x) < Math.abs(a - ped.x) ? b : a))
          : WORLD.roads.reduce((a, b) => (Math.abs(b - ped.z) < Math.abs(a - ped.z) ? b : a));
        ped.side = rng.chance(0.5) ? 1 : -1;
        ped.dir = rng.chance(0.5) ? 1 : -1;
      }
      if (ped.vertical) {
        ped.x = damp(ped.x, ped.line + ped.side * WALK, 6, dt);
        ped.z += ped.dir * ped.speed * dt;
        if (ped.z > 202 || ped.z < -202) ped.dir *= -1;
        ped.angle = ped.dir > 0 ? Math.PI : 0;
      } else {
        ped.z = damp(ped.z, ped.line + ped.side * WALK, 6, dt);
        ped.x += ped.dir * ped.speed * dt;
        if (ped.x > 202 || ped.x < -202) ped.dir *= -1;
        ped.angle = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      if (pointInBuilding(world.city, ped.x, ped.z, 0.4)) {
        ped.dir *= -1;
        ped.x += ped.dir * ped.speed * dt * (ped.vertical ? 0 : 1);
        ped.z += ped.dir * ped.speed * dt * (ped.vertical ? 1 : 0);
      }
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.angle;
  }
}

// Pour extra traffic and pedestrians around a point: cars on the nearest
// avenues within about 45 m, pedestrians on sidewalks 8–55 m out. Staging
// calls this AFTER driving, around the final position, so the crowd is in
// the captured frame instead of a hundred metres behind it.
export function boostDensityNear(world, cx, cz, carCount, pedCount) {
  const rng = world.rng;
  for (let i = 0; i < carCount; i++) {
    const vertical = rng.chance(0.5);
    const line = WORLD.roads.reduce((a, b) => {
      const da = Math.abs(b - (vertical ? cx : cz));
      const db = Math.abs(a - (vertical ? cx : cz));
      return db < da ? b : a;
    });
    const along = clamp((vertical ? cz : cx) + rng.range(-45, 45), -200, 200);
    const dirSign = rng.chance(0.5) ? 1 : -1;
    if (vertical) {
      spawnTrafficCar(world, dirSign > 0 ? line - LANE : line + LANE, along, dirSign > 0 ? Math.PI : 0);
    } else {
      spawnTrafficCar(world, along, dirSign > 0 ? line + LANE : line - LANE, dirSign > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }
  for (let i = 0; i < pedCount; i++) {
    const ped = spawnPedestrian(world, cx, cz);
    const vertical = rng.chance(0.5);
    ped.vertical = vertical;
    ped.line = WORLD.roads.reduce((a, b) => {
      const da = Math.abs(b - (vertical ? cx : cz));
      const db = Math.abs(a - (vertical ? cx : cz));
      return db < da ? b : a;
    });
    ped.side = rng.chance(0.5) ? 1 : -1;
    const along = clamp((vertical ? cz : cx) + rng.range(8, 55) * (rng.chance(0.5) ? 1 : -1), -200, 200);
    if (vertical) {
      ped.x = ped.line + ped.side * WALK;
      ped.z = along;
    } else {
      ped.z = ped.line + ped.side * WALK;
      ped.x = along;
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
  }
}
