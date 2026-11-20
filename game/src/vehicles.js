// vehicles.js — procedural car models (sedan, taxi, van, pickup, police
// cruiser), arcade handling, entering/exiting and the wanted bump for
// stealing. Cars are built facing -Z; a car's heading angle rotates the
// mesh so its front always points along its travel direction.

import * as THREE from 'three';
import { DRIVING, WANTED } from './config.js';
import { clamp } from './random.js';
import { pointInBuilding } from './city.js';
import { burstDust, burstSmoke, dropSkid } from './effects.js';
import { showMessage } from './hud.js';
import { playCrash } from './audio.js';

export const CAR_COLORS = [0xd23b2e, 0x2e6fd2, 0xe8e8e8, 0x22242a, 0x37a05a, 0xf28c28, 0x9b59d0, 0xbfc5cc];
export const TAXI_COLOR = 0xffc61a;

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0x8f979e });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6bf });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3524 });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function createCarMesh(kind, colorHex) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: kind === 'taxi' ? TAXI_COLOR : colorHex });
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const addWheels = (halfW, halfL) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(wheelGeo, tyreMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * halfW, 0.38, sz * halfL);
        car.add(w);
        wheels.push(w);
      }
    }
  };

  if (kind === 'van') {
    car.add(box(2.0, 1.5, 5.4, bodyMat, 0, 1.05, 0));
    car.add(box(1.9, 0.6, 0.5, glassMat, 0, 1.35, -2.5));
    addWheels(0.95, 1.8);
  } else if (kind === 'pickup') {
    car.add(box(1.9, 0.62, 5.2, bodyMat, 0, 0.62, 0));
    car.add(box(1.7, 0.6, 1.6, bodyMat, 0, 1.2, -0.9));
    car.add(box(1.6, 0.45, 1.4, glassMat, 0, 1.22, -0.95));
    car.add(box(1.8, 0.4, 0.14, bodyMat, 0, 0.95, 2.55));
    addWheels(0.9, 1.7);
  } else {
    // sedan, taxi and cruiser share the shell
    car.add(box(1.8, 0.55, 4.6, bodyMat, 0, 0.58, 0));
    car.add(box(1.6, 0.5, 2.1, glassMat, 0, 1.08, 0.25));
    addWheels(0.85, 1.45);
    if (kind === 'taxi') {
      const sign = box(0.95, 0.24, 0.45, new THREE.MeshBasicMaterial({ color: 0xffe93d }), 0, 1.45, 0.25);
      car.add(sign);
    }
    if (kind === 'cruiser') {
      car.add(box(1.84, 0.16, 4.62, new THREE.MeshLambertMaterial({ color: 0x14161c }), 0, 0.6, 0));
      const barBase = box(1.25, 0.1, 0.5, chromeMat, 0, 1.38, 0.25);
      car.add(barBase);
      const red = box(0.5, 0.14, 0.42, new THREE.MeshBasicMaterial({ color: 0xff2222 }), -0.3, 1.48, 0.25);
      const blue = box(0.5, 0.14, 0.42, new THREE.MeshBasicMaterial({ color: 0x2255ff }), 0.3, 1.48, 0.25);
      car.add(red);
      car.add(blue);
      car.userData.barRed = red;
      car.userData.barBlue = blue;
    }
  }

  // Headlights at the front (-Z), tail lights at the back.
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), headMat);
  hl.position.set(-0.6, 0.62, kind === 'van' ? -2.72 : -2.32);
  car.add(hl);
  const hr = hl.clone();
  hr.position.x = 0.6;
  car.add(hr);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.06), tailMat);
  tl.position.set(-0.6, 0.66, kind === 'van' ? 2.72 : kind === 'pickup' ? 2.62 : 2.32);
  car.add(tl);
  const tr = tl.clone();
  tr.position.x = 0.6;
  car.add(tr);

  car.userData.wheels = wheels;
  return car;
}

function registerCar(world, kind, x, z, angle, colorHex) {
  const mesh = createCarMesh(kind, colorHex);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  world.render.scene.add(mesh);
  const car = {
    id: world.nextCarId++,
    kind,
    isPolice: kind === 'cruiser',
    x,
    z,
    angle,
    speed: 0,
    mesh,
    driver: null,
    stolen: false,
    parked: false,
    cruise: 0,
    targetAngle: angle,
  };
  world.cars.push(car);
  return car;
}

export function spawnParkedCar(world, kind, x, z, angle, colorHex) {
  const car = registerCar(world, kind, x, z, angle, colorHex ?? world.rng.pick(CAR_COLORS));
  car.parked = true;
  world.parkedCars.push(car);
  return car;
}

