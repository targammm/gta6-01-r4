// vehicles.js — procedural car models, arcade driving physics, entering/exiting and theft heat.
import * as THREE from 'three';
import { PALETTE, DRIVING, WANTED } from './config.js';
import { clamp, dist2D } from './random.js';
import { pointInBuilding } from './city.js';
import { burstDust, dropSkid } from './effects.js';

export function addWanted(state, amount) {
  const w = state.wanted;
  const before = Math.floor(w.level);
  w.level = clamp(w.level + amount, 0, WANTED.max);
  w.heat = 0;
  if (Math.floor(w.level) > before && state.showMessage) {
    // the HUD message for new stars is handled by the police module's announcements
  }
}

const BODY_GEO = {
  sedan: { length: 4.6, width: 1.9, bodyH: 0.62, cabinL: 2.2, cabinH: 0.55 },
  taxi: { length: 4.6, width: 1.9, bodyH: 0.62, cabinL: 2.2, cabinH: 0.55 },
  van: { length: 5.4, width: 2.1, bodyH: 1.5, cabinL: 1.4, cabinH: 0.4 },
  pickup: { length: 5.2, width: 2, bodyH: 0.7, cabinL: 1.8, cabinH: 0.6 },
  cruiser: { length: 4.8, width: 1.95, bodyH: 0.62, cabinL: 2.3, cabinH: 0.55 },
};

export function createCarMesh(kind, colorHex) {
  const spec = BODY_GEO[kind] || BODY_GEO.sedan;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: kind === 'cruiser' ? PALETTE.policeBody : colorHex });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.bodyH, spec.length), bodyMat);
  body.position.y = 0.55 + spec.bodyH / 2 - 0.3;
  body.castShadow = true;
  group.add(body);

  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  if (kind === 'pickup') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.92, spec.cabinH, spec.cabinL), glassMat);
    cab.position.set(0, body.position.y + spec.bodyH / 2 + spec.cabinH / 2 - 0.05, -spec.length / 2 + spec.cabinL / 2 + 0.5);
    cab.castShadow = true;
    group.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.94, 0.3, spec.length - spec.cabinL - 0.9),
      new THREE.MeshLambertMaterial({ color: colorHex }));
    bed.position.set(0, body.position.y + spec.bodyH / 2 - 0.1, spec.cabinL / 2 + 0.4);
    group.add(bed);
  } else if (kind === 'van') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.94, 0.5, spec.cabinL), glassMat);
    cab.position.set(0, body.position.y + spec.bodyH - 0.1, -spec.length / 2 + spec.cabinL / 2);
    group.add(cab);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.86, spec.cabinH, spec.cabinL), glassMat);
    cab.position.set(0, body.position.y + spec.bodyH / 2 + spec.cabinH / 2 - 0.05, -0.2);
    cab.castShadow = true;
    group.add(cab);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  const wx = spec.width / 2 - 0.05;
  const wz = spec.length / 2 - 0.85;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * wx, 0.38, sz * wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd92323 });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), headMat);
    head.position.set(sx * spec.width * 0.32, 0.72, -spec.length / 2 - 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), tailMat);
    tail.position.set(sx * spec.width * 0.32, 0.72, spec.length / 2 + 0.02);
    group.add(tail);
  }

  let lightBar = null;
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe93f }));
    sign.position.set(0, body.position.y + spec.bodyH / 2 + spec.cabinH + 0.08, -0.2);
    group.add(sign);
  }
  if (kind === 'cruiser') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.02, 0.3, spec.length * 0.7),
      new THREE.MeshLambertMaterial({ color: PALETTE.policeTrim }));
    stripe.position.y = body.position.y;
    group.add(stripe);
    lightBar = new THREE.Group();
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x15181d }));
    lightBar.add(barBase);
    const redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.34),
      new THREE.MeshBasicMaterial({ color: PALETTE.lightRed }));
    redLamp.position.set(-0.33, 0.14, 0);
    lightBar.add(redLamp);
    const blueLamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.34),
      new THREE.MeshBasicMaterial({ color: PALETTE.lightBlue }));
    blueLamp.position.set(0.33, 0.14, 0);
    lightBar.add(blueLamp);
    lightBar.position.set(0, body.position.y + spec.bodyH / 2 + spec.cabinH + 0.1, -0.2);
    lightBar.userData = { redLamp, blueLamp };
    group.add(lightBar);
  }
  group.userData = { wheels, lightBar, spec };
  return group;
}

function makeCar(state, kind, x, z, angle, colorHex) {
  const mesh = createCarMesh(kind, colorHex);
  mesh.position.set(x, 0, z);
  state.render.scene.add(mesh);
  const car = {
    kind, mesh, x, z, angle, speed: 0,
    color: colorHex, driver: null, ai: null,
    wheels: mesh.userData.wheels, lightBar: mesh.userData.lightBar,
    flashPhase: state.rng.range(0, 2), wrecked: false,
  };
  syncCarMesh(car);
  return car;
}

export function spawnParkedCar(state, kind, x, z, angle, colorHex) {
  const car = makeCar(state, kind, x, z, angle, colorHex);
  state.parkedCars.push(car);
  return car;
}

