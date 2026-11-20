// traffic.js — AI cars that cruise the avenues and pedestrians who stroll, scatter and boost shot density.
import * as THREE from 'three';
import { WORLD, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { clamp, dist2D } from './random.js';
import { pointInBuilding } from './city.js';
import { spawnRandomCar, syncCarMesh } from './vehicles.js';

const PED_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0xe67e22, 0x1abc9c, 0xfd79a8, 0xfdcb6e];

export function createTraffic(state) {
  for (let i = 0; i < TRAFFIC_COUNT; i++) spawnRandomCar(state, state.rng);
  for (let i = 0; i < PED_COUNT; i++) spawnPedestrian(state, state.rng);
  return state;
}

export function spawnPedestrian(state, rng, nearX, nearZ) {
  const group = new THREE.Group();
  const color = rng.pick(PED_COLORS);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.75, 3, 8),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b98d })
  );
  head.position.y = 1.72;
  group.add(head);
  state.render.scene.add(group);

  let x;
  let z;
  if (nearX !== undefined) {
    const line = rng.pick(WORLD.roads);
    const vertical = rng.chance(0.5);
    const off = (rng.chance(0.5) ? -1 : 1) * 10.2;
    const along = clamp((vertical ? nearZ : nearX) + rng.range(-50, 50), -200, 200);
    x = vertical ? line + off : along;
    z = vertical ? along : line + off;
  } else {
    const line = rng.pick(WORLD.roads);
    const vertical = rng.chance(0.5);
    const off = (rng.chance(0.5) ? -1 : 1) * 10.2;
    const along = rng.range(-200, 200);
    x = vertical ? line + off : along;
    z = vertical ? along : line + off;
  }
  const ped = {
    mesh: group, x, z,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(1.1, 2.1),
    cruise: 0, fleeTimer: 0, phase: rng.range(0, 6),
  };
  ped.cruise = ped.speed;
  group.position.set(x, 0, z);
  state.peds.push(ped);
  return ped;
}