export function spawnRandomCar(world, x, z, angle) {
  const kind = world.rng.pick(['sedan', 'sedan', 'taxi', 'van', 'pickup']);
  return registerCar(world, kind, x, z, angle, world.rng.pick(CAR_COLORS));
}

export function syncCarMesh(car, dt) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  if (dt) {
    const spin = (car.speed * dt) / 0.38;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// Arcade driving: strong acceleration, a capped top speed, steering that
// gains authority with speed, and instant grip — velocity always follows
// the nose. Hard cornering above 12 m/s lays skid marks and dust.
export function driveCar(world, car, throttle, steer, brake, dt) {
  const D = DRIVING;
  const prevX = car.x;
  const prevZ = car.z;
  let speed = car.speed;
  if (throttle > 0) {
    speed += D.accel * throttle * dt;
  } else if (throttle < 0) {
    if (speed > 0.5) speed -= D.brake * dt;
    else speed += D.reverseAccel * throttle * dt;
  }
  if (brake) {
    const cut = Math.min(Math.abs(speed), D.brake * dt);
    speed -= Math.sign(speed) * cut;
  }
  speed -= speed * D.drag * dt;
  car.speed = clamp(speed, -D.maxReverse, D.maxSpeed);
  speed = car.speed;

  const authority = clamp(Math.abs(speed) / 8, 0, 1);
  const dirSign = speed < 0 ? -1 : 1;
  car.angle += steer * D.steer * authority * dirSign * clamp(Math.abs(speed) / 10, 0, 1) * dt;

  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  car.x += fx * speed * dt;
  car.z += fz * speed * dt;

  // Skids and dust in a hard, fast turn.
  if (Math.abs(steer) > 0.35 && Math.abs(speed) > 12) {
    const rx = Math.cos(car.angle);
    const rz = -Math.sin(car.angle);
    const bx = car.x - fx * 1.45;
    const bz = car.z - fz * 1.45;
    dropSkid(world, bx + rx * 0.85, bz + rz * 0.85, car.angle);
    dropSkid(world, bx - rx * 0.85, bz - rz * 0.85, car.angle);
    if (world.rng.chance(0.5)) burstDust(world, bx, 0.25, bz, 3, 1.1);
  }

  // Buildings are solid: bounce off, with a crash if it was fast.
  if (pointInBuilding(world.city, car.x, car.z, 1.25)) {
    car.x = prevX;
    car.z = prevZ;
    if (Math.abs(speed) > 6) {
      playCrash(world, Math.min(1, Math.abs(speed) / 22));
      world.shake = Math.max(world.shake, 0.4);
      burstSmoke(world, car.x + fx * 2, 0.7, car.z + fz * 2, 6, 1.2);
      car.speed = -speed * 0.25;
    } else {
      car.speed = 0;
    }
  }
  const lim = 208;
  car.x = clamp(car.x, -lim, lim);
  car.z = clamp(car.z, -lim, lim);
  syncCarMesh(car, dt);
}

// Shove another car out of the way (used for car-to-car contact).
export function shoveCar(world, other, fromX, fromZ, strength) {
  const dx = other.x - fromX;
  const dz = other.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  other.x += (dx / d) * strength;
  other.z += (dz / d) * strength;
  if (!pointInBuilding(world.city, other.x, other.z, 1.1)) {
    syncCarMesh(other, 0);
  }
}

export function addWanted(world, amount) {
  world.wanted.level = Math.min(WANTED.max, world.wanted.level + amount);
  world.wanted.heat = 0;
}

export function tryEnterCar(world) {
  const p = world.player;
  let best = null;
  let bestD = DRIVING.enterRadius;
  for (const car of world.cars) {
    if (car.driver) continue;
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return false;
  best.driver = 'player';
  p.inCar = best;
  p.mesh.visible = false;
  p.x = best.x;
  p.z = best.z;
  p.heading = best.angle;
  world.camYaw = best.angle;
  if (best.isPolice) {
    showMessage(world, 'Cruiser commandeered!');
  } else if (!best.stolen) {
    best.stolen = true;
    addWanted(world, WANTED.steal);
    showMessage(world, 'Car stolen');
  }
  return true;
}

export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  const rx = -fz;
  const rz = fx;
  let px = car.x - rx * 2.4;
  let pz = car.z - rz * 2.4;
  if (pointInBuilding(world.city, px, pz, 0.7)) {
    px = car.x + rx * 2.4;
    pz = car.z + rz * 2.4;
  }
  car.driver = null;
  car.speed = 0;
  p.inCar = null;
  p.x = px;
  p.z = pz;
  p.y = 0;
  p.vy = 0;
  p.heading = car.angle;
  p.mesh.visible = true;
  world.camYaw = car.angle;
}