export function spawnRandomCar(state, rng) {
  const kind = rng.pick(['sedan', 'sedan', 'taxi', 'van', 'pickup']);
  const color = kind === 'taxi' ? PALETTE.taxi : rng.pick(PALETTE.carColors);
  const vertical = rng.chance(0.5);
  const line = rng.pick([-150, -90, -30, 30, 90, 150]);
  const along = rng.range(-195, 195);
  const lane = rng.chance(0.5) ? 3.4 : -3.4;
  const x = vertical ? line + lane : along;
  const z = vertical ? along : line + lane;
  const dir = lane > 0 ? 1 : -1;
  const angle = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  const car = makeCar(state, kind, x, z, angle, color);
  car.speed = rng.range(9, 15);
  car.ai = { cruise: car.speed, vertical, line, dir };
  state.trafficCars.push(car);
  return car;
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const spin = car.speed * 0.12;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  if (car.lightBar) {
    car.flashPhase += 0.18;
    const on = Math.sin(car.flashPhase * 6) > 0;
    car.lightBar.userData.redLamp.material.color.setHex(on ? 0xff2a2a : 0x661111);
    car.lightBar.userData.blueLamp.material.color.setHex(on ? 0x1144aa : 0x2a6bff);
  }
}

export function driveCar(state, car, throttle, steer, brake, dt) {
  const D = DRIVING;
  if (throttle > 0) {
    car.speed += D.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= D.brake * dt;
    else car.speed -= D.reverseAccel * -throttle * dt;
  }
  if (brake) {
    car.speed -= Math.sign(car.speed) * D.brake * 1.2 * dt;
    if (Math.abs(car.speed) < 1.2) car.speed = 0;
  }
  car.speed -= car.speed * D.drag * dt * 0.35;
  car.speed = clamp(car.speed, -D.maxReverse, D.maxSpeed);

  const authority = Math.min(1, Math.abs(car.speed) / 8 + 0.15);
  const steerPower = D.steer * authority * clamp(Math.abs(car.speed) / 10, 0, 1);
  if (Math.abs(car.speed) > 0.2) {
    car.angle += steer * steerPower * dt * Math.sign(car.speed);
  }
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;

  // Building collision: bounce off and scrub speed.
  const hit = pointInBuilding(state.city, car.x, car.z, 1.2);
  if (hit) {
    car.x -= fx * car.speed * dt;
    car.z -= fz * car.speed * dt;
    if (Math.abs(car.speed) > 6) {
      state.camShake = Math.max(state.camShake, 0.4);
      if (state.audio) state.audioCrash = true;
      burstDust(state.effects, state.rng, car.x + fx * 2, 0.6, car.z + fz * 2, 8);
    }
    car.speed *= -0.25;
  }
  // Car-to-car: shove the other car and slow down.
  const others = state.allCars();
  for (const other of others) {
    if (other === car) continue;
    const d = dist2D(car.x, car.z, other.x, other.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) * 2.4 * dt;
      const nx = (other.x - car.x) / d;
      const nz = (other.z - car.z) / d;
      other.x += nx * push;
      other.z += nz * push;
      if (Math.abs(car.speed) > 8 && state.audio) state.audioCrash = true;
      car.speed *= 1 - 0.15 * dt * 4;
    }
  }
  car.x = clamp(car.x, -206, 206);
  car.z = clamp(car.z, -206, 203);

  // Hard cornering lays rubber and kicks up dust — the chase look.
  if (Math.abs(steer) > 0.3 && Math.abs(car.speed) > 12) {
    const rx = -fz;
    const rz = fx;
    const rearX = car.x - fx * 1.4;
    const rearZ = car.z - fz * 1.4;
    dropSkid(state.effects, rearX + rx * 0.8, rearZ + rz * 0.8, car.angle);
    dropSkid(state.effects, rearX - rx * 0.8, rearZ - rz * 0.8, car.angle);
    if (state.rng.chance(0.55)) {
      burstDust(state.effects, state.rng, rearX, 0.5, rearZ, 3);
    }
    if (Math.abs(car.speed) > 24 && state.rng.chance(0.3)) {
      burstDust(state.effects, state.rng, rearX - fx * 1.5, 0.8, rearZ - fz * 1.5, 2);
    }
  }
  syncCarMesh(car);
  return car;
}

export function nearestEnterableCar(state, x, z) {
  let best = null;
  let bestDist = DRIVING.enterRadius;
  for (const car of state.allCars()) {
    if (car.driver) continue;
    const d = dist2D(x, z, car.x, car.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export function tryEnterCar(state) {
  const p = state.player;
  const car = nearestEnterableCar(state, p.x, p.z);
  if (!car) return false;
  car.driver = 'player';
  p.inCar = car;
  p.mesh.visible = false;
  if (car.kind === 'cruiser') {
    state.showMessage('Cruiser commandeered!', 3);
  } else if (!car.stolenBefore) {
    car.stolenBefore = true;
    addWanted(state, WANTED.gains.steal);
    state.showMessage('Car stolen', 3);
  }
  return true;
}

export function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return false;
  car.driver = null;
  car.speed = 0;
  const rx = Math.cos(car.angle);
  const rz = -Math.sin(car.angle);
  p.x = car.x + rx * 2.4;
  p.z = car.z + rz * 2.4;
  p.y = 0;
  p.inCar = null;
  p.mesh.visible = true;
  syncCarMesh(car);
  return true;
}