export function boostDensityNear(state, cx, cz, extraCars, extraPeds) {
  for (let i = 0; i < extraCars; i++) {
    const car = spawnRandomCar(state, state.rng);
    const vertical = state.rng.chance(0.5);
    const line = WORLD.roads.reduce((best, r) => (Math.abs(r - (vertical ? cx : cz)) < Math.abs(best - (vertical ? cx : cz)) ? r : best), WORLD.roads[0]);
    const along = clamp((vertical ? cz : cx) + state.rng.range(-45, 45), -200, 200);
    const lane = state.rng.chance(0.5) ? 3.4 : -3.4;
    car.x = vertical ? line + lane : along;
    car.z = vertical ? along : line + lane;
    car.ai.vertical = vertical;
    car.ai.line = line;
    car.ai.dir = lane > 0 ? 1 : -1;
    car.angle = vertical ? (car.ai.dir > 0 ? 0 : Math.PI) : (car.ai.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    syncCarMesh(car);
  }
  for (let i = 0; i < extraPeds; i++) {
    const ped = spawnPedestrian(state, state.rng, cx, cz);
    const a = state.rng.range(0, Math.PI * 2);
    const r = state.rng.range(8, 50);
    ped.x = clamp(cx + Math.cos(a) * r, -205, 205);
    ped.z = clamp(cz + Math.sin(a) * r, -205, 200);
    if (pointInBuilding(state.city, ped.x, ped.z, 1)) {
      ped.x = cx + 12;
      ped.z = cz + 12;
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
  }
}

export function carAheadBlocked(state, car) {
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  const probeX = car.x + fx * 9;
  const probeZ = car.z + fz * 9;
  for (const other of state.allCars()) {
    if (other === car) continue;
    const lateral = Math.abs((other.x - car.x) * -fz + (other.z - car.z) * fx);
    if (lateral < 2.4 && dist2D(probeX, probeZ, other.x, other.z) < 5.5) return true;
  }
  const p = state.player;
  const pX = p.inCar ? p.inCar.x : p.x;
  const pZ = p.inCar ? p.inCar.z : p.z;
  const lateralP = Math.abs((pX - car.x) * -fz + (pZ - car.z) * fx);
  if (lateralP < 2.2 && dist2D(probeX, probeZ, pX, pZ) < 5.5) return true;
  return false;
}

export function updateTraffic(state, dt) {
  for (const car of state.trafficCars) {
    if (car.driver === 'player') continue;
    const ai = car.ai;
    if (!ai) continue;
    const blocked = carAheadBlocked(state, car);
    const target = blocked ? 0 : ai.cruise;
    if (car.speed < target) car.speed = Math.min(target, car.speed + 8 * dt);
    else car.speed = Math.max(target, car.speed - 14 * dt);

    const coord = ai.vertical ? car.z : car.x;
    const headingAngle = ai.vertical
      ? (ai.dir > 0 ? 0 : Math.PI)
      : (ai.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    car.angle = headingAngle;
    // Drift back onto the avenue line.
    if (ai.vertical) {
      car.x += (ai.line + (ai.dir > 0 ? 3.4 : -3.4) - car.x) * Math.min(1, 3 * dt);
    } else {
      car.z += (ai.line + (ai.dir > 0 ? 3.4 : -3.4) - car.z) * Math.min(1, 3 * dt);
    }
    car.x += -Math.sin(car.angle) * car.speed * dt;
    car.z += -Math.cos(car.angle) * car.speed * dt;

    // Occasionally turn at a crossing.
    const nearCross = WORLD.roads.some((r) => Math.abs(r - coord) < 1.5);
    if (nearCross && state.rng.chance(0.012)) {
      ai.vertical = !ai.vertical;
      ai.line = WORLD.roads.reduce((best, r) => (Math.abs(r - (ai.vertical ? car.z : car.x)) < Math.abs(best - (ai.vertical ? car.z : car.x)) ? r : best), WORLD.roads[0]);
      ai.dir = state.rng.chance(0.5) ? 1 : -1;
    }
    if (car.x > 205) car.x = -205;
    if (car.x < -205) car.x = 205;
    if (car.z > 205) car.z = -205;
    if (car.z < -205) car.z = 205;
    if (pointInBuilding(state.city, car.x, car.z, 1)) {
      car.speed = 0;
      car.x += Math.sin(car.angle) * 2;
      car.z += Math.cos(car.angle) * 2;
    }
    syncCarMesh(car);
  }
}

export function updatePedestrians(state, dt) {
  const p = state.player;
  const pSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
  for (const ped of state.peds) {
    ped.phase += dt * (2 + ped.speed * 2);
    let speed = ped.cruise;
    if (p.inCar && pSpeed > 3 && dist2D(ped.x, ped.z, p.inCar.x, p.inCar.z) < 6) {
      ped.fleeTimer = 1.2;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      speed = 3.4;
      const srcX = p.inCar ? p.inCar.x : p.x;
      const srcZ = p.inCar ? p.inCar.z : p.z;
      const away = Math.atan2(-(srcX - ped.x), -(srcZ - ped.z));
      ped.angle = away;
      if (!state.shotMode && state.rng.chance(0.002)) {
        // a pedestrian clipped by the player's car raises the heat (handled in world via proximity)
      }
    }
    ped.x += -Math.sin(ped.angle) * speed * dt;
    ped.z += -Math.cos(ped.angle) * speed * dt;
    if (pointInBuilding(state.city, ped.x, ped.z, 0.5)) {
      ped.angle += Math.PI * 0.9;
      ped.x += -Math.sin(ped.angle) * 1.2;
      ped.z += -Math.cos(ped.angle) * 1.2;
    }
    if (ped.x > 206 || ped.x < -206 || ped.z > 202 || ped.z < -206) {
      ped.angle += Math.PI;
      ped.x = clamp(ped.x, -205, 205);
      ped.z = clamp(ped.z, -205, 200);
    }
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.phase)) * 0.05, ped.z);
    ped.mesh.rotation.y = ped.angle;
  }
}
